import fs from 'fs-extra'
import path from 'path'
import { EventEmitterSuper } from 'eventemitter-super'
import MessageCompresser from './utils/MessageCompresser'

export class BrainEvent {
    static THINK_BEFORE = '1' // 思考前事件，参数为当前消息列表
    static SUB_THINK_BEFORE = '1.1' // 子思考前事件，参数为当前消息列表
    static SUB_THINK_AFTER = '1.2' // 子思考后事件，参数为当前消息列表和思考结果
    static USE_TOOL = '1.3' // 使用工具事件，参数为工具调用列表
    static COMPRESS_MESSAGES_BEFORE = '1.4' // 压缩消息事件，参数为当前消息列表
    static COMPRESS_MESSAGES_AFTER = '1.5' // 压缩消息后事件，参数为压缩后的消息列表
    static THINK_AFTER = '2' // 思考后事件，参数为当前消息列表
}

export default class Brain extends EventEmitterSuper {
  constructor(agentRobot) {
    super()
    this.messages = []
    this.maxIterations = agentRobot.maxIterations
    this.maxContextLength = agentRobot.opt.maxContextLength
    this.memoryFilePath = path.join(agentRobot.opt.basespace,'memory.json')
    this.systemPrompt = agentRobot.opt.systemPrompt // 系统提示词
    this.messageCompresser = new MessageCompresser(this)
    this.restoreMemory()
  }
  // 恢复记忆
  restoreMemory() {
    if (fs.existsSync(this.memoryFilePath)) {
      this.messages = fs.readJsonSync(this.memoryFilePath)
    }
  }
  // 写入记忆
  storeMemory(message) {
    this.messages.push(message)
    fs.writeJsonSync(this.memoryFilePath, this.messages, { spaces: 2 })
  }
  clearMemory() {
    fs.removeSync(this.memoryFilePath)
  }
  // 循环思考
  async thinkLoop() {
    let maxIterations = this.maxIterations
    let messages = this.messages
    if (messages.length === 0) {
      return ''
    }
    if (maxIterations === -1) {
      maxIterations = Infinity
    }
    this.emit(BrainEvent.THINK_BEFORE, messages)
    while (maxIterations-- > 0) {
      // 压缩上下文
      await this.messageCompresser.compress(messages)
      this.emit(BrainEvent.SUB_THINK_BEFORE, messages)
      const { message, content, tool_calls } = await this.thinkLoopSkill(
        this.aiClient,
        this.aiConfig,
        messages,
        this.extensionTools.descriptions,
      )
      this.emit(BrainEvent.SUB_THINK_AFTER)
      // 检查是否是任务完成的总结响应（没有工具调用且有内容）
      if (tool_calls) {
        this.emit(BrainEvent.USE_TOOL, tool_calls)
      } else {
        break
      }
    }
    const lastMessageContent = messages[messages.length - 1]?.content || ''
    this.emit(BrainEvent.THINK_AFTER, lastMessageContent)
    return lastMessageContent
  }
  // 思考
  async think(messages) {
    
  }
  
}
