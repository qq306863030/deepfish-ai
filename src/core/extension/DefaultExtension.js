/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-17 11:59:19
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-20 14:41:07
 * @FilePath: \deepfish\src\core\extension\DefaultExtension.js
 * @Description: 默认扩展函数
 * @
 */
const path = require("path");
const { logError, logSuccess, logInfo, getConfigPath } = require("../utils");
const fs = require("fs-extra");
const shelljs = require("shelljs");
const iconv = require("iconv-lite"); // 用于编码转换
const os = require("os"); // 用于判断系统类型
const { cloneDeep } = require("lodash");
const { aiRequestSingle } = require("../ai-services/AiWorker/AiTools");

// 执行系统命令
// 执行系统命令（全平台兼容：Windows/PowerShell/CentOS）
async function executeCommand(command) {
  return new Promise((resolve, reject) => {
    logSuccess(`Executing system command: ${command}`);
    const platform = os.platform();
    const targetEncoding = platform === "win32" ? "gbk" : "utf-8"; // Windows(含PowerShell)用gbk，Linux/macOS用utf-8
    shelljs.exec(
      command,
      {
        async: true,
        cwd: process.cwd(),
        encoding: "binary",
        silent: true,
      },
      (code, stdout, stderr) => {
        try {
          let stdoutUtf8 = iconv.decode(
            Buffer.from(stdout, "binary"),
            targetEncoding,
          );
          const stderrUtf8 = iconv.decode(
            Buffer.from(stderr, "binary"),
            targetEncoding,
          );
          if (stderrUtf8 && !stderrUtf8.trim().startsWith("WARNING")) {
            // 过滤无关警告
            const error = new Error(
              `Command failed (code ${code}): ${stderrUtf8}`,
            );
            logError(`Execute error: ${error.message}`);
            reject(error);
            return;
          }
          if (stdoutUtf8 === "undefined") {
            stdoutUtf8 = "";
          }
          logSuccess(`${stdoutUtf8} \n Command executed successfully`);
          resolve(stdoutUtf8 || "Command executed successfully");
        } catch (decodeError) {
          logError(`Encoding convert error: ${decodeError.message}`);
          reject(
            new Error(`Failed to parse command output: ${decodeError.message}`),
          );
        }
      },
    );
  });
}

// 请求ai服务
async function requestAI(
  systemDescription,
  prompt,
  temperature = this.aiConfig.temperature,
) {
  logSuccess(`Requesting AI`);
  if (
    typeof systemDescription === "object" &&
    systemDescription.systemDescription
  ) {
    prompt = systemDescription.prompt || prompt || "";
    systemDescription = systemDescription.systemDescription || "";
  }
  try {
    logInfo(`aiSystem: ${systemDescription}`);
    logInfo(`aiPrompt: ${prompt}`);
    let aiConfig = this.aiConfig;
    if (temperature !== aiConfig.temperature) {
      aiConfig = cloneDeep(aiConfig);
      aiConfig.temperature = temperature;
    }
    const response = await aiRequestSingle(
      this.aiService.client,
      aiConfig,
      systemDescription,
      prompt,
    );
    logInfo(`aiResponse: ${response}`);
    return response;
  } catch (error) {
    logError(`Error executing AI function: ${error.message}`);
    throw error;
  }
}

// 执行js代码
async function executeJSCode(code) {
  logSuccess("Executing JavaScript code: ");
  logSuccess(code);

  try {
    const { functions } = this.extensionManager.extensions;
    const Func = new Function(
      "Tools",
      "require",
      `return (async () => {
          this.logMessages = []
          const originalLog = console.log
          const newLog = function () {
            originalLog.apply(console, arguments)
            this.logMessages.push(Array.from(arguments).join(' '))
          }
          console.log = newLog.bind(this)
          ${code}
          console.log = originalLog
          return this.logMessages.join('\\n')
        })()`,
    );
    const originalRequire = require;
    const newRequire = (modulePath) => {
      if (modulePath.startsWith("./")) {
        const resolvedPath = path.resolve(".", modulePath);
        return originalRequire(resolvedPath);
      }
      return originalRequire(modulePath);
    };

    const result = await Func(functions, newRequire);
    
    return result || "";
  } catch (error) {
    logError(`Error executing code: ${error.stack}`);
    throw error;
  }
}
// 生成一个扩展函数文件 关键字：内置函数、扩展工具
async function getExtensionFileRule(goal) {
  const newGoal = `
### 任务目标
基于指定规则创建一个标准化的Node.js NPM项目，实现用户目标：${goal}，最终输出符合AI工作流调用规范的函数模块，并配套中英文说明文档。

### 第一步：项目初始化
1. 目录创建：新建目录，目录名称为「项目功能名称」，作为NPM项目根目录
2. package.json配置：
   - name字段值：@deepfish-ai/项目功能名称（替换「项目功能名称」为实际功能名）
   - git仓库地址：固定为 https://github.com/qq306863030/deepfish-extensions.git
3. 主文件：项目入口文件必须命名为index.js
4. 文档文件：项目根目录需新增2个文档文件：
   - README_CN.md（中文说明文档）
   - README.md（英文说明文档）

### 第二步：index.js 完整开发规范
#### 2.1 核心输出要求
文件需输出两个核心字段，且代码逻辑清晰、可运行：
- descriptions：数组类型，每个元素为OpenAI可识别的函数描述对象
- functions：对象类型，key为函数名称，value为函数方法体

#### 2.2 开发强制规则
1. 参数一致性：functions中函数的入参，必须与descriptions中对应函数声明的parameters完全一致
2. 命名规范：
   - 函数名称前缀：「领域用途+分隔符」（如systemFileManagement_）
   - 函数描述开头：统一格式「领域用途+分隔符+功能描述」（如系统文件管理:重命名文件）
3. 内置工具调用：函数内部可直接使用this.Tools下的内置方法，示例：
   - this.Tools.requestAI(systemDescription, prompt, temperature)
   - this.Tools.readFile(filePath)
   - 其他文件处理类内置函数（运行时自动注入）
4. 函数数量：至少包含1个可被AI工作流调用的函数

#### 2.3 基础代码模板（必须遵循）
const descriptions = []
const functions = {}
module.exports = {
  descriptions,
  functions,
}

#### 2.4 参考示例（可参考格式）
const descriptions = [
  {
    name: 'systemFileManagement_renameFile',
    description: '系统文件管理:重命名文件',
    parameters: {
      type: 'object',
      properties: {
        oldPath: { type: 'string', description: '旧文件路径' },
        newPath: { type: 'string', description: '新文件路径' },
      },
    },
  },
]
const functions = {
  systemFileManagement_renameFile: (oldPath, newPath) => {
    return this.Tools.rename(oldPath, newPath)
  },
}
module.exports = {
  descriptions,
  functions,
}

### 第三步：README文档规范
#### 3.1 通用要求
- 两个文档需包含「中英文切换标签」（如文档顶部标注「English | 中文」/「中文 | English」）
- 结构保持一致，仅语言不同，核心模块顺序不可调整
- 文件名称README_CN.md（中文）、README.md（英文）

#### 3.2 核心模块
1. 总体功能描述：
   - 清晰说明当前NPM包的核心定位、整体功能价值、适用场景
   - 语言简洁易懂，无需技术细节，聚焦「做什么」而非「怎么做」
2. 快速开始：
   - 明确说明安装步骤，顺序不可颠倒：
     ① 先安装deepfish-ai全局库：npm install deepfish-ai -g
     ② 再安装当前项目库：npm install @deepfish-ai/项目功能名称 -g
3. 函数列表及功能描述：
   - 列出当前项目中所有函数名称
   - 对应说明每个函数的核心功能
   - 无需编写各个函数的具体使用方法
  `;
  return newGoal;
}

// 获取ai的配置
function getAiConfig() {
  return cloneDeep(this.aiConfig);
}

// 获取ai的配置文件所在目录
function getAiConfigPath() {
  return getConfigPath();
}

async function createFile(filePath, content) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    const dirPath = path.dirname(fullPath);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(fullPath, content);
    return true;
  } catch (error) {
    return false;
  }
}

async function modifyFile(filePath, content) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
      return false;
    }

    fs.writeFileSync(fullPath, content);
    return true;
  } catch (error) {
    return false;
  }
}

async function readFile(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const content = fs.readFileSync(fullPath, "utf8");
    return content;
  } catch (error) {
    return null;
  }
}

async function appendToFile(filePath, content) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
      return false;
    }

    fs.appendFileSync(fullPath, content);
    return true;
  } catch (error) {
    return false;
  }
}

function fileExists(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath);
  return fs.existsSync(fullPath);
}

async function createDirectory(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function deleteFile(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function deleteDirectory(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath);

    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function rename(oldPath, newPath) {
  try {
    const fullOldPath = path.resolve(process.cwd(), oldPath);
    const fullNewPath = path.resolve(process.cwd(), newPath);

    if (fs.existsSync(fullOldPath)) {
      fs.renameSync(fullOldPath, fullNewPath);
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function moveFile(sourcePath, destinationPath) {
  try {
    const fullSourcePath = path.resolve(process.cwd(), sourcePath);
    const fullDestPath = path.resolve(process.cwd(), destinationPath);
    const destDirPath = path.dirname(fullDestPath);

    if (!fs.existsSync(destDirPath)) {
      fs.mkdirSync(destDirPath, { recursive: true });
    }

    if (fs.existsSync(fullSourcePath)) {
      fs.renameSync(fullSourcePath, fullDestPath);
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function getFileInfo(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const stats = fs.statSync(fullPath);
    return {
      path: fullPath,
      size: stats.size,
      birthtime: stats.birthtime,
      mtime: stats.mtime,
      ctime: stats.ctime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
    return null;
  }
}

async function getFileNameList(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      return [];
    }
    const files = fs
      .readdirSync(fullPath)
      .filter((file) => file !== "ai-history" && file !== "ai-log");
    return files;
  } catch (error) {
    return [];
  }
}

async function clearDirectory(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath);

    if (!fs.existsSync(fullPath)) {
      return false;
    }

    if (!fs.statSync(fullPath).isDirectory()) {
      return false;
    }

    const files = fs.readdirSync(fullPath);

    for (const file of files) {
      const filePath = path.join(fullPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

const descriptions = [
  {
    type: "function",
    function: {
      name: "executeCommand",
      description:
        '执行系统命令，返回执行结果。适用于运行shell命令、系统工具等。命令执行失败时会抛出错误，成功时返回命令执行结果字符串或"System command executed successfully"。',
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "requestAI",
      description:
        "请求AI服务处理简单任务，如随机生成一段话、翻译文本、数学计算、代码分析、知识检索等。通过systemDescription参数指定AI的行为和限制，prompt参数输入任务描述, temperature参数指定AI的温度（0-2之间的浮点数，默认为用户配置）。返回AI处理后的结果字符串，执行失败时会抛出错误。",
      parameters: {
        type: "object",
        properties: {
          systemDescription: { type: "string" },
          prompt: { type: "string" },
          temperature: { type: "number" },
        },
        required: ["systemDescription", "prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "executeJSCode",
      description:
        '执行JavaScript代码，返回代码执行结果。代码中可通过Tools命名空间直接调用其他工具函数（如await Tools.createFile(),注意：不需要使用require引入）,Tools中引入了一些常用库可直接调用（Tools.fs="fs-extra", Tools.dayjs="dayjs", Tools.axios="axios", Tools.lodash="lodash"），支持引入自定义模块（需使用绝对路径）。注意：1.代码中不要使用__dirname获取当前目录，请使用path.resolve(".")来获取当前目录。2.执行失败时会抛出错误，成功时返回代码执行结果或空字符串。',
      parameters: {
        type: "object",
        properties: {
          code: { type: "string" },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createFile",
      description:
        "创建一个包含指定内容的新文件，返回布尔值表示操作是否成功。如果目录不存在会自动创建目录结构。",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
          content: { type: "string" },
        },
        required: ["filePath", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "modifyFile",
      description:
        "修改指定文件的内容，返回布尔值表示操作是否成功。如果文件不存在则返回false。",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
          content: { type: "string" },
        },
        required: ["filePath", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "readFile",
      description:
        "读取指定文件的内容，返回文件内容字符串。如果文件不存在或读取失败则返回null。",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "appendToFile",
      description:
        "向指定文件追加内容，返回布尔值表示操作是否成功。如果文件不存在则返回false。",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
          content: { type: "string" },
        },
        required: ["filePath", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fileExists",
      description: "检查指定文件是否存在，返回布尔值。",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createDirectory",
      description:
        "创建一个新目录，返回布尔值表示操作是否成功。支持递归创建目录结构。",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string" },
        },
        required: ["dirPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteFile",
      description:
        "删除指定文件，返回布尔值表示操作是否成功。如果文件不存在也会返回true。",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteDirectory",
      description:
        "删除指定目录，返回布尔值表示操作是否成功。支持递归删除目录及其内容。如果目录不存在也会返回true。",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string" },
        },
        required: ["dirPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rename",
      description:
        "重命名文件或目录，返回布尔值表示操作是否成功。如果原文件不存在也会返回true。",
      parameters: {
        type: "object",
        properties: {
          oldPath: { type: "string" },
          newPath: { type: "string" },
        },
        required: ["oldPath", "newPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moveFile",
      description:
        "移动文件，返回布尔值表示操作是否成功。如果目标目录不存在会自动创建。如果源文件不存在也会返回true。",
      parameters: {
        type: "object",
        properties: {
          sourcePath: { type: "string" },
          destinationPath: { type: "string" },
        },
        required: ["sourcePath", "destinationPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getFileInfo",
      description:
        "获取指定文件的信息，返回文件信息对象。如果文件不存在或获取失败则返回null。返回对象包含path、size、birthtime、mtime、ctime、isFile、isDirectory等属性。",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getFileNameList",
      description:
        "获取指定目录下的所有文件名，返回文件名数组。如果目录不存在或不是目录则返回空数组。",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string" },
        },
        required: ["dirPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clearDirectory",
      description:
        "清空指定目录的内容，返回布尔值表示操作是否成功。如果目录不存在或不是目录则返回false。",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string" },
        },
        required: ["dirPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getExtensionFileRule",
      description:
        "如果用户需要为本程序ai工作流生成一个或多个工具函数作为一个工作流执行过程中调用的扩展工具，则需要先调用此函数获取生成扩展文件的规则;示例：生成一个扩展工具: 能够产生一个随机数的函数;",
      parameters: {
        type: "object",
        properties: {
          goal: { type: "string" },
        },
        required: ["goal"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getAiConfig",
      description: "获取ai的配置参数",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getAiConfigPath",
      description: "获取ai的配置文件地址",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];
const functions = {
  executeCommand,
  requestAI,
  executeJSCode,
  createFile,
  modifyFile,
  readFile,
  appendToFile,
  fileExists,
  createDirectory,
  deleteFile,
  deleteDirectory,
  rename,
  moveFile,
  getFileInfo,
  getFileNameList,
  clearDirectory,
  getExtensionFileRule,
  getAiConfig,
  getAiConfigPath,
};

module.exports = {
  descriptions,
  functions,
};
