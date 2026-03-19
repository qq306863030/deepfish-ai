const path = require('path')
const os = require('os')
const fs = require('fs-extra')
const { logError, logSuccess } = require('../core/utils')

// 获取默认配置
function getDefaultConfig() {
  return {
    ai: [],
    currentAi: '',
    maxIterations: -1, // ai完成工作流的最大迭代次数
    maxMessagesLength: 50000, // 最大压缩长度
    maxMessagesCount: 40, // 最大压缩数量
    extensions: [],
    isRecordHistory: false, // 是否创建工作流执行记录文件,用于因意外终止恢复工作流
    isLog: false, // 是否创建工作流执行日志
  }
}
// 获取默认配置内容
function getDefaultConfigContent() {
  return `module.exports = ${JSON.stringify(getDefaultConfig(), null, 2)}`;
}

const aiCliConfig = {
  DeepSeek: {
    baseUrl: 'https://api.deepseek.com',
    model: {
      list: ['deepseek-chat', 'deepseek-reasoner', 'Other'],
      defaultValue: ""
    },
    apiKey: '',
    temperature: 0.7,
    maxTokens: 8192,
    stream: true,
  },
  Ollama: {
    baseUrl: 'http://localhost:11434/v1',
    model: {
      list: [],
      defaultValue: "deepseek-v3.2:cloud"
    },
    apiKey: 'ollama',
    temperature: 0.7,
    maxTokens: 8192,
    stream: true,
  },
  OpenAI: {
    baseUrl: 'https://api.openai.com/v1',
    model: {
      list: [],
      defaultValue: "gpt-4"
    },
    apiKey: '',
    temperature: 0.7,
    maxTokens: 8192,
    stream: true,
  },
}

// 添加扩展
function addExtensionToConfig(fileName) {
  // 检查 fileName 是否为空
  if (!fileName) {
    logError('Extension file name is required.')
    return
  }
  const filePath = path.resolve(process.cwd(), fileName)
  // 判断是否路径是文件还是目录
  if (fs.statSync(filePath).isDirectory()) {
    // 扫描目录和子目录下所有js、cjs文件
    const files = traverseFiles()
    const jsFiles = files.filter(
      (file) => file.endsWith('.js') || file.endsWith('.cjs'),
    )
    jsFiles.forEach((jsFile) => {
      // 读取文件，查询文件内是否存在‘descriptions’和‘functions’
      const fileContent = fs.readFileSync(jsFile, 'utf-8')
      if (
        fileContent.includes('descriptions') &&
        fileContent.includes('functions')
      ) {
        addExtensionToConfig(jsFile)
      }
    })
    return
  }
  // 判断文件是否存在
  if (!fs.existsSync(filePath)) {
    logError(`File not found: ${filePath}`)
    return
  }
  const userConfigPath = path.join(os.homedir(), '.ai-cmd.config.js')
  if (!fs.existsSync(userConfigPath)) {
    logError(
      `User config file not found: ${userConfigPath}. Please run 'ai config reset' first.`,
    )
    return
  }
  const userConfig = require(userConfigPath)
  if (userConfig.extensions && Array.isArray(userConfig.extensions)) {
    userConfig.extensions.push(filePath)
  } else {
    userConfig.extensions = [filePath]
  }
  // 数组去重
  userConfig.extensions = [...new Set(userConfig.extensions)]
  fs.writeFileSync(
    userConfigPath,
    `module.exports = ${JSON.stringify(userConfig, null, 2)}`,
  )
  logSuccess(`Extension added to config: ${filePath}.`)
}

// 移除扩展
function removeExtensionFromConfig(fileName) {
  const userConfigPath = path.join(os.homedir(), '.ai-cmd.config.js')
  if (!fs.existsSync(userConfigPath)) {
    logError(
      `User config file not found: ${userConfigPath}. Please run 'ai config reset' first.`,
    )
    return
  }
  const userConfig = require(userConfigPath)
  // 增加对数字索引的支持
  if (!isNaN(Number(fileName))) {
    const extIndex = Number(fileName)
    if (extIndex < 0 || extIndex >= userConfig.extensions.length) {
      logError(`Invalid extension index: ${extIndex}`)
      return
    }
    const filePath = userConfig.extensions.splice(extIndex, 1)
    fs.writeFileSync(
      userConfigPath,
      `module.exports = ${JSON.stringify(userConfig, null, 2)}`,
    )
    logSuccess(
      `Extension removed from config: ${filePath}.You can run 'ai ext ls' to view the changes.`,
    )
    return
  }
  const filePath = path.resolve(process.cwd(), fileName)
  // 判断文件是否存在
  if (!fs.existsSync(filePath)) {
    logError(`File not found: ${filePath}`)
    return
  }
  if (userConfig.extensions && Array.isArray(userConfig.extensions)) {
    userConfig.extensions = userConfig.extensions.filter(
      (ext) => ext !== filePath,
    )
  }
  fs.writeFileSync(
    userConfigPath,
    `module.exports = ${JSON.stringify(userConfig, null, 2)}`,
  )
  logSuccess(
    `Extension removed from config: ${filePath}.You can run 'ai ext ls' to view the changes.`,
  )
}

// 查看扩展列表
function viewExtensionsFromConfig() {
  const userConfigPath = path.join(os.homedir(), '.ai-cmd.config.js')
  if (!fs.existsSync(userConfigPath)) {
    logError(
      `User config file not found: ${userConfigPath}. Please run 'ai config reset' first.`,
    )
    return
  }
  const userConfig = require(userConfigPath)
  if (userConfig.extensions && Array.isArray(userConfig.extensions)) {
    console.log('='.repeat(50))
    // 打印扩展列表，并加上索引
    if (userConfig.extensions.length === 0) {
      console.log(`No extensions in config.`)
    } else {
      console.log('Extensions in config:')
      userConfig.extensions.forEach((ext, index) => {
        console.log(`[${index}] ${ext}`)
      })
    }
    console.log('='.repeat(50))
  } else {
    logSuccess(`No extensions in config.`)
  }
}

function traverseFiles() {
  try {
    const currentDir = process.cwd()
    const allFiles = []
    const currentItems = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const item of currentItems) {
      const itemPath = path.join(currentDir, item.name)
      if (item.isFile()) {
        allFiles.push(itemPath)
        continue
      }
      if (item.isDirectory()) {
        try {
          const subItems = fs.readdirSync(itemPath, { withFileTypes: true })
          for (const subItem of subItems) {
            if (subItem.isFile()) {
              allFiles.push(path.join(itemPath, subItem.name))
            }
          }
        } catch (subErr) {
          console.warn(`读取子目录失败 ${itemPath}：${subErr.message}`)
        }
      }
    }
    return allFiles
  } catch (err) {
    console.error(`遍历目录失败：${err.message}`)
    return []
  }
}

// 获取配置文件所在目录
function getConfigPath() {
  return path.join(os.homedir(), '.deepfish-ai/config.js')
}

module.exports = {
  getDefaultConfig,
  addExtensionToConfig,
  removeExtensionFromConfig,
  viewExtensionsFromConfig,
  getConfigPath,
  aiCliConfig,
  getDefaultConfigContent
}
