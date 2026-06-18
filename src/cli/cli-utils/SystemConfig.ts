import path from 'path';
import os from 'os';
import { ModelCompany } from '@/@types/Model';
import { getTrueCwd } from '@/utils/normal';

const HOME_DIR = path.join(os.homedir(), '.deepfish-ai');
const WORKSPACE_DIR = getTrueCwd();
const DEFAULT_CONFIG_JSON5 = `{
  aiList: [],
  currentModel: '', // 当前使用的 AI 配置名称
  maxIterations: -1, // AI 完成工作流的最大迭代次数，-1 表示无限制
  maxMemoryExpireTime: 30, // 整个会话的最大过期时间，单位天，-1 表示无限制，0 表示不记录
  maxLogExpireTime: 3, // 日志过期时间，单位天，-1 表示无限制，0 表示不记录
  maxBlockFileSize: 50, // 最大分块文件大小，单位KB；超过该大小的文件需要分块处理
  encoding: 'auto', // 命令行编码格式，可设置为 utf-8、gbk 等，也可以设置成 auto 或空值自动判断
  maxSubAgentCount: 2, // "最大子agent并行执行数量", -1 表示无限制
  isPrintThinking: true, // 是否打印 AI 思考过程中的中间信息，默认为 true
  serve: {
      port: 8866,
  }
}`;

const ADD_MODEL_Config = {
  DeepSeek: {
    baseUrl: 'https://api.deepseek.com',
    type: ModelCompany.DeepSeek,
    apiKey: 'sk-xxxxxx',
    model: {
      list: ['deepseek-v4-flash', 'deepseek-v4-pro', 'other'],
      defaultValue: 'deepseek-v4-flash',
    },
    temperature: 0.7,
    maxContextLength: 1000000, // 单位tokens
  },
  Ollama: {
    baseUrl: 'http://localhost:11434/v1',
    model: {
      list: [],
      defaultValue: 'deepseek-v3.2:cloud',
    },
    type: ModelCompany.Ollama,
    apiKey: 'sk-ollama',
    temperature: 0.7,
    maxContextLength: 200000, // 单位tokens
  },
  OpenAICompatible: {
    baseUrl: 'http://localhost:11434/v1',
    model: {
      list: [],
      defaultValue: '',
    },
    type: ModelCompany.OpenAICompatible,
    apiKey: 'sk-xxxxxx',
    temperature: 0.7,
    maxContextLength: 200000, // 单位tokens
  },
};

export { HOME_DIR, WORKSPACE_DIR, DEFAULT_CONFIG_JSON5, ADD_MODEL_Config };
