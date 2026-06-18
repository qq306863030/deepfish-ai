import { ModelCompany } from './Model';

export type Session = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  workspace: string;
  status?: 0 | 1;
};

export type ServeConfig = {
  port: number;
};

export type AIConfig = {
  name: string; // AI 配置名称，用于标识
  type: ModelCompany; // AI 类型：openai/deepseek/minimax/qwen/ollama/copilot
  baseUrl: string; // API 地址
  model: string; // 模型名称
  apiKey: string; // API 密钥
  temperature: number; // 温度参数
  maxContextLength: number; // 单位KB，最大上下文长度
};

export type ConfigFile = {
  aiList: AIConfig[]; // AI 配置列表
  currentModel: string; // 当前使用的 AI 配置名称
  maxIterations: number; // AI 完成工作流的最大迭代次数，-1 表示无限制
  maxMemoryExpireTime: number; // 整个会话的最大过期时间，单位天，-1 表示无限制，0 表示不记录
  maxLogExpireTime: number; // 日志过期时间，单位天，-1 表示无限制，0 表示不记录
  maxBlockFileSize: number; // 最大分块文件大小，单位KB；超过该大小的文件需要分块处理
  encoding: 'auto' | 'utf-8' | 'gbk' | ''; // 命令行编码格式，可设置为 utf-8、gbk 等，也可以设置成 auto 或空值自动判断
  maxSubAgentCount: number; // "最大子agent并行执行数量", -1 表示无限制
  serve: ServeConfig;
  isPrintThinking: boolean; // 是否打印 AI 思考过程中的中间信息，默认为 true
};

export type TaskQueueItem = {
  id: string;
  taskStr: string;
  createTime: string;
};

export type Catalog = {
  id: string;
  description: string;
};
