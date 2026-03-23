const path = require("path");
const fs = require("fs-extra");

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

// 遍历目录和子目录下所有文件
function traverseFiles() {
  try {
    const currentDir = process.cwd();
    const allFiles = [];
    const currentItems = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of currentItems) {
      const itemPath = path.join(currentDir, item.name);
      if (item.isFile()) {
        allFiles.push(itemPath);
        continue;
      }
      if (item.isDirectory()) {
        try {
          const subItems = fs.readdirSync(itemPath, { withFileTypes: true });
          for (const subItem of subItems) {
            if (subItem.isFile()) {
              allFiles.push(path.join(itemPath, subItem.name));
            }
          }
        } catch (subErr) {
          console.warn(`读取子目录失败 ${itemPath}：${subErr.message}`);
        }
      }
    }
    return allFiles;
  } catch (err) {
    console.error(`遍历目录失败：${err.message}`);
    return [];
  }
}

module.exports = {
  aiCliConfig,
  defaultConfig,
  traverseFiles
};
