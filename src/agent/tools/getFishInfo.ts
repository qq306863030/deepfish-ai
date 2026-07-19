import { tool } from 'langchain';
import { z } from 'zod';
import { getCodePath, getConfigPath, getMCPFilePath } from '@/cli/cli-utils/getGlobalPath';
import { helpInformation } from '@/cli/cli-help';
import { safeTool } from './utils';
import path from 'path';
import fs from 'fs-extra';

/**
 * 获取 Deepfish CLI 系统代码路径
 */
const getFishCodePathTool = tool(
  async () =>
    safeTool(() => {
      const codePath = getCodePath();
      return { codePath };
    }),
  {
    name: 'get_fish_code_path',
    description: '获取 Deepfish CLI 系统的代码根目录路径',
    schema: z.object({}),
  },
);

/**
 * 获取 Deepfish CLI 系统的 README 内容，用于了解系统功能信息
 */
const getFishReadmeTool = tool(
  async ({ lang }) =>
    safeTool(() => {
      const codePath = getCodePath();
      // 优先读取中文 README，其次英文
      const readmePath = lang === 'en'
        ? path.join(codePath, 'README_EN.md')
        : path.join(codePath, 'README.md');
      const fallbackPath = lang === 'en'
        ? path.join(codePath, 'README.md')
        : path.join(codePath, 'README_EN.md');

      let targetPath = readmePath;
      if (!fs.existsSync(targetPath)) {
        targetPath = fallbackPath;
      }
      if (!fs.existsSync(targetPath)) {
        return { error: '未找到 README 文件', readmePath: targetPath };
      }
      const content = fs.readFileSync(targetPath, 'utf-8');
      return { readmePath: targetPath, content };
    }),
  {
    name: 'get_fish_readme',
    description: '获取 Deepfish CLI 系统的 README 文件内容，用于了解系统的功能、用法和特性。可选参数 lang 指定语言（zh 或 en），默认中文。',
    schema: z.object({
      lang: z.string().optional().default('zh').describe('语言，zh 为中文 README，en 为英文 README'),
    }),
  },
);

/**
 * 获取 Deepfish CLI 系统的命令帮助信息
 */
const getFishHelpTool = tool(
  async () =>
    safeTool(() => {
      const help = helpInformation();
      return { help };
    }),
  {
    name: 'get_fish_help',
    description: '获取 Deepfish CLI 系统的所有可用命令及使用说明，包括配置、模型、技能、工具、会话、任务、MCP、服务、缓存等子命令的详细用法',
    schema: z.object({}),
  },
);

/**
 * 获取 MCP 配置文件路径
 */
const getFishMCPPathTool = tool(
  async () =>
    safeTool(() => {
      const mcpPath = getMCPFilePath();
      return { mcpPath };
    }),
  {
    name: 'get_fish_mcp_path',
    description: '获取 MCP（Model Context Protocol）配置文件的路径，用于了解 MCP 服务器的配置文件位置',
    schema: z.object({}),
  },
);

/**
 * 获取 MCP 配置添加说明
 */
const getFishMCPHelpTool = tool(
  async () =>
    safeTool(() => {
      const mcpPath = getMCPFilePath();
      const help = `# MCP 配置说明

## 配置文件路径
${mcpPath}

## 添加说明
MCP（Model Context Protocol）是一种让 AI 模型能够调用外部工具和服务的协议。
你可以在 mcp.json 文件的 mcpServers 字段中添加新的 MCP 服务器配置。

## 支持的 type 类型
- **stdio**: 通过标准输入/输出启动子进程通信，需要配置 command 和 args
- **http**: 通过 HTTP/HTTPS 协议连接远程 MCP 服务，需要配置 url

## 字段说明
- type: MCP 服务器类型，支持 stdio（默认）和 http
- command: 启动 MCP 服务器的可执行命令（stdio 类型必填）
- args: 传递给命令的参数数组
- url: HTTP 类型 MCP 服务的地址（http 类型必填）
- headers: HTTP 请求头配置（http 类型可选）
- env: 环境变量配置（可选）
- timeoutMs: 超时时间（毫秒，可选）
- disabled: 是否禁用（可选，true 表示禁用）

## 示例配置
\`\`\`json
{
  "mcpServers": {
    "stdio-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@example/mcp-server"],
      "timeoutMs": 30000,
      "disabled": false
    },
    "http-server": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer your-token"
      },
      "disabled": false
    }
  }
}
\`\`\`

## 注意事项
- type 不填时默认为 stdio 类型
- 通过将 disabled 设为 true 可临时禁用某个 MCP 服务器
      }
    }
  }
}
\`\`\`

## 注意事项
- command: 启动 MCP 服务器的可执行命令
- args: 传递给命令的参数数组
- env: 可选的环境变量配置
`;
      return { mcpPath, help };
    }),
  {
    name: 'get_fish_mcp_help',
    description: '获取 MCP 配置的添加说明、配置文件路径和示例配置，用于指导如何添加新的 MCP 服务器',
    schema: z.object({}),
  },
);

/**
 * 获取 Deepfish 配置文件路径
 */
const getFishConfigPathTool = tool(
  async () =>
    safeTool(() => {
      const configPath = getConfigPath();
      return { configPath };
    }),
  {
    name: 'get_fish_config_path',
    description: '获取 Deepfish CLI 系统的主配置文件路径（config.json5），用于了解系统配置的存储位置',
    schema: z.object({}),
  },
);

/**
 * 获取 Deepfish 配置文件修改说明
 */
const getFishConfigHelpTool = tool(
  async () =>
    safeTool(() => {
      const configPath = getConfigPath();
      const help = `# Deepfish CLI 配置说明

## 配置文件路径
${configPath}

## 配置字段说明

### AI 配置 (aiList)
AI 配置列表，可配置多个 AI 模型提供商，每个配置包含：
- name: AI 配置名称，用于标识
- type: AI 类型，可选值：openai / deepseek / minimax / qwen / ollama / copilot
- baseUrl: API 地址
- model: 模型名称
- apiKey: API 密钥
- temperature: 温度参数
- maxContextLength: 最大上下文长度（单位 KB）

### 基础配置
- currentModel: 当前使用的 AI 配置名称（对应 aiList 中的 name）
- maxIterations: AI 完成工作流的最大迭代次数，-1 表示无限制
- maxSubAgentCount: 最大子 agent 并行执行数量，-1 表示无限制

### 存储与过期
- maxMemoryExpireTime: 整个会话的最大过期时间（单位天），-1 表示无限制，0 表示不记录
- maxLogExpireTime: 日志过期时间（单位天），-1 表示无限制，0 表示不记录
- maxBlockFileSize: 最大分块文件大小（单位 KB），超过该大小的文件需要分块处理

### 编码与输出
- encoding: 命令行编码格式，可选值：auto / utf-8 / gbk / 空字符串
- isPrintThinking: 是否打印 AI 思考过程中的中间信息，默认为 true
- isUseMemory: 是否使用记忆功能

### 服务配置 (serve)
- port: 服务端口号
`;
      return { configPath, help };
    }),
  {
    name: 'get_fish_config_help',
    description: '获取 Deepfish CLI 系统配置文件的修改说明，包括配置文件路径、所有配置字段的详细说明和可选值',
    schema: z.object({}),
  },
);

export const fishInfoTools = [getFishCodePathTool, getFishReadmeTool, getFishHelpTool, getFishMCPPathTool, getFishMCPHelpTool, getFishConfigPathTool, getFishConfigHelpTool];
