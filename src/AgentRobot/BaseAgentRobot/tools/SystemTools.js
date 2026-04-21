/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-17 11:59:19
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-04-21 21:08:34
 * @FilePath: \deepfish\src\AgentRobot\BaseAgentRobot\tools\SystemTools.js
 * @Description: 默认扩展函数
 * @
 */
const path = require('path')
const fs = require('fs-extra')
const iconv = require('iconv-lite')
const { spawnSync } = require('child_process')
const { detectEncoding } = require('../utils/normal.js')
const aiConsole = require('../utils/aiConsole.js')

// 执行系统命令
// 执行系统命令（全平台兼容：Windows/PowerShell/CentOS）
function executeCommand(command, timeout = -1) {
  aiConsole.logSuccess(
    `Executing system command: ${command}; ${timeout > 0 ? `Timeout: ${timeout}ms` : 'No timeout limit'}`,
  )
  try {
    const result = spawnSync(command, {
      cwd: process.cwd(),
      stdio: 'pipe',
      shell: true,
      encoding: 'buffer',
      windowsHide: true,
      argv0: 'deepfish-shell',
      timeout: timeout > 0 ? timeout : undefined,
    })
    let targetEncoding = this.agentRobot.config?.encoding
    if (!targetEncoding || targetEncoding === 'auto') {
      targetEncoding = detectEncoding(result.stdout || result.stderr)
    }
    const stdout = iconv.decode(result.stdout, targetEncoding)
    const stderr = iconv.decode(result.stderr, targetEncoding)
    const code = result.status
    if (stderr && !stderr.trim().startsWith('WARNING')) {
      const error = new Error(`Command failed (code ${code}): ${stderr.trim()}`)
      aiConsole.logError(`Execute error: ${error.message}`)
      return `Execute error: ${error.message}`
    }
    aiConsole.logSuccess(`${stdout}\nCommand executed successfully`)
    return stdout || 'Command executed successfully'
  } catch (decodeError) {
    aiConsole.logError(`Encoding convert error: ${decodeError.message}`)
    return `Failed to parse command output: ${decodeError.message}`
  }
}

// 请求ai服务
async function requestAI(
  systemDescription,
  prompt,
  temperature = this.agentRobot.opt.aiConfig.temperature,
) {
  aiConsole.logSuccess(`Requesting AI`)
  if (
    typeof systemDescription === 'object' &&
    systemDescription.systemDescription
  ) {
    prompt = systemDescription.prompt || prompt || ''
    systemDescription = systemDescription.systemDescription || ''
  }
  try {
    aiConsole.logInfo(`aiSystem: ${systemDescription}`)
    aiConsole.logInfo(`aiPrompt: ${prompt}`)
    const response = await this.agentRobot.brain.think(
      systemDescription,
      prompt,
      temperature,
    )
    return response
  } catch (error) {
    aiConsole.logError(`Error executing AI function: ${error.message}`)
    throw error
  }
}

// 执行js代码
async function executeJSCode(code) {
  aiConsole.logSuccess('Executing JavaScript code: ')
  aiConsole.logSuccess(code)
  // 检测code最后一行代码包含return，如果不包含，则返回一个错误信息，提示agent需要使用return返回结果
  const codeLines = code.trim().split('\n')
  const lastLine = codeLines[codeLines.length - 1].trim()
  if (!lastLine.startsWith('return')) {
    const error = new Error('The last line of the code must contain a return statement.')
    throw error
  }
  try {
    const functions = this.agentRobot.getTools()
    const Func = new Function(
      'Tools',
      'require',
      `return (async () => {
          this.logMessages = []
          const originalLog = console.log
          const newLog = function () {
            originalLog.apply(console, arguments)
            this.logMessages.push(Array.from(arguments).join(' '))
          }
          console.log = newLog.bind(this)
          function __main() {
            ${code}
          }
          const result = await __main()
          console.log = originalLog
          return result || this.logMessages.join('\\n')
        })()`,
    )
    const originalRequire = require
    const newRequire = (modulePath) => {
      if (modulePath.startsWith('./')) {
        const resolvedPath = path.resolve(process.cwd(), modulePath)
        return originalRequire(resolvedPath)
      }
      return originalRequire(modulePath)
    }

    const result = await Func(functions, newRequire)
    return result || ''
  } catch (error) {
    aiConsole.logError(`Error executing code: ${error.stack}`)
    throw error
  }
}

// 了解自己
function getSelfInfo() {
  // 返回自己的代码路径、package.json路径、readme路径等基本信息，供AI有选择的了解自己，回答用户的问题
  const homeDir = path.resolve(__dirname, '../../../../')
  const packageJson = fs.readJSONSync(path.resolve(homeDir, 'package.json'))
  return {
    config: {
      description: 'DeepFish AI程序代码配置项',
      value: this.agentRobot.config,
    },
    codePath: {
      description: 'DeepFish AI程序代码路径',
      value: homeDir,
    },
    packageJsonPath: {
      description: 'DeepFish AI程序package.json文件路径',
      value: path.resolve(homeDir, 'package.json'),
    },
    readmeCNPath: {
      description: 'DeepFish AI程序中文文档路径',
      value: path.resolve(homeDir, 'README_CN.md'),
    },
    readmeENPath: {
      description: 'DeepFish AI程序英文文档路径',
      value: path.resolve(homeDir, 'README.md'),
    },
    version: {
      description: 'DeepFish AI程序版本',
      value: 'v' + packageJson.version,
    },
  }
}

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'executeCommand',
      description:
        '执行系统命令，返回执行结果。适用于运行shell命令、系统工具等。command为需要执行的系统命令字符串，如"ls -l"; timeout为命令执行的超时时间，单位为毫秒，-1表示不限制超时时间, 默认值为-1。注意：如果执行多条命令，且需要保持会话，使用命令链的方式执行。命令执行失败时会抛出错误，成功时返回命令执行结果字符串或"System command executed successfully"。',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          timeout: { type: 'number' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'requestAI',
      description:
        '请求AI服务处理简单任务，如随机生成一段话、翻译文本、数学计算、代码分析、知识检索等。通过systemDescription参数指定AI的行为和限制，prompt参数输入任务描述, temperature参数指定AI的温度（0-2之间的浮点数，默认为用户配置）。返回AI处理后的结果字符串，执行失败时会抛出错误。',
      parameters: {
        type: 'object',
        properties: {
          systemDescription: { type: 'string' },
          prompt: { type: 'string' },
          temperature: { type: 'number' },
        },
        required: ['systemDescription', 'prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'executeJSCode',
      description:
        '执行JavaScript代码，返回代码执行结果。代码中可通过Tools命名空间直接调用其他工具函数（如await Tools.createFile(),注意：不需要使用require引入）,Tools中引入了一些常用库可直接调用（Tools.fs="fs-extra", Tools.dayjs="dayjs", Tools.axios="axios", Tools.lodash="lodash", Tools.echarts="echarts", Tools.canvas="canvas" Tools.cheerio="cheerio" Tools.puppeteer="puppeteer"），支持引入自定义模块（需使用绝对路径）。注意：1.代码中不要使用__dirname获取当前目录，请使用path.resolve(".")来获取当前目录。2.执行失败时会抛出错误，成功时返回代码执行结果或空字符串。3.使用require(module_path)函数引入自定义模块，module_path为模块路径字符串，支持相对路径（如"./myModule.js"）和绝对路径，返回引入的模块内容。4.执行主函数必须使用return返回，如return main()',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSelfInfo',
      description:
        '获取DeepFish AI程序的基本信息、命令行等，供AI有选择的了解自己，回答用户的问题。',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
]
const functions = {
  executeCommand,
  requestAI,
  executeJSCode,
  getSelfInfo,
}

const SystemTool = {
  name: 'SystemTool',
  description:
    '提供系统命令执行、AI请求、JS代码执行、扩展文件生成规则、AI配置管理、Tool加载执行等核心系统功能',
  descriptions,
  functions,
}

module.exports = SystemTool
