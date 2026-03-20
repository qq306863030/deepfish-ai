/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-16 09:18:05
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-17 10:00:50
 * @FilePath: \src\core\ai-services\AiWorker\AIMessageManager.js
 * @Description: 上下文管理-添加、自动压缩
 * @
 */
const { cloneDeep } = require('lodash')
const { logError, logInfo } = require('../../utils/log')
const { aiRequestSingle } = require('./AiTools')
const { GlobalVariable } = require('../../GlobalVariable')

class AIMessageManager {
  aiClient
  aiConfig
  config
  constructor(aiClient, config, aiConfig, messages) {
    this.aiClient = aiClient
    this.aiConfig = aiConfig
    this.config = config
    this.messages = messages
  }
  reLinkMsgs(messages) {
    this.messages = messages
  }
  // 添加消息
  addMsg(message) {
    this.messages.push(message)
    GlobalVariable.aiRecorder.record(this.messages)
    GlobalVariable.aiRecorder.log(message)
  }
  // 添加tool
  addTool(id, content) {
    if (typeof content === 'object') {
      content = JSON.stringify(content)
    }
    const message = {
      role: 'tool',
      tool_call_id: id,
      content: content,
    }
    this.messages.push(message)
    GlobalVariable.aiRecorder.record(this.messages)
    GlobalVariable.aiRecorder.log(message)
  }
  /**
   * 压缩消息，根据配置压缩消息长度和数量
   * @param {*} messages
   * @returns
   */
  async compress(messages) {
    const currentLength = this._getLength(messages)
    const currentCount = messages.length
    if (
      currentLength > this.config.maxMessagesLength ||
      currentCount > this.config.maxMessagesCount
    ) {
      logInfo(
        `Managing messages: current length ${currentLength}, count ${currentCount}`,
      )
      const systemMessage = messages[0]
      const userMessage = messages[1]
      const goal = messages[1].content
      const messagesToSummarize = messages.slice(2, -2)

      if (messagesToSummarize.length > 0) {
        messages = cloneDeep(messages)
        const summary = await this._getSummary(
          goal,
          messages.slice(-2),
          messagesToSummarize,
        )

        const newMessages = [
          systemMessage,
          userMessage,
          {
            role: 'user',
            content: `[CONVERSATION SUMMARY]: ${summary}`,
          },
          ...messages.slice(-2),
        ]
        logInfo(
          `Messages compressed: ${messages.length} -> ${newMessages.length}`,
        )
        GlobalVariable.aiRecorder.record(newMessages)
        GlobalVariable.aiRecorder.log(newMessages)
        return newMessages
      }
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
  async _getSummary(goal, lastTwoMessages, messages) {
    lastTwoMessages = lastTwoMessages
      .map((m) => {
        if (m.role === 'system') return `[SYSTEM]: ${m.content}`
        if (m.role === 'user') return `[USER]: ${m.content}`
        if (m.role === 'assistant')
          return `[ASSISTANT]: ${m.content ? m.content : '[Tool calls]'}`
        if (m.role === 'tool') return `[TOOL RESULT]: ${m.content}`
        return ''
      })
      .join('\n')
    const summaryPrompt = `请结合任务目标${goal}，和最后两轮的对话${lastTwoMessages}, 总结以下对话历史，重点：
  1. 删除不需要的信息，如程序报错、冗余表述、语气词、闲聊等信息
  2. 关注当前进度和状态
  3. 总结后续任务所需的重要背景信息并以及所需要的内容
结果只保留对上下文有用的内容，保持摘要简短且全面，保证后续任务有效进行。.

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
      const summary = await aiRequestSingle(
        this.aiClient,
        this.aiConfig,
        'You are a helpful assistant that creates concise summaries of conversations.',
        summaryPrompt,
      )
      return summary
    } catch (error) {
      logError('Failed to summarize messages: ' + error.message)
      return 'Previous conversation history was too long and has been summarized. Please continue with the current task.'
    }
  }
}

module.exports = AIMessageManager
