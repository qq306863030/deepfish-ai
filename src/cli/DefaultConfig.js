const defaultConfig = {
  ai: [],
  currentAi: '',
  maxIterations: -1, // ai完成工作流的最大迭代次数，-1表示无限制
  maxMessagesLength: 150000, // 最大压缩长度，-1表示无限制
  maxMessagesCount: 100, // 最大压缩数量，-1表示无限制
  maxMemoryExpireTime: 30, // 整个会话的最大过期时间，单位天，-1表示无限制, 0表示不记录
  maxLogExpireTime: 3, // 日志过期时间，单位天，-1表示无限制，0表示不记录
  maxBlockFileSize: 20, // 最大分块文件大小，单位KB；超过该大小的文件需要分块处理
  encoding: 'auto', // 命令行编码格式, 可设置为utf-8、gbk等, 也可以设置成auto或空值自动判断
  EMBEDDING_API: '', // 向量化接口地址
  EMBEDDING_API_KEY: '' // 向量化接口密钥
}

const aiCliConfig = {
  DeepSeek: {
    baseUrl: 'https://api.deepseek.com',
    model: {
      list: ['deepseek-chat', 'deepseek-reasoner', 'other'],
      defaultValue: '',
    },
    type: 'deepseek',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 8, // 单位KB
    maxContextLength: 64, // 单位KB
    stream: true,
  },
  MiniMax: {
    baseUrl: 'https://api.minimaxi.com/v1',
    model: {
      list: ['MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.7', 'MiniMax-M2.7-highspeed'],
      defaultValue: 'MiniMax-M2.5',
    },
    type: 'minimax',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 8, // 单位KB
    maxContextLength: 64, // 单位KB
    stream: true,
  },
  Qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: {
      list: ['qwen3.6-plus'],
      defaultValue: 'qwen3.6-plus',
    },
    type: 'qwen',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 8, // 单位KB
    maxContextLength: 64, // 单位KB
    stream: true,
  },
  Ollama: {
    baseUrl: 'http://localhost:11434/v1',
    model: {
      list: [],
      defaultValue: 'deepseek-v3.2:cloud',
    },
    type: 'ollama',
    apiKey: 'ollama',
    temperature: 0.7,
    maxTokens: 8, // 单位KB
    maxContextLength: 64, // 单位KB
    stream: true,
  },
  OpenAI: {
    baseUrl: 'https://api.openai.com/v1',
    model: {
      list: [],
      defaultValue: 'gpt-4',
    },
    type: 'openai',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 8, // 单位KB
    maxContextLength: 64, // 单位KB
    stream: true,
  }
}

module.exports = { aiCliConfig, defaultConfig }
