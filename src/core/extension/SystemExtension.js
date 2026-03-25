/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-17 11:59:19
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-25 20:05:23
 * @FilePath: \deepfish\src\core\extension\SystemExtension.js
 * @Description: 默认扩展函数
 * @
 */
const path = require('path')
const { logError, logSuccess, logInfo, getConfigPath } = require('../utils/log')
const iconv = require('iconv-lite') // 用于编码转换
const { cloneDeep } = require('lodash')
const { aiRequestSingle } = require('../ai-services/AiWorker/AiTools')
const { spawnSync } = require('child_process')
const { detectEncoding } = require('../utils/normal')

// 执行系统命令
// 执行系统命令（全平台兼容：Windows/PowerShell/CentOS）
function executeCommand(command, timeout = -1) {
  logSuccess(`Executing system command: ${command}; ${timeout > 0 ? `Timeout: ${timeout}ms` : 'No timeout limit'}`)
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
    let targetEncoding = this.config?.encoding
    if (!targetEncoding || targetEncoding === 'auto') {
      targetEncoding = detectEncoding(result.stdout || result.stderr)
    }
    const stdout = iconv.decode(result.stdout, targetEncoding)
    const stderr = iconv.decode(result.stderr, targetEncoding)
    const code = result.status
    if (stderr && !stderr.trim().startsWith('WARNING')) {
      const error = new Error(`Command failed (code ${code}): ${stderr.trim()}`)
      logError(`Execute error: ${error.message}`)
      return `Execute error: ${error.message}`
    }
    logSuccess(`${stdout}\nCommand executed successfully`)
    return stdout || 'Command executed successfully'
  } catch (decodeError) {
    logError(`Encoding convert error: ${decodeError.message}`)
    return `Failed to parse command output: ${decodeError.message}`
  }
}

// 请求ai服务
async function requestAI(
  systemDescription,
  prompt,
  temperature = this.aiConfig.temperature,
) {
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
    let aiConfig = this.aiConfig
    if (temperature !== aiConfig.temperature) {
      aiConfig = cloneDeep(aiConfig)
      aiConfig.temperature = temperature
    }
    const response = await aiRequestSingle(
      this.aiService.client,
      aiConfig,
      systemDescription,
      prompt,
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
    const { functions } = this.extensionManager.extensions
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
          ${code}
          console.log = originalLog
          return this.logMessages.join('\\n')
        })()`,
    )
    const originalRequire = require
    const newRequire = (modulePath) => {
      if (modulePath.startsWith('./')) {
        const resolvedPath = path.resolve('.', modulePath)
        return originalRequire(resolvedPath)
      }
      return originalRequire(modulePath)
    }

    const result = await Func(functions, newRequire)

    return result || ''
  } catch (error) {
    logError(`Error executing code: ${error.stack}`)
    throw error
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
   - author设置为"DeepFish AI",
3. 主文件：项目入口文件必须命名为index.js
4. 文档文件：项目根目录需新增2个文档文件：
   - README_CN.md（中文说明文档）
   - README.md（英文说明文档）

### 第二步：index.js 完整开发规范
#### 2.1 核心输出要求
文件需输出四个核心字段，且代码逻辑清晰、可运行：
- name：字符串类型，扩展的名称标识
- extensionDescription：字符串类型，扩展功能的简要描述，说明该扩展提供的核心能力
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
  name: '扩展名称',
  extensionDescription: '扩展功能的简要描述',
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
  name: 'systemFileManagement',
  extensionDescription: '提供文件管理相关功能，包括文件重命名等操作',
  descriptions,
  functions,
}

### 第三步：README文档规范
#### 3.1 通用要求
- 两个文档需在标题下方包含「中英文切换标签」（如文档顶部标注「English | 中文」/「中文 | English」）
- 结构保持一致，仅语言不同，核心模块顺序不可调整
- 文件名称README_CN.md（中文）、README.md（英文）
- 链接使用相对路径，如[中文](./README_CN.md)

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
  `
  return newGoal
}

// 获取ai的配置
function getAiConfig() {
  return cloneDeep(this.aiConfig)
}

// 获取ai的配置文件所在目录
function getAiConfigPath() {
  return getConfigPath()
}

// 加载skill
function executeSkill(skillFilePath, subGoalPrompt = '') {
  const skillContent = this.skillConfigManager.loadSkill(skillFilePath)
  if (!subGoalPrompt) {
    return skillContent
  }
  // 调用子工作流完成目标
  return this.aiService.subSkillWorkflow(skillContent, subGoalPrompt)
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
        '执行JavaScript代码，返回代码执行结果。代码中可通过Tools命名空间直接调用其他工具函数（如await Tools.createFile(),注意：不需要使用require引入）,Tools中引入了一些常用库可直接调用（Tools.fs="fs-extra", Tools.dayjs="dayjs", Tools.axios="axios", Tools.lodash="lodash"），支持引入自定义模块（需使用绝对路径）。注意：1.代码中不要使用__dirname获取当前目录，请使用path.resolve(".")来获取当前目录。2.执行失败时会抛出错误，成功时返回代码执行结果或空字符串。',
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
      name: 'getExtensionFileRule',
      description:
        '如果用户需要为本程序ai工作流生成一个或多个工具函数作为一个工作流执行过程中调用的扩展工具，则需要先调用此函数获取生成扩展文件的规则;示例：生成一个扩展工具: 能够产生一个随机数的函数;',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string' },
        },
        required: ['goal'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getAiConfig',
      description: '获取ai请求接口的配置参数',
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
      name: 'getAiConfigPath',
      description: '获取ai请求接口配置的文件地址',
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
      name: 'executeSkill',
      description:
        '加载并执行指定路径的skill，以该skill提供的工具函数为基础，启动子工作流完成目标任务。skillFilePath为SKILL.md文件的绝对路径，subGoalPrompt为子工作流需要完成的目标描述，留空则仅加载skill不执行子任务。',
      parameters: {
        type: 'object',
        properties: {
          skillFilePath: {
            type: 'string',
            description: 'SKILL.md文件的绝对路径',
          },
          subGoalPrompt: {
            type: 'string',
            description: '子工作流需要完成的目标描述，留空则仅加载skill',
          },
        },
        required: ['skillFilePath'],
      },
    },
  },
]
const functions = {
  executeCommand,
  requestAI,
  executeJSCode,
  getExtensionFileRule,
  getAiConfig,
  getAiConfigPath,
  executeSkill,
}

module.exports = {
  name: 'SystemExtension',
  extensionDescription: "提供系统命令执行、AI请求、JS代码执行、扩展文件生成规则、AI配置管理、Skill加载执行等核心系统功能",
  descriptions,
  functions,
}
