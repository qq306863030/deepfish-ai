const path = require("path");
const os = require("os");
const fs = require("fs-extra");
const { logError, logSuccess, askConfirm } = require("../core/utils/log");
const { cloneDeep } = require("lodash");

const defaultConfig = {
  ai: [],
  currentAi: "",
  maxIterations: -1, // ai完成工作流的最大迭代次数
  maxMessagesLength: 50000, // 最大压缩长度
  maxMessagesCount: 40, // 最大压缩数量
  extensions: [],
  isRecordHistory: false, // 是否创建工作流执行记录文件,用于因意外终止恢复工作流
  isLog: false, // 是否创建工作流执行日志
};

const aiCliConfig = {
  DeepSeek: {
    baseUrl: "https://api.deepseek.com",
    model: {
      list: ["deepseek-chat", "deepseek-reasoner", "Other"],
      defaultValue: "",
    },
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
    apiKey: "",
    temperature: 0.7,
    maxTokens: 8192,
    stream: true,
  },
};

// 获取默认配置
function getDefaultConfig() {
  return cloneDeep(defaultConfig);
}
// 获取默认配置内容
function getDefaultConfigContent() {
  return `module.exports = ${JSON.stringify(getDefaultConfig(), null, 2)}`;
}

// 获取配置文件所在目录
function getConfigPath() {
  const configDir = path.join(os.homedir(), "./.deepfish-ai");
  const configPath = path.join(configDir, "./config.js");
  fs.ensureDirSync(configDir);
  // 判断之前版本的配置文件是否存在，如果存在则迁移到新目录
  if (fs.pathExistsSync(path.join(os.homedir(), ".ai-cmd.config.js"))) {
    fs.moveSync(path.join(os.homedir(), ".ai-cmd.config.js"), configPath);
  }
  return configPath;
}

// 获取配置
function getConfig() {
  const configPath = getConfigPath();
  if (fs.pathExistsSync(configPath)) {
    const userConfig = require(configPath);
    return userConfig;
  } else {
    logError(
      `User config file not found: ${configPath}. Please run 'ai config reset' first.`,
    );
  }
  return null;
}

// 判断配置文件是否存在，如果不存在则创建默认文件
async function checkConfigFile() {
  const userConfigPath = getConfigPath();
  const isCreateConfig = await askConfirm(
    "createConfig",
    "Would you like to create a configuration file now?",
    true,
  );
  if (isCreateConfig) {
    // Create new configuration file with empty ai array
    console.log("Creating new configuration file:", userConfigPath);
    const newConfig = getDefaultConfig();
    const configContent = `module.exports = ${JSON.stringify(newConfig, null, 2)}`;
    fs.writeFileSync(userConfigPath, configContent);
    console.log("Configuration file created with empty AI configurations.");
  }
}

// 写入配置
function writeConfig(config) {
  if (!config) {
    config = getDefaultConfig();
  }
  const configPath = getConfigPath();
  fs.writeFileSync(
    configPath,
    `module.exports = ${JSON.stringify(config, null, 2)}`,
  );
}

async function handleMissingConfig() {
  logError("Configuration file not initialized");
  // Create new configuration file with empty ai array
  console.log("Creating new configuration file:", getConfigPath());
  checkConfigFile();
  console.log("Configuration file created with empty AI configurations.");
}

// 添加扩展
function addExtensionToConfig(fileName) {
  // 检查 fileName 是否为空
  if (!fileName) {
    logError("Extension file name is required.");
    return;
  }
  const filePath = path.resolve(process.cwd(), fileName);
  // 判断是否路径是文件还是目录
  if (fs.statSync(filePath).isDirectory()) {
    // 扫描目录和子目录下所有js、cjs文件
    const files = traverseFiles();
    const jsFiles = files.filter(
      (file) => file.endsWith(".js") || file.endsWith(".cjs"),
    );
    jsFiles.forEach((jsFile) => {
      // 读取文件，查询文件内是否存在‘descriptions’和‘functions’
      const fileContent = fs.readFileSync(jsFile, "utf-8");
      if (
        fileContent.includes("descriptions") &&
        fileContent.includes("functions")
      ) {
        addExtensionToConfig(jsFile);
      }
    });
    return;
  }
  // 判断文件是否存在
  if (!fs.existsSync(filePath)) {
    logError(`File not found: ${filePath}`);
    return;
  }
  const userConfig = getConfig();
  if (!userConfig) {
    return;
  }
  // 数组去重
  userConfig.extensions = [...new Set(userConfig.extensions)];
  writeConfig(userConfig);
  logSuccess(`Extension added to config: ${filePath}.`);
}

// 移除扩展
function removeExtensionFromConfig(fileName) {
  const userConfig = getConfig();
  if (!userConfig) {
    return;
  }
  // 增加对数字索引的支持
  if (!isNaN(Number(fileName))) {
    const extIndex = Number(fileName);
    if (extIndex < 0 || extIndex >= userConfig.extensions.length) {
      logError(`Invalid extension index: ${extIndex}`);
      return;
    }
    const filePath = userConfig.extensions.splice(extIndex, 1);
    writeConfig(userConfig);
    logSuccess(
      `Extension removed from config: ${filePath}.You can run 'ai ext ls' to view the changes.`,
    );
    return;
  }
  const filePath = path.resolve(process.cwd(), fileName);
  // 判断文件是否存在
  if (!fs.existsSync(filePath)) {
    logError(`File not found: ${filePath}`);
    return;
  }
  if (userConfig.extensions && Array.isArray(userConfig.extensions)) {
    userConfig.extensions = userConfig.extensions.filter(
      (ext) => ext !== filePath,
    );
  }
  writeConfig(userConfig);
  logSuccess(
    `Extension removed from config: ${filePath}.You can run 'ai ext ls' to view the changes.`,
  );
}

// 查看扩展列表
function viewExtensionsFromConfig() {
  const userConfig = getConfig();
  if (!userConfig) {
    return;
  }
  if (userConfig.extensions && Array.isArray(userConfig.extensions)) {
    console.log("=".repeat(50));
    // 打印扩展列表，并加上索引
    if (userConfig.extensions.length === 0) {
      console.log(`No extensions in config.`);
    } else {
      console.log("Extensions in config:");
      userConfig.extensions.forEach((ext, index) => {
        console.log(`[${index}] ${ext}`);
      });
    }
    console.log("=".repeat(50));
  } else {
    logSuccess(`No extensions in config.`);
  }
}

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
  getDefaultConfig,
  addExtensionToConfig,
  removeExtensionFromConfig,
  viewExtensionsFromConfig,
  getConfigPath,
  aiCliConfig,
  getDefaultConfigContent,
  getConfig,
  writeConfig,
  checkConfigFile,
  handleMissingConfig,
};
