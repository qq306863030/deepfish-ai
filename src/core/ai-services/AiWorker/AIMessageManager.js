/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-16 09:18:05
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-25 15:27:58
 * @FilePath: \deepfish\src\core\ai-services\AiWorker\AIMessageManager.js
 * @Description: 上下文管理-添加、自动压缩
 * @
 */
const { logError, logInfo } = require('../../utils/log')
const { aiRequestSingle } = require('./AiTools')
const { GlobalVariable } = require('../../globalVariable')

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
    GlobalVariable.historyManager.record(this.messages)
    GlobalVariable.historyManager.log(message)
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
    GlobalVariable.historyManager.record(this.messages)
    GlobalVariable.historyManager.log(message)
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
      (this.config.maxMessagesLength !== -1 && currentLength > this.config.maxMessagesLength) ||
      (this.config.maxMessagesCount !== -1 && currentCount > this.config.maxMessagesCount)
    ) {
      logInfo(
        `Managing messages: current length ${currentLength}, count ${currentCount}`,
      )
      let newMessages = []
      if (messages.length > 2) {
        // 始终只保留system和user的最后一条消息，以及最后两条消息，其他消息进行压缩
        const systemMessage = messages[0]
        // 查询最后一条用户消息
        const lastUserMessageIndex = messages.findIndex(
          (m) => m.role === 'user',
        )
        // 压缩第二条到lastUserMessageIndex之间的消息
        const messages1 = messages.slice(1, lastUserMessageIndex)
        newMessages = [systemMessage]
        if (messages1.length > 0) {
          const summary1 = await this._getSummary(messages1)
          newMessages.push(summary1)
          GlobalVariable.historyManager.log(summary1, true)
        }
        if (lastUserMessageIndex < messages.length - 2) {
          newMessages.push(messages[lastUserMessageIndex])
          // 压缩lastUserMessageIndex到倒数第二条消息之间的消息
          const messages2 = messages.slice(lastUserMessageIndex + 1, -2)
          if (messages2.length > 0) {
            const summary2 = await this._getSummary(messages2)
            newMessages.push(summary2)
            GlobalVariable.historyManager.log(summary2, true)
          }
          newMessages.push(...messages.slice(-2))
        } else if (lastUserMessageIndex === messages.length - 2) {
          newMessages.push(messages[lastUserMessageIndex])
          newMessages.push(messages[messages.length - 1])
        } else if (lastUserMessageIndex === messages.length - 1) {
          newMessages.push(messages[lastUserMessageIndex])
        }
        GlobalVariable.historyManager.record(newMessages)
      } else if (messages.length === 2) {
        const summary = await this._getSummary([messages[1]])
        newMessages.push([messages[0], summary])
      }
      return newMessages
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
  1. 只需要关注用户输入的任务目标和AI的执行结果，删除过程中的细节描述和执行过程中的失败信息等无用信息;
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
      const summary = await aiRequestSingle(
        this.aiClient,
        this.aiConfig,
        'You are a helpful assistant that creates concise summaries of conversations.',
        summaryPrompt,
      )
      return {
        role: 'user',
        content: summary,
      }
    } catch (error) {
      logError('Failed to summarize messages: ' + error.message)
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
        role: 'user',
        content: manualSummary,
      }
    }
  }
}

module.exports = AIMessageManager
