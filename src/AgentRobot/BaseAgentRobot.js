import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import FileSkill from './tools/FileTools.js'
import InquirerSkill from './tools/InquirerTools.js'
import SystemSkill from './tools/SystemTools.js'
import lodash from 'lodash'
import Brain, { BrainEvent } from './Brain.js'
import ScreenPrinter from './ScreenPrinter.js'
import Hand, { HandEvent } from './Hand.js'
import dayjs from 'dayjs'
import Logger from './Logger.js'

export default class BaseAgentRobot {
  id = '' // 机器人id
  name = '' // 机器人名字

  brain = null // 大脑，负责思考、记忆、决策
  hand = null // 手，负责使用工具
  originalTools = null // 原装工具
  attachTools = null // 附加工具, 机器人后续安装的工具函数
  heart = null // 心脏，负责心跳、连接
  sender = null // 发送器，负责发送消息
  receiver = null // 接收器，负责接收消息
  screenPrinter = null // 机器人连接的打印机，能向屏幕输出文字
  logger = null // 机器人连接的日志系统，能记录日志
  children = [] // 子机器人，能分担任务
  parent = null // 父机器人，能分配任务
  root = null // 根机器人
  state = 0 // 机器人状态，-1表示销毁 0表示空闲，1表示思考中 2表示工作中
  type = 'main' // 机器人类型，main表示主机器人，sub表示子机器人，task表示任务机器人

  workspace = null
  basespace = null
  memerySpace = null
  agentRecordFilePath = null
  agentSpace = null
  agentTreeFilePath = null
  memoryFilePath = null
  logDirPath = null

  constructor(
    opt = {
      id: '',
      name: '',
      workspace: process.cwd(), // 工作空间，目录
      basespace: path.join(os.homedir(), '.deepfish-ai'), // 记忆空间，目录
      maxIterations: -1, // 思考的最大迭代次数，-1表示无限制
      maxMemoryExpireTime: 30, // 最大记忆过期时间，单位天，-1表示无限制, 0表示不记录
      maxLogExpireTime: 3, // 最大日志过期时间，单位天, -1表示无限制，0表示不记录
      maxBlockFileSize: 20, // 大文件分块阈值，单位KB；超过该大小的文件需要分块处理
      systemPrompt: '', // 系统提示语
      encoding: 'auto', // 命令行编码格式, 可设置为utf-8、gbk等, 也可以设置成auto或空值自动判断
      aiConfig: {
        name: 'deepseek',
        type: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-reasoner',
        apiKey: '',
        temperature: 0.7,
        maxTokens: 8, // 最大输出长度，单位KB
        maxContextLength: 64, // 最大上下文大小，单位KB
        stream: true,
      },
    },
  ) {
    opt = lodash.cloneDeep(opt)
    this.originOpt = lodash.cloneDeep(opt)
    this.opt = opt
    this.config = opt
    this.id = opt.id || Date.now().toString()
    this.name = opt.name || 'AgentRobot'
    this._initFiles(opt) // 初始化文件

    this.originalTools = this._getOriginalTools() // 天赋技能
    this.attachTools = this._getAttachTools() // 附加技能
    this.systemPrompt = opt.systemPrompt || this._getDefaultSystemPrompt(opt) // 系统提示语
    this.screenPrinter = new ScreenPrinter() // 屏幕打印机
    this.brain = new Brain(this) // 初始化大脑
    this.hand = new Hand(this) // 初始化手
    this._initEvents() // 初始化大脑事件
  }

  // 初始化文件
  _initFiles(opt) {
    this.root = opt.root
    this.parent = opt.parent
    this.workspace = opt.workspace || process.cwd() // 工作空间，目录
    this.basespace = opt.basespace || path.join(os.homedir(), '.deepfish-ai') // 记忆空间，目录
    this.memerySpace = path.join(this.basespace, 'memery') // 记忆空间，目录
    this.agentRecordFilePath = path.join(this.memerySpace, 'agentRecord.json')
    this.agentSpace = path.join(this.memerySpace, this.root.id) // 机器人空间，目录
    this.agentTreeFilePath = path.join(this.agentSpace, 'agentTree.json')
    this.memoryFilePath = path.join(this.agentSpace, `memory-${this.id}.json`)
    this.logDirPath = path.join(this.agentSpace, 'logs')
    let agentRecord = fs.readJsonSync(this.agentRecordFilePath)
    // 自动清除过期的记忆和日志
    const currentDate = dayjs()
    agentRecord = agentRecord.filter((record) => {
      if (
        currentDate.diff(dayjs(record.updateTime), 'day') >
        opt.maxMemoryExpireTime
      ) {
        // 删除机器人空间
        fs.removeSync(path.join(this.memerySpace, record.agentId))
        return false
      }
      return true
    })
    fs.writeJsonSync(this.agentRecordFilePath, agentRecord, { spaces: 2 })
    this.logger = new Logger(this) // 初始化日志系统
    this.logger.clearAllLogs()
  }

  _initEvents() {
    const aiConfig = this.opt.aiConfig
    let stopLoading = null
    this.brain.on(BrainEvent.THINK_BEFORE, () => {})
    this.brain.on(BrainEvent.SUB_THINK_BEFORE, () => {
      if (!aiConfig.stream) {
        if (stopLoading) {
          stopLoading('I have finished thinking.')
        }
        stopLoading = this.screenPrinter.loading('Thinking...')
      }
    })
    this.brain.on(BrainEvent.SUB_THINK_AFTER, (messages) => {
      if (!aiConfig.stream && stopLoading) {
        stopLoading('I have finished thinking.')
        stopLoading = null
        const lastMessage = messages[messages.length - 1]
        this.screenPrinter.logInfo(lastMessage.content)
        this.logger.logMessage(lastMessage)
      } else {
        this.screenPrinter.streamLineBreak()
      }
    })
    this.brain.on(BrainEvent.SUB_STREAM_THINK_OUTPUT, (messages, output) => {
      this.screenPrinter.streamOutput(output, '#47854a')
    })
    this.brain.on(BrainEvent.SUB_STREAM_CONTENT_OUTPUT, (messages, content) => {
      this.screenPrinter.streamOutput(content, '#c2a654')
    })
    this.brain.on(
      BrainEvent.SUB_STREAM_TOOL_CALLS_OUTPUT,
      (messages, toolCalls) => {
        this.screenPrinter.streamOutput(toolCalls, '#47854a')
      },
    )
    this.brain.on(BrainEvent.SUB_STREAM_END, () => {
      this.screenPrinter.streamLineBreak()
    })
    this.brain.on(BrainEvent.SUB_USE_TOOL, async (toolCalls) => {
      await this.hand.useTools(toolCalls)
    })
    this.brain.on(
      BrainEvent.COMPRESS_MESSAGES_BEFORE,
      (messages, currentLength) => {
        this.screenPrinter.logInfo(
          `compressing messages: current length ${currentLength}, count ${messages.length}`,
        )
      },
    )
    this.brain.on(
      BrainEvent.COMPRESS_MESSAGES_AFTER,
      (newMessages, currentLength) => {
        this.screenPrinter.logInfo(
          `compressed messages: new length ${currentLength}, count ${newMessages.length}`,
        )
        this.logger.logCompress(newMessages)
      },
    )
    this.brain.on(BrainEvent.THINK_AFTER, (content) => {
      this.screenPrinter.logSuccess(content)
    })
    this.brain.on(BrainEvent.SUB_THINK_ERROR, (messages, error) => {
      this.screenPrinter.logError(
        `I have an error during thinking: ${error.error}`,
      )
      this.logger.logInfo(`I have an error during thinking: ${error.error}`)
    })
    this.hand.on(HandEvent.USE_TOOL_BEFORE, (toolId, funcName, funcArgs) => {
      this.screenPrinter.logInfo(`I'm using tool ${funcName}`)
    })
    this.hand.on(HandEvent.USE_TOOL_REPORT, (toolId, funcName, toolContent) => {
      this.brain.storeToolReport(toolId, toolContent)
    })
    this.hand.on(HandEvent.USE_TOOL_ERROR, (toolId, funcName, error) => {
      this.brain.storeToolReport(toolId, error)
      this.screenPrinter.logError(
        `I have an error when using tool ${funcName}: ${error.error}`,
      )
      this.logger.logInfo(
        `I have an error when using tool ${funcName}: ${error.error}`,
      )
    })
    this.hand.on(HandEvent.USE_TOOL_AFTER, (toolId, funcName, funcArgs) => {
      this.screenPrinter.logInfo(`I have finished using tool ${funcName}`)
      this.logger.logInfo(`I have finished using tool ${funcName}`)
    })
  }

  getTools() {
    const tools = [...this.originalTools, ...this.attachTools]
    const toolFunctions = {}
    tools.forEach((tool) => {
      Object.assign(toolFunctions, tool.functions)
    })
    toolFunctions.agentRobot = this
    return toolFunctions
  }

  getToolDescriptions() {
    const tools = [...this.originalTools, ...this.attachTools]
    const toolDescriptions = []
    tools.forEach((tool) => {
      toolDescriptions.push(...tool.descriptions)
    })
    return toolDescriptions
  }

  // 获取天赋
  _getOriginalTools() {
    return [FileSkill, InquirerSkill, SystemSkill]
  }

  // 获取附加工具
  _getAttachTools() {
    // 从文件中加载附加技能
    // 1.搜索程序所在目录下的以deepfish-ai-开头的文件夹
    // 2.搜索程序所在目录下以@deepfish-ai开头的文件夹里的目录
    // 3.工作目录下node_modules目录下以deepfish-ai-开头的文件夹
    // 4.工作目录下node_modules目录下以@deepfish-ai开头的文件夹里的目录
    // 5.工作目录下以deepfish-ai-开头的文件夹

    /**
     * 附加工具结构：
     * name: 'BaseSkill',
     * description: '基础扩展模板，提供扩展的基本结构定义',
     * location: currentDir, // 扩展文件路径，默认为当前文件所在目录
     * platform: 'all', // 扩展支持的平台(process.platform)，all或空表示所有平台, win32表示仅支持 Windows, darwin表示仅支持MacOS, linux表示仅支持Linux
     * descriptions,
     * functions,
     */
    // 1. 子agent创建时，不能再创建相同tool的agent
    // 2. 使用platform过滤
    return []
  }

  _getAttachToolPrompt() {
    const table = this.attachTools
      .map(
        (s) =>
          `| ${s.name} | ${s.description} | ${s.location} | ${s.filePath} |`,
      )
      .join('\n')
    return `
### 可以使用的Skill
除了使用内置函数，还可以调用以下Skill来完成用户的请求，Skill的调用方式：当用户的请求匹配技能描述时，调用executeSkill函数加载对应Skill的SKILL.md说明文件，获取调用说明，通过仔细阅读说明文件学习Skill的使用方法，来完成任务。
## Available Skills

| Skill | Description | Location | FilePath |
|-------|-------------|----------|----------|
${table}

## Skills Policy
- 当用户请求匹配 skill description 时，调用 executeSkill 函数加载对应 SKILL.md
- 一次只加载一个Skill，优先匹配最具体的Skill
- 当用户请求不匹配任何Skill描述时，不加载任何Skill
- Skill即你可以使用的技能`
  }

  _getDefaultSystemPrompt(opt) {
    const osType = process.platform
    const workspace = this.workspace
    const maxBlockFileSize = opt.maxBlockFileSize || 20
    const id = this.id
    const name = this.name
    return `
你叫${name}, 编号${id}, 是一个严格按规则执行任务的智能体，不能违反任何系统限制。
### 基础环境信息
当前工作目录：${workspace}
操作系统类型：${osType}
语言类型: 与用户输入语言一致

### 工具使用规则
1.系统中有两种工具可以调用：一种是系统内置的工具函数（扩展工具），另一种是Skill工具包。优先使用系统内置工具函数，只有在系统内置工具函数无法满足需求时才使用Skill工具包。
2.创建工具函数时，需要先调用generateExtensionRule函数查看生成规则
3.创建Skill工具包时，需要先调用generateSkillPackageRule函数查看生成规则
4.工具调用需确保语法/指令符合当前操作系统规范（Windows/macOS/Linux 区分）。

### 大文本文件处理规则（分步执行）
处理长文档等大文件（单文件＞${maxBlockFileSize}KB）时，必须按以下步骤分块处理：
1. 预处理：先执行文件大小/结构检查（如通过命令行/JS 代码获取文件大小、判断文件格式），输出检查结果；
2. 分块规则：按5KB-10KB/块拆分文件，拆分后每个块生成独立临时文件（命名格式：tmp_block_{原文件名}_chunk{序号}.tmp）；
3. 处理逻辑：翻译/总结/分析类任务逐块处理，每块处理完成后记录结果，最后合并所有块的结果生成最终文件；
4. 合并校验：合并后需校验结果完整性（如总字符数匹配、无内容缺失），确保分块处理无遗漏。

### 核心执行原则
1. 最优路径优先：执行前必须先规划最少步骤的操作路径，明确「先做什么、再做什么、哪些可省略」，避免重复操作和无效步骤；
2. 异常反馈：操作失败（如命令执行报错、文件不存在）时，需明确说明「失败原因+可尝试的解决方案」，而非仅提示“操作失败”；
3. 结果校验：任务完成后，需简单校验结果是否符合用户目标（如文件是否生成、内容是否完整），并向用户反馈校验结果。
4. 如果执行任务过程中需要安装依赖、软件或工具，必须通过调用用户交互函数与用户交互，等待用户确认后再执行安装，除非用户明确说明执行过程中使用静默模式。
5. 任务执行过程中，产生的所有临时文件（如分块文件、测试文件等）必须以"tmp_"为前缀命名，如"tmp_block_filename.txt、tmp_test_filename.txt、tmp_bak_filename.txt"，并在任务完成后删除这些临时文件，确保工作目录整洁。
    `
  }

  async executeTask(goal) {
    await this.brain.thinkLoop(goal)
  }

  destroy() {
    this.brain.removeAllListeners()
    this.state = -1
  }
}
