## 开发计划

### 配置文件

```js
module.exports = {
  aiList: [
    // AI 配置列表，可配置多个 AI
    {
      name: 'minimax', // AI 配置名称，用于标识
      type: 'openai', // AI 类型：openai/deepseek/minimax/qwen/ollama/copilot
      baseUrl: 'http://10.1.111.154:3001/v1', // API 地址
      model: 'MiniMax-M2.7', // 模型名称
      apiKey: '', // API 密钥
      temperature: 0.7, // 温度参数
      maxContextLength: 128, // 单位KB，最大上下文长度
    },
    {
      name: 'deepseek',
      type: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: '',
      temperature: 0.7,
      maxContextLength: 64, // 单位KB
    },
  ],
  currentModel: 'deepseek', // 当前使用的 AI 配置名称
  maxIterations: -1, // AI 完成工作流的最大迭代次数，-1 表示无限制
  maxMemoryExpireTime: 30, // 整个会话的最大过期时间，单位天，-1 表示无限制，0 表示不记录
  maxLogExpireTime: 3, // 日志过期时间，单位天，-1 表示无限制，0 表示不记录
  maxBlockFileSize: 50, // 最大分块文件大小，单位KB；超过该大小的文件需要分块处理
  encoding: 'auto', // 命令行编码格式，可设置为 utf-8、gbk 等，也可以设置成 auto 或空值自动判断
  maxSubAgentCount: 2, // "最大子agent并行执行数量", -1 表示无限制
  isPrintThinking: true,
  serve: {
    port: 8866,
  },
};
```

### 命令

```bash
ai "xxx"

# Configuration commands
ai config edit
ai config view
ai config reset
ai config dir

# Model commands
ai models add # Add a new AI configuration
ai models ls # List all AI configurations
ai models use <name> # Set the specified AI configuration as the current one
ai models del <name> # Delete the specified AI configuration

# Skill commands
ai skills ls # List all registered skills
ai skills add <name> # Add a local skill directory from the current directory
ai skills del <index> # Remove a skill by name or index, exp: ai skill del 1
ai skills enable <name|index> # Enable a skill by name or index, exp: ai skill enable 1
ai skills disable <name|index> # Disable a skill by name or index, exp: ai skill disable 1
ai skills dir # Open the skill directory
ai skills generate xxx

# Tools commands
ai tools ls
ai tools dir # Open the skill directory
ai tools add <name>
ai tools del <index>
ai tools generate xxx

# Session commands
ai session clear # Clear the history messages for the current directory
ai session dir # Open the memory directory

ai tasks ls
ai tasks add <task>
ai tasks del <index>
ai tasks clear

ai plan-do xxx
ai plan-continue

ai mcp edit
ai mcp ls
ai mcp enable <index|name>
ai mcp disable <index|name>

ai serve # 启动服务，并打开页面
ai serve start # 启动服务
ai serve open # 打开页面
ai serve stop # 停止服务
ai serve restart # 重启服务

ai cache ls # 显示[index] [id] [description前20个字,超过20字用...代替]
ai cache edit <index|id>
ai cache del <index|id>
```

### 扩展

skills
tools
mcp

### 新的.deepfish目录结构

```
-config.json5
-mcp.json
-user
    -memory.md
    -user-info.md
    -agent-rules.md
    -cache
-skills
    -skill1
    -skill2
    ...
    -register.json
-tools
    -tool1
    -tool2
    ...
    -register.json
-sessions
    -sessions.json // 目录和agentId的映射表
    -[agentId]
      -main-session // 主agent的记忆数据
      -main-msg-queue.json // 主agent的消息队列
```

