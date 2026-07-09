# Resident Agent 架构改造方案

## 背景与问题

当前每次执行 `ai "xxx"` 时：

```
CLI 进程启动 → 加载全部依赖(langchain/inquirer/ssh2...) → initAgent()
  → 扫描全部用户工具 → 连接所有 MCP 服务器 → 加载 Skills
  → agent.execute() → process.exit(0)  ← 全部状态丢失
```

**问题**：MCP 连接、依赖加载、Agent 初始化等耗时操作每条命令都要重做一遍，尤其是首次启动极慢。

## 核心思路

CLI 不再自己创建 Agent，只通过 WebSocket 向常驻的 PM2 Serve 发送请求。Serve 端为每个工作目录维护一个 Agent 实例（Map），首次请求时懒创建，任务执行完后销毁，同一目录的后续请求复用已有实例。

## 架构概览

```
┌─────────────────┐   WebSocket (agent-room)    ┌──────────────────────────────┐
│  CLI 进程         │◄─────────────────────────►│  PM2 Serve 常驻进程           │
│  (快速启动/退出)   │                            │                              │
│  不再创建 Agent   │  → {type:"execute",        │  AgentPool (Map<id, Agent>)    │
│  只做输入/输出转发 │     payload:{input, cwd}}  │                              │
│                   │                            │  id=cli-pid1234 → Agent A    │
│  process.stdout   │  ← {type:"stream",         │  cwd=projectB → Agent 实例 B  │
│  实时流式输出      │      payload:content}       │  id 不存在 → 懒创建新实例    │
│                   │                            │  空闲超时 → 销毁释放资源       │
│  inquirer 交互    │  ← {type:"ask-question",   │                              │
│  展示问题/发送答案 │      payload:{...}}         │  ask_question 通过 WS 回传   │
└─────────────────┘  ← {type:"execute-done"}   └──────────────────────────────┘
```

## 关键设计

### Agent 池（AgentInstanceMap）

Serve 端已有 `agents`（WebSocket 连接映射），新增 `agentInstanceMap`（Agent 实例映射），均以 agent id 为 key。

```
agents:          Map<id, ClientRecord>     — WS 连接
agentInstanceMap: Map<id, AgentInstance>    — Agent 实例
```

`AgentInstance` 结构：`{ agent: AIAgent, cwd: string, lastActive: number }`

两个 Map 通过 id 关联：CLI 连接时由 CLI 端（或 Serve 端）生成唯一 id，该 id 同时用于 WS 注册和 Agent 实例查找。

**生命周期**：
- **懒创建**：CLI 首次发送 `execute` 请求时，Serve 以该 id 查找 agentInstanceMap，不存在则调用 `initAgent()` 创建 Agent 并放入池中
- **复用**：同一 id 的后续请求直接从池中取，跳过初始化
- **销毁**：任务执行完毕后启动空闲定时器，超时未使用则销毁 Agent（释放 MCP 连接、内存等），同时从 agentInstanceMap 中移除

### 消息协议

CLI 连接时携带 id（与 agent-room 注册的 id 一致），发送 `execute` 消息时携带 `cwd`（当前工作目录），Serve 根据 id 查找 agentInstanceMap，不存在则用 cwd + config 创建对应 Agent。

### 流式输出

Agent 的 `STREAM_CONTENT_OUTPUT` 事件通过 `agent-room` WebSocket 直接转发给 CLI，CLI 调用 `process.stdout.write()` 实时打印。

### 交互式问答

Agent 调用 `ask_question` 工具时，Serve 通过 WS 向 CLI 发送 `ask-question` 消息，CLI 用本地 inquirer 展示问题并将答案回传，Serve 端用 Promise 挂起等待回答。

## 改动文件

| 文件 | 改动 |
|------|------|
| `src/serve/service/index.ts` | 新增 AgentPool，管理 Agent 的创建/复用/销毁 |
| `src/serve/service/agent-room/server.ts` | 处理 `execute` / `question-answer` 消息路由 |
| `src/serve/service/agent-room/types.ts` | 新增消息类型（stream / execute-done / ask-question 等） |
| `src/agent/tools/question.ts` | 支持远程交互模式（通过 WS 回传而非本地 inquirer） |
| `src/cli/cli-core/input.ts` | CLI 改为 WebSocket 客户端，发送 input + cwd，接收流式输出和交互请求 |

## 效果对比

| 指标 | 改造前 | 改造后 |
|------|--------|--------|
| 首次 `ai "xxx"` (新目录) | PM2 启动 + Agent 全量初始化 | 同左（PM2 + Agent 初始化，仅首次） |
| 同目录再次执行 | 重复全量初始化（3-10s） | 复用已有 Agent（<50ms） |
| 不同目录执行 | 同上，全部重来 | 各自独立 Agent，互不影响 |
| MCP 连接 | 每次重建 | 同目录内保持，不同目录独立 |
| 依赖加载 | 每次 require 全部包 | 仅首次 |
| 内存管理 | 进程退出即释放 | 空闲超时自动销毁 |
