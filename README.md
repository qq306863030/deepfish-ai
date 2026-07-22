<div align="center" style="display:flex;align-items: center;justify-content: center;">
  <img src="https://github.com/qq306863030/deepfish-ai/blob/master/images/title-img.png" alt="DeepFish" width="300" />
</div>

---

<div align="center" style="line-height: 1">
  <img alt="QQ" src="https://img.shields.io/badge/QQ-306863030-green.svg" />
  <img
    alt="WeChat"
    src="https://img.shields.io/badge/WeChat-MrRoman_123-green.svg"
  />
  <a href="https://github.com/qq306863030/deepfish-ai">
    <img
      alt="GitHub"
      src="https://img.shields.io/badge/GitHub-DeepFish AI-blue.svg"
  /></a>
  <a href="https://www.npmjs.com/package/deepfish-ai">
    <img alt="NPM" src="https://img.shields.io/badge/NPM-DeepFish AI-blue.svg"
  /></a>
  <img
    alt="Code License"
    src="https://img.shields.io/badge/Code_License-MIT-blue"
  />
</div>

<img src="https://github.com/qq306863030/deepfish-ai/blob/master/images/banner.png" alt="banner" style="width:100%;text-align:center;" />

- [English](README_EN.md) | [中文](README.md)

## 目录

- [目录](#目录)
- [1. 介绍](#1-介绍)
- [2. 安装](#2-安装)
  - [前置要求](#前置要求)
  - [通过npm安装](#通过npm安装)
  - [从源码安装](#从源码安装)
- [3. 快速使用](#3-快速使用)
- [4. 命令说明](#4-命令说明)
  - [基础对话](#基础对话)
  - [配置管理](#配置管理)
  - [模型管理](#模型管理)
  - [Skill 管理](#skill-管理)
  - [工具管理](#工具管理)
  - [会话管理](#会话管理)
  - [任务管理](#任务管理)
  - [定时任务管理](#定时任务管理)
  - [长任务规划](#长任务规划)
  - [MCP 管理](#mcp-管理)
  - [服务管理](#服务管理)
  - [缓存管理（AI自我学习的缓存）](#缓存管理ai自我学习的缓存)
- [5. 定时任务使用示例](#5-定时任务使用示例)
  - [定时任务配置文件](#定时任务配置文件)
  - [通过 AI 对话管理定时任务](#通过-ai-对话管理定时任务)
  - [cron 表达式说明](#cron-表达式说明)
- [6. MCP 扩展配置](#6-mcp-扩展配置)
  - [配置示例](#配置示例)
- [7. Tool 与 Skill 扩展说明](#7-tool-与-skill-扩展说明)
  - [当前目录扩展](#当前目录扩展)
  - [全局扩展](#全局扩展)
- [8. 插件说明](#8-插件说明)
  - [SSH 远程控制插件](#ssh-远程控制插件)
- [9. 系统配置文件说明](#9-系统配置文件说明)
  - [配置文件字段](#配置文件字段)
  - [AI 模型配置字段](#ai-模型配置字段)
- [10. 贡献](#10-贡献)
- [11. 许可证](#11-许可证)
- [12. 支持](#12-支持)

## 1. 介绍

一款高效便捷的AI驱动命令行工具，致力于打破自然语言与操作系统指令、文件操作指令之间的壁垒，通过简单的自然语言描述，执行原本复杂的操作，大幅改善工作效率，例如：批量翻译文档、远程控制、安装程序、总结摘要等。Claude、Codex、Copilot、OpenCode这些Agent工具就像滴滴，而这款Agent CLI工具像是共享单车，让你快速抵达操作系统的最后一公里。
核心特性：

- 多模型兼容：无缝支持DeepSeek、Ollama，以及所有遵循OpenAI API规范的AI模型，可根据需求灵活切换，适配不同场景下的指令生成需求。

- 自然语言转指令：精准解析自然语言需求，自动转换为对应的操作系统命令（如Linux、Windows、macOS终端指令）和文件操作指令（如创建、删除、修改文件/目录），无需手动编写复杂命令。

- **Skill 扩展**：Skill 是 AI 的工作流知识包，通过 Markdown 文件定义特定领域的操作流程和最佳实践。安装 Skill 后，AI 能自动遵循其中的规范来执行任务，例如代码审查流程、文档生成模板等。支持兼容 OpenClaw 的 Skill 生态，可通过 `ai skills` 命令进行安装、启用与管理。

- **Tool 扩展**：Tool 是 AI 可调用的自定义函数工具，通过 TypeScript 文件定义。你可以编写 Tool 来扩展 AI 的能力边界，例如调用第三方 API、操作数据库、处理特定文件格式等。支持通过 `ai tools generate` 命令让 AI 自动生成 Tool，降低开发门槛。

- **MCP 扩展**：MCP（Model Context Protocol）是一种标准化的模型上下文协议，允许 AI 连接外部工具和数据源。通过配置 MCP Server，AI 可以获得浏览器自动化、数据库查询、文件系统访问等能力。DeepFish 内置 MCP 支持，只需简单配置即可接入各类 MCP 服务。

- 高度可扩展：支持通过扩展机制拓展功能边界，除基础的终端、文件操作外，可轻松实现翻译、小说创作、文件格式转换、数据处理等复杂任务，满足多样化使用需求。

## 2. 安装

### 前置要求

- Node.js（v22.14.0或更高版本）
- npm或yarn

### 通过npm安装

```bash
npm install -g deepfish-ai --verbose
```

### 从源码安装

```bash
git clone https://github.com/qq306863030/deepfish-ai.git
cd deepfish
npm install
npm link
```

## 3. 快速使用

```bash
ai models add # 输入名称, 输入你的模型配置
ai models use 你输入的名称
ai "帮我在当前目录写一篇关于未来科技的文章，用markdown格式输出"
```

## 4. 命令说明

### 基础对话

```bash
ai "你的问题或指令"
```

直接输入自然语言，AI 将自动解析并执行对应操作。同一个目录下只会保持一个 Agent 会话，如果有这个目录的 Agent 正在运行，再次插入消息会自动进入队列，Agent 会按队列中的消息依次执行。

示例：

```bash
cd your-project
ai "你叫什么名字"
ai "我刚问了一个什么问题"
```

第二次提问时，AI 会基于当前目录中的同一会话上下文回答你刚才问过的问题。

### 配置管理

| 命令              | 说明         |
| ----------------- | ------------ |
| `ai config edit`  | 编辑配置文件 |
| `ai config view`  | 查看当前配置 |
| `ai config reset` | 重置配置     |
| `ai config dir`   | 查看配置目录 |

### 模型管理

| 命令                   | 说明           |
| ---------------------- | -------------- |
| `ai models add`        | 添加新模型     |
| `ai models ls`         | 列出所有模型   |
| `ai models use <name>` | 切换使用的模型 |
| `ai models del <name>` | 删除指定模型   |

### Skill 管理

| 命令                              | 说明               |
| --------------------------------- | ------------------ |
| `ai skills ls`                    | 列出所有 Skill     |
| `ai skills add <name>`            | 添加 Skill         |
| `ai skills del <index>`           | 删除指定 Skill     |
| `ai skills enable <name\|index>`  | 启用 Skill         |
| `ai skills disable <name\|index>` | 禁用 Skill         |
| `ai skills dir`                   | 查看 Skill 目录    |
| `ai skills generate xxx`          | 通过 AI 生成 Skill |

### 工具管理

| 命令                    | 说明                                               |
| ----------------------- | -------------------------------------------------- |
| `ai tools ls`           | 列出所有工具                                       |
| `ai tools dir`          | 查看全局工具目录                                   |
| `ai tools add <name>`   | 添加当前目录下的本地工具目录，可选择本地或全局生效 |
| `ai tools del <index>`  | 按索引删除工具                                     |
| `ai tools generate xxx` | 通过 AI 生成工具                                   |

### 会话管理

| 命令               | 说明         |
| ------------------ | ------------ |
| `ai session clear` | 清除会话历史 |
| `ai session dir`   | 查看会话目录 |

### 任务管理

| 命令                  | 说明         |
| --------------------- | ------------ |
| `ai tasks ls`          | 列出所有任务 |
| `ai tasks add <task>`  | 添加任务     |
| `ai tasks del <index>` | 删除指定任务 |
| `ai tasks clear`       | 清除所有任务 |

### 定时任务管理

定时任务功能支持在指定时间自动执行 AI 任务，基于 cron 表达式按中国时区（Asia/Shanghai）调度。

| 命令                     | 说明                       |
| ------------------------ | -------------------------- |
| `ai time-tasks ls`       | 列出所有定时任务           |
| `ai time-tasks del <id>` | 按 id 删除指定定时任务     |
| `ai time-tasks clear`    | 清空所有定时任务           |

> 定时任务的添加需要通过 AI 工具 `scheduled_task_add` 或 `POST /api/scheduled-task` 接口完成。
> 在执行 `del` 和 `clear` 时，如服务已启动则调用 HTTP 接口，否则直接操作配置文件。

### 长任务规划

| 命令                      | 说明                                       |
| ------------------------- | ------------------------------------------ |
| `ai plan-do <任务描述>`   | 将复杂任务拆解为子任务并逐步执行完成       |
| `ai plan-continue`        | 继续执行被中断的 plan-do 任务              |

### MCP 管理

| 命令                              | 说明             |
| --------------------------------- | ---------------- |
| `ai mcp ls`                       | 列出所有 MCP 服务器 |
| `ai mcp edit`                     | 编辑 MCP 配置    |
| `ai mcp enable <name\|index>`     | 启用 MCP 服务器  |
| `ai mcp disable <name\|index>`    | 禁用 MCP 服务器  |

### 服务管理

| 命令               | 说明     |
| ------------------ | -------- |
| `ai serve`         | 启动服务 |
| `ai serve start`   | 启动服务 |
| `ai serve stop`    | 停止服务 |
| `ai serve restart` | 重启服务 |

### 缓存管理（AI自我学习的缓存）

| 命令                        | 说明       |
| --------------------------- | ---------- |
| `ai cache ls`               | 列出缓存   |
| `ai cache edit <index\|id>` | 编辑缓存项 |
| `ai cache del <index\|id>`  | 删除缓存项 |

## 5. 定时任务使用示例

定时任务功能支持在指定时间自动执行 AI 任务，基于 cron 表达式按中国时区（Asia/Shanghai）调度。

### 定时任务配置文件

定时任务存储在 `~/.deepfish-ai/scheduled-task-list.json`，格式如下：

```json
[
  {
    "id": "uuid",
    "createTime": "2026-07-22T10:00:00+08:00",
    "lastExecTime": "",
    "cron": "0 9 * * 1-5",
    "workspace": "/path/to/project",
    "prompt": "执行每日代码审查"
  }
]
```

### 通过 AI 对话管理定时任务

在 AI 对话中描述需求，AI 会自动调用对应工具完成操作：

**添加定时任务**
```text
> 每天早上9点对 /home/project 目录执行代码审查
```

**查询定时任务**
```text
> 查看有哪些定时任务
> 列出我的所有定时任务
```

**删除定时任务**
```text
> 删除 id 为 xxx 的定时任务
> 把每天早上9点的那个定时任务删掉
```

### cron 表达式说明

cron 表达式包含 5 段，按中国时区计算：

```
┌───────── 分钟 (0-59)
│ ┌───────── 小时 (0-23)
│ │ ┌───────── 日 (1-31)
│ │ │ ┌───────── 月 (1-12)
│ │ │ │ ┌───────── 周 (0-7, 0和7都表示周日)
│ │ │ │ │
* * * * *
```

常见示例：

| cron 表达式 | 说明 |
|------------|------|
| `*/5 * * * *` | 每 5 分钟 |
| `0 9 * * *` | 每天早上 9 点 |
| `0 9,14 * * 1-5` | 工作日早 9 点和下午 2 点 |
| `0 0 1 * *` | 每月 1 号零点 |

## 6. MCP 扩展配置

MCP（Model Context Protocol）允许 AI 连接外部工具和服务。通过 `ai mcp edit` 命令编辑 MCP 配置文件，添加你需要的 MCP Server。

### 配置示例

以下示例配置了 Chrome DevTools MCP Server，使 AI 能够操控浏览器进行自动化操作：

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--autoConnect"]
    }
  }
}
```

配置完成后，AI 将自动加载 MCP Server 提供的工具，你可以在对话中直接让 AI 使用这些能力。

## 7. Tool 与 Skill 扩展说明

DeepFish 支持通过 Tool 和 Skill 扩展 AI 的能力。扩展文件可以放在当前工作目录的 `.deepfish-ai` 目录中，也可以放在全局配置目录中。

- **Tool 扩展**：用于定义 AI 可直接调用的自定义函数工具，适合封装 API 调用、数据库操作、文件处理等能力。可以使用 `ai tools generate xxx` 命令让 AI 根据描述生成 Tool。
  - 在 Tool 函数中，可以通过调用 `this.createSubAgent(prompt: string)` 创建子 Agent，并将任务说明作为 `prompt` 传入。
  - 在 Tool 函数中，可以通过 `this.curAgent` 获取当前正在执行该 Tool 的 Agent 实例；当 Tool 运行在子 Agent 中时，`this.curAgent` 指向该子 Agent，而不是主 Agent。可用于访问当前 Agent 的上下文能力，例如 `this.curAgent.createSubAgent()` 继续创建下级子 Agent。
- **Skill 扩展**：用于定义 AI 的工作流知识包，适合沉淀某类任务的执行步骤、规范和最佳实践。可以使用 `ai skills generate xxx` 命令让 AI 根据描述生成 Skill。

### 当前目录扩展

如果扩展只希望在当前目录下生效，请将扩展拷贝到当前目录的 `.deepfish-ai` 目录中：

```text
当前目录/
└── .deepfish-ai/
    ├── tools/
    │   └── your-tool/
    └── skills/
        └── your-skill/
```

- Tool 扩展放入 `当前目录/.deepfish-ai/tools/`。
- Skill 扩展放入 `当前目录/.deepfish-ai/skills/`。
- 这种方式只对当前目录有效，适合项目级扩展或仅在某个项目中使用的能力。

### 全局扩展

如果扩展希望在所有目录下生效，请将扩展拷贝到全局配置目录中的 `tools` 或 `skills` 目录。

可以通过以下命令打开全局配置目录：

```bash
ai config dir
```

目录结构示例：

```text
全局配置目录/
└── .deepfish-ai/
    ├── tools/
    │   └── your-tool/
    └── skills/
        └── your-skill/
```

- Tool 扩展放入 `全局配置目录/.deepfish-ai/tools/`。
- Skill 扩展放入 `全局配置目录/.deepfish-ai/skills/`。
- 这种方式对全局有效，适合通用工具或长期复用的工作流能力。

## 8. 插件说明

DeepFish 支持通过 npm 全局安装插件来扩展能力。

### SSH 远程控制插件

[@deepfish-ai/deepfish-ssh-remote-control](https://www.npmjs.com/package/@deepfish-ai/deepfish-ssh-remote-control) 是一款 SSH 远程控制插件，让 AI 能够通过 SSH 连接到远程服务器并执行命令，轻松管理远程主机。

安装：

```bash
npm install -g @deepfish-ai/deepfish-ssh-remote-control
```

使用：安装后重启 DeepFish，AI 会自动加载远程控制工具。你可以在对话中直接让 AI 连接到远程服务器执行操作，例如：

```bash
ai “连接到 192.168.1.100，帮我查看服务器状态”
```


## 9. 系统配置文件说明

DeepFish 的系统配置文件位于用户目录下的 `.deepfish-ai/config.json5`，可通过以下命令打开或查看：

```bash
ai config edit
ai config view
```

### 配置文件字段

| 字段                  | 类型      | 默认值   | 说明                                                                    |
| --------------------- | --------- | -------- | ----------------------------------------------------------------------- |
| `aiList`              | `array`   | `[]`     | AI 模型配置列表，可添加多个模型配置。                                   |
| `currentModel`        | `string`  | `''`     | 当前正在使用的 AI 配置名称，对应 `aiList` 中某一项的 `name`。           |
| `maxIterations`       | `number`  | `-1`     | AI 完成工作流的最大迭代次数，`-1` 表示不限制。                          |
| `maxMemoryExpireTime` | `number`  | `30`     | 会话记忆最大保留时间，单位为天；`-1` 表示永久保留，`0` 表示不记录。     |
| `maxLogExpireTime`    | `number`  | `3`      | 日志最大保留时间，单位为天；`-1` 表示永久保留，`0` 表示不记录。         |
| `maxBlockFileSize`    | `number`  | `50`     | 最大分块文件大小，单位为 KB；超过该大小的文件会按块处理。               |
| `encoding`            | `string`  | `'auto'` | 命令行输出编码，可设置为 `utf-8`、`gbk` 等；`auto` 或空值表示自动判断。 |
| `maxSubAgentCount`    | `number`  | `2`      | 最大并行子 Agent 数量，`-1` 表示不限制。                                |
| `isPrintThinking`     | `boolean` | `true`   | 是否打印 AI 思考过程中的中间信息。                                      |
| `isUseMemory`         | `boolean` | `true`   | 是否使用记忆功能，AI 会从历史对话中学习并优化回答。                     |
| `serve.port`          | `number`  | `8866`   | DeepFish 本地服务端口。                                                 |

### AI 模型配置字段

`aiList` 中的每一项表示一个 AI 模型配置，常见字段如下：

| 字段               | 类型     | 说明                                                            |
| ------------------ | -------- | --------------------------------------------------------------- |
| `name`             | `string` | 模型配置名称，用于 `ai models use <name>` 切换模型。            |
| `type`             | `string` | 模型供应商类型，例如 `DeepSeek`、`Ollama`、`OpenAICompatible`。 |
| `baseUrl`          | `string` | 模型 API 地址。                                                 |
| `model`            | `string` | 实际调用的模型名称。                                            |
| `apiKey`           | `string` | 模型 API Key。                                                  |
| `temperature`      | `number` | 生成随机性参数，数值越高输出越发散，数值越低输出越稳定。        |
| `maxContextLength` | `number` | 模型最大上下文长度，单位为 tokens。                             |
| `isVision`         | `boolean` | 是否支持图像识别，默认 `false`。                               |

## 10. 贡献

欢迎贡献！请随时提交Pull Request。

## 11. 许可证

本项目采用MIT许可证 - 详见[LICENSE](LICENSE)文件。

## 12. 支持

如有问题和疑问，请在GitHub仓库上提交issue。
