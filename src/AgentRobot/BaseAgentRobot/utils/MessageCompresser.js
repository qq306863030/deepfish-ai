/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-16 09:18:05
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-04-13 11:21:09
 * @FilePath: \deepfish\src\AgentRobot\BaseAgentRobot\utils\MessageCompresser.js
 * @Description: 上下文管理-添加、自动压缩
 * @
 */
const BrainEvent = require('../BrainEvent.js')

class MessageCompresser {
  constructor(robotBrain) {
    this.robotBrain = robotBrain
    // 最大上下文长度，留10%余量
    this.maxContextLength = (this.robotBrain.maxContextLength || 32) * 1024 * 0.9
    // 固定保留最新 X 条消息不压缩（行业最佳实践）
    this.KEEP_LATEST_COUNT = 3
  }

  /**
   * 压缩消息：稳定版策略
   * 保留：第一条system + 最新3条消息 + 中间压缩为摘要
   */
  async compress(messages) {
    // 空消息直接返回
    if (!messages || messages.length === 0) return messages

    const currentLength = this._getLength(messages)
    // 不需要压缩直接返回
    if (this.maxContextLength !== -1 && currentLength <= this.maxContextLength) {
      return messages
    }

    this.robotBrain.emit(BrainEvent.COMPRESS_MESSAGES_BEFORE, messages, currentLength)

    // ---------------------
    // 核心：安全截取规则
    // ---------------------
    const newMessages = []
    const totalMsg = messages.length

    // 1. 永远保留第一条 system 消息
    const firstSystem = messages[0]
    newMessages.push(firstSystem)

    // 2. 消息太少，不压缩
    if (totalMsg <= this.KEEP_LATEST_COUNT + 1) {
      this.robotBrain.emit(BrainEvent.COMPRESS_MESSAGES_AFTER, newMessages, this._getLength(newMessages))
      return [...messages]
    }

    // 3. 中间需要压缩的区间：第1条 ~ 倒数第KEEP_LATEST_COUNT条
    const compressStart = 1
    const compressEnd = totalMsg - this.KEEP_LATEST_COUNT
    const middleMessages = messages.slice(compressStart, compressEnd)

    // 4. 压缩中间历史
    if (middleMessages.length > 0) {
      const summary = await this._getSummary(middleMessages)
      newMessages.push(summary)
    }

    // 5. 保留最新 N 条消息（不压缩）
    const latestMessages = messages.slice(-this.KEEP_LATEST_COUNT)
    newMessages.push(...latestMessages)

    // 替换原数组
    messages.splice(0, messages.length, ...newMessages)

    this.robotBrain.emit(BrainEvent.COMPRESS_MESSAGES_AFTER, messages, this._getLength(newMessages))
    return messages
  }

  // 计算消息总长度（稳健版）
  _getLength(messages) {
    return messages.reduce((total, msg) => {
      let len = 0
      if (msg.content) {
        len += typeof msg.content === 'string'
          ? msg.content.length
          : JSON.stringify(msg.content).length
      }
      if (msg.tool_calls) {
        len += JSON.stringify(msg.tool_calls).length
      }
      return total + len
    }, 0)
  }

  // 生成对话摘要（优化提示词 + 错误兜底）
  async _getSummary(messages) {
    const conversationText = messages
      .map(m => {
        const role = m.role.toUpperCase()
        const content = m.content || (m.tool_calls ? '[工具调用]' : '')
        return `[${role}]: ${content}`
      })
      .join('\n')

    const summaryPrompt = `
请总结以下对话历史，严格遵守规则：
1. 只保留：用户任务目标、执行结果、关键上下文
2. 删除：报错、冗余描述、闲聊、过程细节
3. 摘要必须简洁、完整，保证后续任务能正常继续
4. 不要多余解释，只输出纯摘要文本

对话历史：
${conversationText}`

    try {
      const summary = await this.robotBrain.think(
        '你是专业的对话摘要助手，只输出精简摘要',
        summaryPrompt
      )
      return {
        role: 'system',
        content: `【历史对话摘要】：${summary}`,
      }
    } catch (error) {
      // 降级方案：手动截取
      let manual = '【历史摘要（降级）】：'
      messages.slice(0, 4).forEach(m => {
        const c = m.content || ''
        manual += `${m.role}：${c.slice(0, 80)}... `
      })
      return { role: 'system', content: manual }
    }
  }
}

module.exports = MessageCompresser
