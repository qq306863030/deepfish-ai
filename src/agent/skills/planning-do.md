---
name: 'planning-do'
description: '将复杂长任务拆分为子任务，通过子 Agent 逐步执行完成'
homepage: ''
---

# 长任务规划执行 Skill

当你收到一个复杂的长任务时，使用本 Skill 将其拆分为可执行的子任务，并通过子 Agent 逐步执行完成。

## 工作流程

整个流程分为两个阶段，**必须按顺序执行**：

### 阶段一：创建任务列表

创建一个子 Agent，传入以下系统提示词，让子 Agent 负责将用户目标拆解为子任务：

**子 Agent 系统提示词：**

```
你是任务分析专家，负责将用户的目标拆解为可执行的子任务。

工作流程：
1. 在当前目录创建 tmp_task_goal.md，记录用户的完整目标描述；
2. 创建 tmp_tasklist.json，包含拆解后的子任务列表。

tmp_tasklist.json 格式要求：
- 必须是合法的 JSON 数组
- 每个任务对象包含以下字段：
  - id: 任务唯一标识（字符串或数字）
  - name: 任务名称（简洁明了）
  - description: 任务详细说明
  - status: 任务状态，初始为 "todo"
  - createdAt: 创建时间（ISO 字符串）
  - finishedAt: 完成时间（未完成时为 null）
  - note: 备注（可为空字符串）

拆分原则：
- 任务尽量原子化，每个任务只做一件事
- 任务之间尽量独立，减少依赖
- 按执行顺序排列

输出要求：仅输出合法 JSON，不要输出解释文字。
```

**子 Agent 的用户提示词：** 用户的原始任务描述。

### 阶段二：执行任务列表

创建一个子 Agent，传入以下系统提示词，让子 Agent 负责按顺序执行子任务：

**子 Agent 系统提示词：**

```
你负责按顺序执行 tmp_tasklist.json 中的子任务，完成 tmp_task_goal.md 描述的整体目标。

执行规则：
1. 先读取 tmp_task_goal.md 了解整体目标；
2. 读取 tmp_tasklist.json，仅处理 status 为 "todo" 或 "doing" 的任务；
3. 每次只执行一个子任务，按列表顺序依次执行；
4. 执行前将当前任务 status 更新为 "doing" 并写回文件；
5. 执行成功后更新 status 为 "done"，并记录 finishedAt（ISO 时间）；
6. 执行失败时保留为 "doing" 或回退为 "todo"，在 note 中记录失败原因；
7. 每完成一个子任务必须立即写回 tmp_tasklist.json；
8. 尽量将具体执行工作交给子 agent 完成，主流程只负责调度和状态管理；
9. 告知子 agent 任务列表的文件名为 tmp_tasklist.json；
10. 全部任务完成后，删除 tmp_tasklist.json 和 tmp_task_goal.md。

输出要求：
- 输出当前执行的任务 id、名称、结果状态和下一步计划；
- 不要跳过状态更新和文件写入步骤。
```

**子 Agent 的用户提示词：** 用户的原始任务描述。

```

## 注意事项

1. **必须分两个阶段执行**：先创建任务列表，再执行任务列表，不能合并
2. **子 Agent 只做一件事**：阶段一只负责拆解任务，阶段二只负责按顺序执行
3. **文件持久化**：任务状态通过 `tmp_tasklist.json` 文件持久化，子 Agent 崩溃后可以重新读取继续执行
4. **清理临时文件**：全部任务完成后必须删除 `tmp_tasklist.json` 和 `tmp_task_goal.md`
5. **原子化执行**：每个子任务只做一件事，执行完立即更新状态并写回文件