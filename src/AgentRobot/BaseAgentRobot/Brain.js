const fs = require('fs-extra')
const { EventEmitterSuper } = require('eventemitter-super')
const BrainEvent = require('./BrainEvent.js')
const MessageCompresser = require('./utils/MessageCompresser.js')
const { creatClient, think, thinkByTool } = require('./utils/AIRequest.js')
const lodash = require('lodash')

class Brain extends EventEmitterSuper {
  constructor(agentRobot) {
    super()
    this.messages = []
    this.maxIterations = agentRobot.opt.maxIterations
    this.maxContextLength = agentRobot.opt.aiConfig.maxContextLength
    this.memoryFilePath = agentRobot.memoryFilePath
    this.messageCompresser = new MessageCompresser(this)
    this.aiConfig = agentRobot.opt.aiConfig
    this.aiClient = creatClient(agentRobot.opt.aiConfig)
    this.agentRobot = agentRobot
    this.restoreMemory()
  }
  // 恢复记忆
  restoreMemory() {
    if (fs.existsSync(this.memoryFilePath)) {
      const messages = fs.readJsonSync(this.memoryFilePath) || []
      // 预处理
      this.messages = this._initMessages(messages)
    }
  }
  // 写入记忆
  storeMemory(message) {
    this.messages.push(message)
    fs.writeJsonSync(this.memoryFilePath, this.messages, { spaces: 2 })
    this.emit(BrainEvent.NEW_MESSAGE, message)
  }
  storeToolReport(toolId, toolReport) {
    if (typeof toolReport === 'object') {
      toolReport = JSON.stringify(toolReport)
    }
    const message = {
      role: 'tool',
      tool_call_id: toolId,
      content: toolReport,
    }
    this.storeMemory(message)
  }

  clearMemory() {
    fs.removeSync(this.memoryFilePath)
  }
  // 循环思考
  async thinkLoop(goal) {
    let maxIterations = this.maxIterations
    if (this.messages.length === 0) {
      // 初始化message
      this.storeMemory({
        role: 'system',
        content: this.agentRobot.systemPrompt,
      })
      this.storeMemory({
        role: 'user',
        content: goal,
      })
    } else {
      this.storeMemory({
        role: 'user',
        content: goal,
      })
    }
    let messages = this.messages
    if (maxIterations === -1) {
      maxIterations = Infinity
    }
    const skillDescriptions = this.agentRobot.toolManager.descriptions
    this.emit(BrainEvent.THINK_BEFORE, messages)
    while (maxIterations-- > 0) {
      try {
        // 更新系统提示词
        if (messages[0].role === 'system') {
          messages[0] = {
            role: 'system',
            content: this.agentRobot.systemPrompt,
          }
        }
        // 压缩上下文
        await this.messageCompresser.compress(messages)
        const { message, content, tool_calls } = await thinkByTool(
          this.aiClient,
          this.aiConfig,
          messages,
          skillDescriptions,
          () => {
            this.emit(BrainEvent.SUB_THINK_BEFORE, messages)
          },
          () => {
            this.emit(BrainEvent.SUB_THINK_AFTER, messages)
          },
          (thinkOutput) => {
            this.emit(BrainEvent.SUB_STREAM_THINK_OUTPUT, messages, thinkOutput)
          },
          (contentOutput) => {
            this.emit(
              BrainEvent.SUB_STREAM_CONTENT_OUTPUT,
              messages,
              contentOutput,
            )
          },
          (toolCallsOutput) => {
            this.emit(
              BrainEvent.SUB_STREAM_TOOL_CALLS_OUTPUT,
              messages,
              toolCallsOutput,
            )
          },
          () => {
            this.emit(BrainEvent.SUB_STREAM_END, messages)
          },
        )
        this.storeMemory(message)
        // 检查是否是任务完成的总结响应（没有工具调用且有内容）
        if (tool_calls) {
          await this.emitPromise(BrainEvent.SUB_USE_TOOL, tool_calls)
        } else {
          break
        }
      } catch (error) {
        this.emit(BrainEvent.SUB_THINK_ERROR, messages, error)
        return `AI response error: ${error.message}`
      }
    }
    const lastMessageContent = messages[messages.length - 1]?.content || ''
    this.emit(BrainEvent.THINK_AFTER, lastMessageContent)
    return lastMessageContent
  }

  async think(systemPrompt, prompt, temperature) {
    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: prompt,
      },
    ]
    try {
      const aiConfig = lodash.cloneDeep(this.aiConfig)
      if (temperature) {
        aiConfig.temperature = temperature
      }
      const result = await think(
        this.aiClient,
        aiConfig,
        messages,
        () => {
          this.emit(BrainEvent.SUB_THINK_BEFORE, messages)
        },
        () => {
          this.emit(BrainEvent.SUB_THINK_AFTER, messages)
        },
        (thinkOutput) => {
          this.emit(BrainEvent.SUB_STREAM_THINK_OUTPUT, messages, thinkOutput)
        },
        (contentOutput) => {
          this.emit(
            BrainEvent.SUB_STREAM_CONTENT_OUTPUT,
            messages,
            contentOutput,
          )
        },
        (toolCallsOutput) => {
          this.emit(
            BrainEvent.SUB_STREAM_TOOL_CALLS_OUTPUT,
            messages,
            toolCallsOutput,
          )
        },
        () => {
          this.emit(BrainEvent.SUB_STREAM_END, messages)
        },
      )
      return result
    } catch (error) {
      this.emit(BrainEvent.SUB_THINK_ERROR, messages, error)
      return `AI response error: ${error.message}`
    }
  }

  _initMessages(messages) {
    let lastMessage = messages[messages.length - 1]
    while (
      messages.length > 1 &&
      !(
        lastMessage.role === 'assistant' &&
        !lastMessage.tool_calls &&
        lastMessage.content
      )
    ) {
      messages.pop()
      lastMessage = messages[messages.length - 1]
    }
    return messages
  }
}

module.exports = {
  Brain,
  BrainEvent
}
