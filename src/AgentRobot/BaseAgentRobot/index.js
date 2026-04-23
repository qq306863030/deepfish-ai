const path = require('path')
const os = require('os')
const fs = require('fs-extra')
const lodash = require('lodash')
const { Brain } = require('./Brain.js')
const BrainEvent = require('./BrainEvent.js')
const ScreenPrinter = require('./ScreenPrinter.js')
const { HandEvent, Hand } = require('./Hand.js')
const dayjs = require('dayjs')
const axios = require('axios')
const echarts = require('echarts')
const canvas = require('canvas')
const cheerio = require('cheerio')
const puppeteer = require('puppeteer')
const AIToolManager = require('./utils/AIToolManager.js')

class BaseAgentRobot {
  id = '' // Agentid
  name = '' // Agent名字

  brain = null // 大脑，负责思考、记忆、决策
  hand = null // 手，负责使用工具
  
  heart = null // 心脏，负责心跳、连接
  sender = null // 发送器，负责发送消息
  receiver = null // 接收器，负责接收消息
  screenPrinter = null // Agent连接的打印机，能向屏幕输出文字
  logger = null // Agent连接的日志系统，能记录日志
  children = [] // 子Agent，能分担任务
  parent = null // 父Agent，能分配任务
  root = null // 根Agent
  state = 0 // Agent状态，-1表示销毁 0表示空闲，1表示思考中 2表示工作中
  type = 'main' // Agent类型，main表示主Agent，sub表示子Agent，sub-skill表示子技能Agent

  workspace = null
  basespace = null
  memorySpace = null
  agentRecordFilePath = null
  agentSpace = null
  agentTree = null
  memoryFilePath = null
  logDirPath = null
  toolManager = null

  constructor(
    opt = {
      id: '',
      name: '',
      attachTools: [], // 附加工具, Agent后续安装的工具函数
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
    this.opt = opt
    this.config = opt
    this.id = opt.id || Date.now().toString()
    this.name = opt.name || 'AgentRobot'
    this.screenPrinter = new ScreenPrinter() // 屏幕打印机
    this._initFiles(opt) // 初始化文件
    this.toolManager = new AIToolManager(this)
    this.systemPrompt = opt.systemPrompt || this._getDefaultSystemPrompt(opt) // 系统提示语
    this.brain = new Brain(this) // 初始化大脑
    this.hand = new Hand(this) // 初始化手
    this._initEvents() // 初始化大脑事件
  }

  // 初始化文件
  _initFiles(opt) {}

  _initEvents() {
    const aiConfig = this.opt.aiConfig
    let stopLoading = null
    this.brain.on(BrainEvent.THINK_BEFORE, () => {})
    this.brain.on(BrainEvent.SUB_THINK_BEFORE, (messages) => {
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
        this.screenPrinter.logInfo(lastMessage?.content)
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
      if (this.type === 'main') {
        this.screenPrinter.logSuccess(content)
      } else if (this.type === 'sub') {
        this.screenPrinter.logSuccess(
          `${this.name} have finished thinking and got the result.`,
        )
      }
    })
    this.brain.on(BrainEvent.SUB_THINK_ERROR, (messages, error) => {
      this.screenPrinter.logError(
        `I have an error during thinking: ${error} ${error.message}:${error.stack || ''}`,
      )
      this.logger.logInfo(
        `I have an error during thinking: ${error.message}:${error.stack || ''}`,
      )
    })
    this.brain.on(BrainEvent.NEW_MESSAGE, (message) => {
      this.logger.logMessage(message)
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
        `I have an error when using tool ${funcName}: ${error.message},${error.stack || ''}`,
      )
      this.logger.logInfo(
        `I have an error when using tool ${funcName}: ${error.message},${error.stack || ''}`,
      )
    })
    this.hand.on(HandEvent.USE_TOOL_AFTER, (toolId, funcName, funcArgs) => {
      this.screenPrinter.logInfo(`I have finished using tool ${funcName}`)
      this.logger.logInfo(`I have finished using tool ${funcName}`)
    })
  }

  _getDefaultSystemPrompt(opt) {
    const osType = process.platform
    const workspace = this.workspace
    const maxBlockFileSize = opt.maxBlockFileSize || 20
    const id = this.id
    const name = this.name
    return `
你叫${name}, 编号${id}, 是一个严格按规则执行任务的智能体，不能违反任何系统限制，具有INTJ人格，高冷、做事以及回复问题精简、准确、不废话。
### 基础环境信息
当前工作目录：${workspace}
操作系统类型：${osType}
语言类型: 与用户输入语言一致

### 工具使用
执行任务前，应仔细阅读工具描述以及可以使用的Skills的描述内容，优先使用匹配到的工具或技能，避免自己发挥。

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
    const taskId = `task-${Date.now()}`
    this.logger.logExecTime(taskId, 'execute task goal')
    const res = await this.brain.thinkLoop(goal)
    this.logger.logExecTime(taskId, 'execute task end')
    return res
  }

  _getAgentRobotFactory() {
    if (!this._agentRobotFactory) {
      const AgentRobotFactory = require('../AgentRobotFactory/index.js')
      this._agentRobotFactory = new AgentRobotFactory()
    }
    return this._agentRobotFactory
  }

  // 创建子技能Agent
  createSubSkillAgent(id, attachTools = []) {
    const agentRobotFactory = this._getAgentRobotFactory()
    return agentRobotFactory.createSubSkillAgent(this, id, attachTools)
  }

  // 创建子Agent
  createSubAgent(id) {
    const agentRobotFactory = this._getAgentRobotFactory()
    return agentRobotFactory.createSubAgent(this, id)
  }

  destroy() {
    this.brain.removeAllListeners()
    this.state = -1
    this.agentTree.clear()
  }
}

module.exports = BaseAgentRobot
