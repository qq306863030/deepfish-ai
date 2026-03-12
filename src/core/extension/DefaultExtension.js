const path = require('path')
const { logError, logSuccess, logInfo } = require('../utils')
const fs = require('fs-extra')
const shelljs = require('shelljs')
const iconv = require('iconv-lite') // 用于编码转换
const os = require('os') // 用于判断系统类型

// 执行系统命令
// 执行系统命令（全平台兼容：Windows/PowerShell/CentOS）
async function executeCommand(command) {
  return new Promise((resolve, reject) => {
    logSuccess(`Executing system command: ${command}`)
    const platform = os.platform()
    const targetEncoding = platform === 'win32' ? 'gbk' : 'utf-8' // Windows(含PowerShell)用gbk，Linux/macOS用utf-8
    shelljs.exec(command, {
      async: true,
      cwd: process.cwd(),
      encoding: 'binary',
      silent: true
    }, (code, stdout, stderr) => {
      try {
        const stdoutUtf8 = iconv.decode(Buffer.from(stdout, 'binary'), targetEncoding)
        const stderrUtf8 = iconv.decode(Buffer.from(stderr, 'binary'), targetEncoding)
        if (stderrUtf8 && !stderrUtf8.trim().startsWith('WARNING')) { // 过滤无关警告
          const error = new Error(`Command failed (code ${code}): ${stderrUtf8}`)
          logError(`Execute error: ${error.message}`)
          reject(error)
          return
        }
        logSuccess(`${stdoutUtf8} \n Command executed successfully`)
        resolve(stdoutUtf8 || 'Command executed successfully')
      } catch (decodeError) {
        logError(`Encoding convert error: ${decodeError.message}`)
        reject(new Error(`Failed to parse command output: ${decodeError.message}`))
      }
    })
  })
}

// 请求ai服务
async function requestAI(systemDescription, prompt) {
  logSuccess(`Requesting AI`)
  if (
    typeof systemDescription === 'object' &&
    systemDescription.systemDescription
  ) {
    prompt = systemDescription.prompt || prompt || ''
    systemDescription = systemDescription.systemDescription || ''
  }
  try {
    logInfo(`aiSystem: ${systemDescription}`)
    logInfo(`aiPrompt: ${prompt}`)
    const response = await this.aiService.derictGenerateResponse(
      systemDescription,
      prompt
    )
    logInfo(`aiResponse: ${response}`)
    return response
  } catch (error) {
    logError(`Error executing AI function: ${error.message}`)
    throw error
  }
}

// 执行js代码
async function executeJSCode(code) {
  logSuccess('Executing JavaScript code: ')
  logSuccess(code)

  try {
    const { toolFunctions } = this.extensionManager.extensions
    const Func = new Function(
      'Tools',
      'require',
      'return (async () => { ' + code + ' })()',
    )
    const originalRequire = require;
    const newRequire = (modulePath) => {
        if (modulePath.startsWith('./')) {
            const resolvedPath = path.resolve('.', modulePath);
            return originalRequire(resolvedPath);
        }
        return originalRequire(modulePath);
    };
    const result = await Func(
      toolFunctions,
      newRequire,
    )
    return result || ''
  } catch (error) {
    logError(`Error executing code: ${error.stack}`)
    throw error
  }
}
// 生成一个扩展函数文件
async function getExtensionFileRule(goal) {
  const newGoal = `
    创建一个js文件或一个包含主文件的node项目，使用逻辑清晰的nodejs代码完成用户目标: ${goal}。主函数输出两个字段：toolDescriptions(openai能识别的函数描述)和toolFunctions(key为函数名称，value为方法体的对象。注意：函数体的参数必须与toolDescriptions中描述的参数一致，可以包含一个或多个可以被AI工作流调用的函数。),如下所示：
    “”“
    const toolDescriptions = []
    const toolFunctions = {}
    module.exports = {
      toolDescriptions,
      toolFunctions,
    }
    ”“”
    以下是示例：
    “”“
    const toolDescriptions = [
      {
        name: 'rename_file',
        description: '重命名文件',
        parameters: {
          type: 'object',
          properties: {
            oldPath: {
              type: 'string',
              description: '旧文件路径',
            },
            newPath: {
              type: 'string',
              description: '新文件路径',
            },
          },
        },
      },
    ]
    const toolFunctions = {
      rename_file: (oldPath, newPath) => {
        try {
          const fullOldPath = path.resolve(process.cwd(), oldPath)
          const fullNewPath = path.resolve(process.cwd(), newPath)

          if (fs.existsSync(fullOldPath)) {
            fs.renameSync(fullOldPath, fullNewPath)
          }
          return true
        } catch (error) {
          return false
        }
      },
    }
    module.exports = {
      toolDescriptions,
      toolFunctions,
    }
    ”“”
    
  `
  return newGoal
}

// 追加临时文件记录到messages
function appendTempFileRecord(fileName, tempFilePath, tempFileDescription) {
  try {
    const messages = this.aiService.aiWorkFlow.messages
    const userGoalMessage = messages[1]
    let goalContent = userGoalMessage.content.trim()
    if (goalContent.startsWith('```json')) {
      goalContent = goalContent.slice(7, -3).trim()
    }
    const userGoal = JSON.parse(goalContent)
    if (!userGoal.tempFiles) {
      userGoal.tempFiles = {}
    }
    userGoal.tempFiles[fileName] = {
     fileDescription: tempFileDescription,
     filePath: tempFilePath,
    }
    userGoalMessage.content = JSON.stringify(userGoal)
    return true
  } catch (error) {
    logError(`Error appending temp file record: ${error.message}`)
    throw error
  }
}


async function createFile(filePath, content) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)
    const dirPath = path.dirname(fullPath)

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    fs.writeFileSync(fullPath, content)
    return true
  } catch (error) {
    return false
  }
}

async function modifyFile(filePath, content) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)

    if (!fs.existsSync(fullPath)) {
      return false
    }

    fs.writeFileSync(fullPath, content)
    return true
  } catch (error) {
    return false
  }
}

async function readFile(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)

    if (!fs.existsSync(fullPath)) {
      return null
    }

    const content = fs.readFileSync(fullPath, 'utf8')
    return content
  } catch (error) {
    return null
  }
}

async function appendToFile(filePath, content) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)

    if (!fs.existsSync(fullPath)) {
      return false
    }

    fs.appendFileSync(fullPath, content)
    return true
  } catch (error) {
    return false
  }
}

function fileExists(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath)
  return fs.existsSync(fullPath)
}

async function createDirectory(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath)
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true })
    }
    return true
  } catch (error) {
    return false
  }
}

async function deleteFile(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }
    return true
  } catch (error) {
    return false
  }
}

async function deleteDirectory(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath)

    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true })
    }
    return true
  } catch (error) {
    return false
  }
}

async function rename(oldPath, newPath) {
  try {
    const fullOldPath = path.resolve(process.cwd(), oldPath)
    const fullNewPath = path.resolve(process.cwd(), newPath)

    if (fs.existsSync(fullOldPath)) {
      fs.renameSync(fullOldPath, fullNewPath)
    }
    return true
  } catch (error) {
    return false
  }
}

async function moveFile(sourcePath, destinationPath) {
  try {
    const fullSourcePath = path.resolve(process.cwd(), sourcePath)
    const fullDestPath = path.resolve(process.cwd(), destinationPath)
    const destDirPath = path.dirname(fullDestPath)

    if (!fs.existsSync(destDirPath)) {
      fs.mkdirSync(destDirPath, { recursive: true })
    }

    if (fs.existsSync(fullSourcePath)) {
      fs.renameSync(fullSourcePath, fullDestPath)
    }
    return true
  } catch (error) {
    return false
  }
}

async function getFileInfo(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)

    if (!fs.existsSync(fullPath)) {
      return null
    }

    const stats = fs.statSync(fullPath)
    return {
      path: fullPath,
      size: stats.size,
      birthtime: stats.birthtime,
      mtime: stats.mtime,
      ctime: stats.ctime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    }
  } catch (error) {
    return null
  }
}

async function getFileNameList(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath)
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      return []
    }
    const files = fs.readdirSync(fullPath).filter(file => (file !== 'ai-history' && file !== 'ai-log'))
    return files
  } catch (error) {
    return []
  }
}

async function clearDirectory(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath)

    if (!fs.existsSync(fullPath)) {
      return false
    }

    if (!fs.statSync(fullPath).isDirectory()) {
      return false
    }

    const files = fs.readdirSync(fullPath)

    for (const file of files) {
      const filePath = path.join(fullPath, file)
      if (fs.statSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true })
      } else {
        fs.unlinkSync(filePath)
      }
    }

    return true
  } catch (error) {
    return false
  }
}

const toolDescriptions = [
  {
    type: 'function',
    function: {
      name: 'executeCommand',
      description: '执行系统命令，返回执行结果。适用于运行shell命令、系统工具等。命令执行失败时会抛出错误，成功时返回命令执行结果字符串或"System command executed successfully"。',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'requestAI',
      description: '请求AI服务处理简单任务，如随机生成一段话、翻译文本、数学计算、代码分析、知识检索等。通过systemDescription参数指定AI的行为和限制，prompt参数输入任务描述。返回AI处理后的结果字符串，执行失败时会抛出错误。',
      parameters: {
        type: 'object',
        properties: {
          systemDescription: { type: 'string' },
          prompt: { type: 'string' }
        },
        required: ['systemDescription', 'prompt']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'executeJSCode',
      description: '执行JavaScript代码，返回代码执行结果。代码中可通过Tools命名空间直接调用其他工具函数（如await Tools.createFile(),注意：不需要使用require引入）,Tools中引入了一些常用库可直接调用（Tools.fs="fs-extra", Tool.dayjs="dayjs", Tool.axios="axios"），支持引入自定义模块（需使用绝对路径）。代码中不要使用__dirname获取当前目录，请使用path.resolve(".")来获取当前目录。执行失败时会抛出错误，成功时返回代码执行结果或空字符串。',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string' }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'createFile',
      description: '创建一个包含指定内容的新文件，返回布尔值表示操作是否成功。如果目录不存在会自动创建目录结构。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['filePath', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'modifyFile',
      description: '修改指定文件的内容，返回布尔值表示操作是否成功。如果文件不存在则返回false。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['filePath', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'readFile',
      description: '读取指定文件的内容，返回文件内容字符串。如果文件不存在或读取失败则返回null。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string' }
        },
        required: ['filePath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'appendToFile',
      description: '向指定文件追加内容，返回布尔值表示操作是否成功。如果文件不存在则返回false。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['filePath', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fileExists',
      description: '检查指定文件是否存在，返回布尔值。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string' }
        },
        required: ['filePath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'createDirectory',
      description: '创建一个新目录，返回布尔值表示操作是否成功。支持递归创建目录结构。',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string' }
        },
        required: ['dirPath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'deleteFile',
      description: '删除指定文件，返回布尔值表示操作是否成功。如果文件不存在也会返回true。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string' }
        },
        required: ['filePath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'deleteDirectory',
      description: '删除指定目录，返回布尔值表示操作是否成功。支持递归删除目录及其内容。如果目录不存在也会返回true。',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string' }
        },
        required: ['dirPath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'rename',
      description: '重命名文件或目录，返回布尔值表示操作是否成功。如果原文件不存在也会返回true。',
      parameters: {
        type: 'object',
        properties: {
          oldPath: { type: 'string' },
          newPath: { type: 'string' }
        },
        required: ['oldPath', 'newPath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'moveFile',
      description: '移动文件，返回布尔值表示操作是否成功。如果目标目录不存在会自动创建。如果源文件不存在也会返回true。',
      parameters: {
        type: 'object',
        properties: {
          sourcePath: { type: 'string' },
          destinationPath: { type: 'string' }
        },
        required: ['sourcePath', 'destinationPath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getFileInfo',
      description: '获取指定文件的信息，返回文件信息对象。如果文件不存在或获取失败则返回null。返回对象包含path、size、birthtime、mtime、ctime、isFile、isDirectory等属性。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string' }
        },
        required: ['filePath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getFileNameList',
      description: '获取指定目录下的所有文件名，返回文件名数组。如果目录不存在或不是目录则返回空数组。',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string' }
        },
        required: ['dirPath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'clearDirectory',
      description: '清空指定目录的内容，返回布尔值表示操作是否成功。如果目录不存在或不是目录则返回false。',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string' }
        },
        required: ['dirPath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getExtensionFileRule',
      description: '如果用户需要为本程序ai工作流生成一个或多个工具函数作为一个工作流执行过程中调用的扩展工具，则需要先调用此函数获取生成扩展文件的规则',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string' }
        },
        required: ['goal']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'appendTempFileRecord',
      description: '记录临时文件信息,包括临时文件的名称和描述，用于说明临时文件的作用，方便在AI对话中AI进行历史文件查阅。返回布尔值表示操作是否成功',
      parameters: {
        type: 'object',
        properties: {
          fileName: { type: 'string' },
          tempFilePath: { type: 'string' },
          tempFileDescription: { type: 'string' }
        },
        required: ['fileName', 'tempFilePath', 'tempFileDescription']
      }
    }
  }
]
const toolFunctions = {
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
  appendTempFileRecord,
}

module.exports = {
  toolDescriptions,
  toolFunctions,
}
