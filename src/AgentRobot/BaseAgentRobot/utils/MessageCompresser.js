/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-16 09:18:05
 * @LastEditors: roman_123 306863030@qq.com
 * @LastEditTime: 2026-04-08 00:50:20
 * @FilePath: \deepfish\src\AgentRobot\BaseAgentRobot\utils\MessageCompresser.js
 * @Description: 上下文管理-添加、自动压缩
 * @
 */
const { BrainEvent } = require('../Brain.js')

class MessageCompresser {
  constructor(robotBrain) {
    this.robotBrain = robotBrain
    this.maxContextLength = (this.robotBrain.maxContextLength || 32) * 1024 * 0.9 // 留出10%空间给工具调用等其他内容
  }
  /**
   * 压缩消息，根据配置压缩消息长度和数量
   * @param {*} messages
   * @returns
   */
  async compress(messages) {
    const currentLength = this._getLength(messages)
    if (this.maxContextLength !== -1 && currentLength > this.maxContextLength) {
      this.robotBrain.emit(
        BrainEvent.COMPRESS_MESSAGES_BEFORE,
        messages,
        currentLength,
      )
      if (messages.length > 2) {
        // 始终保留：第一条system、最后一条user、最后两条消息（有可能包含user）；其余区间压缩
        let firstSystemMessageIndex = 0
        let lastUserMessageIndex = -1
        for (let i = messages.length - 1; i >= 0; i--) {
          if (lastUserMessageIndex === -1 && messages[i].role === 'user') {
            lastUserMessageIndex = i
          }
          if (lastUserMessageIndex !== -1) {
            break
          }
        }

        const keepIndexSet = new Set([messages.length - 2, messages.length - 1])
        keepIndexSet.add(firstSystemMessageIndex)
        if (lastUserMessageIndex !== -1) {
          keepIndexSet.add(lastUserMessageIndex)
        }

        const keepIndexes = [...keepIndexSet]
          .filter((index) => index >= 0 && index < messages.length)
          .sort((a, b) => a - b)

        let newMessages = []
        let startIndex = 0

        for (const keepIndex of keepIndexes) {
          if (keepIndex > startIndex) {
            const chunk = messages.slice(startIndex, keepIndex)
            if (chunk.length > 0) {
              const summary = await this._getSummary(chunk)
              newMessages.push(summary)
            }
          }
          newMessages.push(messages[keepIndex])
          startIndex = keepIndex + 1
        }

        if (startIndex < messages.length) {
          const chunk = messages.slice(startIndex)
          if (chunk.length > 0) {
            const summary = await this._getSummary(chunk)
            newMessages.push(summary)
          }
        }
        messages.splice(0, messages.length, ...newMessages)
      } else if (messages.length === 2) {
        // 消息过少时直接保留最后两条消息
        const summary = await this._getSummary([messages[1]])
        messages.splice(0, messages.length, messages[0], summary)
      }
      this.robotBrain.emit(
        BrainEvent.COMPRESS_MESSAGES_AFTER,
        messages,
        this._getLength(messages),
      )
      return messages
    }
    return messages
  }
  // 计算Messges的总长度
  _getLength(messages) {
    return messages.reduce((total, msg) => {
      let length = 0
      if (msg.content) {
        length +=
          typeof msg.content === 'string'
            ? msg.content.length
            : JSON.stringify(msg.content).length
      }
      if (msg.tool_calls) {
        length += JSON.stringify(msg.tool_calls).length
      }
      return total + length
    }, 0)
  }
  // 合并消息
  async _getSummary(messages) {
    const summaryPrompt = `总结以下对话历史，重点：
  1. 只需要关注用户输入的任务目标和执行结果，删除过程中的细节描述和执行过程中的失败信息等无用信息;
  2. 删除不需要的信息，如程序报错、冗余表述、语气词、闲聊等信息;
  3. 保留和总结后续任务所需的重要背景信息并以及所需要的内容;
  4. 保持摘要简短且全面，保证后续任务有效进行.

Conversation history:
${messages
  .map((m) => {
    if (m.role === 'system') return `[SYSTEM]: ${m.content}`
    if (m.role === 'user') return `[USER]: ${m.content}`
    if (m.role === 'assistant')
      return `[ASSISTANT]: ${m.content ? m.content : '[Tool calls]'}`
    if (m.role === 'tool') return `[TOOL RESULT]: ${m.content}`
    return ''
  })
  .join('\n')}`
    try {
      const summary = await this.robotBrain.think(
        'You are a helpful assistant that creates concise summaries of conversations.',
        summaryPrompt,
      )
      return {
        role: 'system',
        content: summary,
      }
    } catch (error) {
      // 出错时手动压缩
      let manualSummary = ''
      messages.forEach((m) => {
        if (m.role === 'system') {
          manualSummary += `[SYSTEM]: ${m.content.slice(0, 100)}...\n`
        } else if (m.role === 'user') {
          manualSummary += `[USER]: ${m.content.slice(0, 100)}...\n`
        } else if (m.role === 'assistant') {
          manualSummary += `[ASSISTANT]: ${m.content ? m.content.slice(0, 100) : '[Tool calls]'}...\n`
        } else if (m.role === 'tool') {
          manualSummary += `[TOOL RESULT]: ${m.content.slice(0, 100)}...\n`
        }
      })
      return {
        role: 'system',
        content: manualSummary,
      }
    }
  }
}

module.exports = MessageCompresser
