/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-17 11:59:19
 * @LastEditors: roman_123 306863030@qq.com
 * @LastEditTime: 2026-05-16 23:50:00
 * @FilePath: \deepfish\src\AgentRobot\BaseAgentRobot\tools\SystemTools.js
 * @Description: 默认扩展函数（含AST-grep/ripgrep/comby代码搜索替换工具）
 * @
 */
const path = require('path')
const fs = require('fs-extra')
const dayjs = require('dayjs')
const iconv = require('iconv-lite')
const { spawnSync } = require('child_process')
const { detectEncoding, analyzeReturn } = require('../utils/normal.js')
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
  try {
    const functions = this.agentRobot.toolManager.functions
    const Func = new Function(
      'Tools',
      'require',
      `return (async () => {
          this.logMessages = []
          this.Tools = Tools
          const originalLog = console.log
          const newLog = function () {
            originalLog.apply(console, arguments)
            this.logMessages.push(Array.from(arguments).join(' '))
          }
          console.log = newLog.bind(this)
          async function __main() {
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
    if (!result) {
      // 校验代码片段中是否存在顶层 return，避免仅按最后一行判断导致误判。
      const { hasReturnValue } = analyzeReturn(code)
      if (!hasReturnValue) {
        const error = new Error('The code must contain a return value.')
        throw error
      }
    }
    return result || ''
  } catch (error) {
    aiConsole.logError(`Error executing code: ${error.stack}`)
    throw error
  }
}

// 获取当前系统时间
function getCurrentTime() {
  const now = dayjs()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'
  return `Current system time: ${now.format('YYYY-MM-DD HH:mm:ss')} | ISO: ${now.toISOString()} | Timezone: ${timezone}`
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
    configPath: {
      description: 'DeepFish AI程序配置文件路径',
      value: path.resolve(this.agentRobot.basespace, 'config.js'),
    },
    selfCmd: {
      description: 'DeepFish AI程序系统命令说明',
      value: ```bash
# Configuration commands
ai config add # Add a new AI configuration
ai config ls # List all AI configurations
ai config use <name> # Set the specified AI configuration as the current one
ai config del <name> # Delete the specified AI configuration
ai config view [name] # View details of the specified AI configuration
ai config edit # Edit the configuration file manually
ai config dir # Open the configuration file directory
ai config reset # Reset configuration

# Skill commands
ai skill ls # List all registered skills
ai skill add <name> # Add a local skill directory or zip file from the current directory
ai skill del <name|index> # Remove a skill by name or index, exp: ai skill del 1
ai skill install <url> # Install a skill from ClawHub，exp: ai skill install https://clawhub.ai/TheSethRose/agent-browser
ai skill enable <name|index> # Enable a skill by name or index, exp: ai skill enable 1
ai skill disable <name|index> # Disable a skill by name or index, exp: ai skill disable 1
ai skill dir # Open the skill directory

# Memory commands
ai memory clear # Clear the history messages for the current directory
ai memory dir # Open the memory directory
```
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

// ========== 代码搜索与结构替换工具 ==========

/**
 * 查找 CLI 工具是否可用，返回可用的命令路径或 null
 * @param {string[]} candidateCmds 候选命令列表
 * @returns {string|null} 找到的第一个可用命令
 */
function findAvailableCommand(candidateCmds) {
  for (const cmd of candidateCmds) {
    try {
      const check = spawnSync(cmd, ['--version'], {
        shell: true,
        windowsHide: true,
        timeout: 8000,
        encoding: 'buffer',
      })
      if (check.status === 0) return cmd
    } catch (_) {
      // 继续尝试下一个
    }
  }
  return null
}

/**
 * AST结构化代码搜索与替换（基于ast-grep）
 * 通过AST模式精准匹配代码结构，避免正则误匹配。
 * 支持 JavaScript/TypeScript/Python/Java/Go/Rust 等30+语言。
 *
 * @param {string} pattern - AST模式，如 'class $NAME { $$ }'、'function $FUNC($$$ARGS) { $$ }'
 * @param {string} filePath - 目标文件或目录路径（相对于工作目录）
 * @param {string} [language] - 语言选择器，如 'javascript'、'typescript'、'python'
 * @param {string} [rewrite] - 替换模板，如 'class $NAME extends Base { $$ }'
 * @param {boolean} [update=false] - 是否直接修改源文件（默认false，仅预览）
 * @returns {string} 搜索匹配结果或替换统计信息
 */
function astGrepSearch(pattern, filePath, language, rewrite, update) {
  aiConsole.logSuccess(
    `AST-grep: pattern="${pattern}", path="${filePath}", lang=${language || 'auto'}, rewrite=${!!rewrite}, update=${!!update}`,
  )
  try {
    const resolvedPath = path.resolve(process.cwd(), filePath)

    // 候选命令：npx 调用 / 本地 node_modules / 全局安装
    const nodeBin = path.resolve(__dirname, '../../../../node_modules/.bin')
    const candidateCmds = [
      `npx ast-grep`,
      `"${path.join(nodeBin, 'ast-grep')}"`,
      `"${path.join(nodeBin, 'ast-grep.cmd')}"`,
      'ast-grep',
      'sg',
    ]

    const astGrepCmd = findAvailableCommand(candidateCmds)
    if (!astGrepCmd) {
      return `[AST-grep] 工具未安装。安装方法：npm install @ast-grep/cli（项目级）或 npm install -g @ast-grep/cli（全局）`
    }

    const args = ['--pattern', pattern]
    if (language) args.push('--selector', language)
    if (rewrite) args.push('--rewrite', rewrite)
    if (update) args.push('--update')
    args.push(resolvedPath)

    const result = spawnSync(astGrepCmd, args, {
      cwd: process.cwd(),
      stdio: 'pipe',
      shell: true,
      encoding: 'buffer',
      windowsHide: true,
      timeout: 60000,
    })

    const stdout = iconv.decode(result.stdout, 'utf8')
    const stderr = iconv.decode(result.stderr, 'utf8')

    if (result.status !== 0 && stderr && !stderr.includes('no matches')) {
      return `[AST-grep] 错误: ${stderr.trim()}`
    }

    const output = stdout.trim()
    if (!output) {
      return '[AST-grep] 搜索完成，未找到匹配项。'
    }

    const lines = output.split('\n').length
    const actionLabel = rewrite ? (update ? '已替换' : '可替换（预览模式，未修改文件）') : '匹配'
    return `[AST-grep] ${actionLabel} ${lines} 处:\n${output}`
  } catch (error) {
    return `[AST-grep] 执行失败: ${error.message}`
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
      name: 'getCurrentTime',
      description:
        '获取当前系统时间，返回本地时间、ISO时间和时区信息。适用于需要在任务中使用当前时间戳或进行时间记录的场景。',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
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
  {
    type: 'function',
    function: {
      name: 'astGrepSearch',
      description:
        '【推荐】使用AST-grep进行结构化代码搜索与精准替换。通过AST语法树模式匹配代码结构（而非正则文本），避免误匹配注释/字符串。支持JavaScript/TypeScript/Python/Java/Go/Rust等30+语言。适用于：重命名函数、修改API调用、重构类继承、批量清理TODO等场景。参数：pattern-AST模式（如"class $NAME { $$ }"匹配类定义）；filePath-目标文件或目录路径；language-可选，语言选择器（如javascript/typescript/python，不指定则自动检测）；rewrite-可选，替换模板（如"class $NAME extends Base { $$ }"）；update-可选，是否直接修改源文件（默认false仅预览）。比replaceFileText更精准，比手动逐个修改高效。',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'AST匹配模式，如 "function $FUNC($$$ARGS) { $$ }"',
          },
          filePath: {
            type: 'string',
            description: '目标文件或目录路径',
          },
          language: {
            type: 'string',
            description: '语言选择器，如 javascript/typescript/python/java/go/rust，默认自动检测',
          },
          rewrite: {
            type: 'string',
            description: '替换模板，如 "function $FUNC($$$ARGS) { log(); $$ }"',
          },
          update: {
            type: 'boolean',
            description: '是否直接修改源文件，默认false（仅预览）',
          },
        },
        required: ['pattern', 'filePath'],
      },
    },
  }
]
const functions = {
  executeCommand,
  requestAI,
  executeJSCode,
  getCurrentTime,
  getSelfInfo,
  astGrepSearch,
}

const SystemTool = {
  name: 'SystemTool',
  description:
    '提供系统命令执行、AI请求、JS代码执行、AST-grep结构化搜索替换、ripgrep超快文本搜索、comby结构化代码替换、扩展文件生成规则、AI配置管理、Tool加载执行等核心系统功能',
  descriptions,
  functions,
  isSystem: true
}

module.exports = SystemTool
