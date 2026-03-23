const defaultConfig = {
  ai: [],
  currentAi: "",
  maxIterations: -1, // ai完成工作流的最大迭代次数
  maxMessagesLength: 50000, // 最大压缩长度
  maxMessagesCount: 40, // 最大压缩数量
  extensions: [],
  skills:[],
  isRecordHistory: false, // 是否创建工作流执行记录文件,用于因意外终止恢复工作流
  isLog: false, // 是否创建工作流执行日志
};

const aiCliConfig = {
  DeepSeek: {
    baseUrl: "https://api.deepseek.com",
    model: {
      list: ["deepseek-chat", "deepseek-reasoner", "other"],
      defaultValue: "",
    },
    type: 'deepseek',
    apiKey: "",
    temperature: 0.7,
    maxTokens: 8192,
    stream: true,
  },
  Ollama: {
    baseUrl: "http://localhost:11434/v1",
    model: {
      list: [],
      defaultValue: "deepseek-v3.2:cloud",
    },
    type: 'ollama',
    apiKey: "ollama",
    temperature: 0.7,
    maxTokens: 8192,
    stream: true,
  },
  OpenAI: {
    baseUrl: "https://api.openai.com/v1",
    model: {
      list: [],
      defaultValue: "gpt-4",
    },
    type: "openai",
    apiKey: "",
    temperature: 0.7,
    maxTokens: 8192,
    stream: true,
  },
};



module.exports = {
  aiCliConfig,
  defaultConfig,
};
