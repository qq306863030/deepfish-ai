/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-16 09:18:05
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-17 17:03:16
 * @FilePath: \deepfish\src\core\ai-services\AiWorker\index.js
 * @Description: 工作流类
 * @
 */
const { logInfo } = require('../../utils')
const AiAgent = require('./AiAgent')
const { getInitialMessages } = require('./AiTools')

class AiWorker {
  constructor(aiCli, client) {
    this.aiCli = aiCli
    this.client = client
    this.aiRecorder = this.aiCli.aiRecorder
    this.messages = []
    this.aiAgent = new AiAgent(
      this.client,
      this.aiCli.config,
      this.aiCli.aiConfig,
      this.aiCli.extensionManager.extensions,
    )
  }

  async main(goal) {
    // 判断是否回复会话
    const isRecover = await this.aiRecorder.recover()
    if (isRecover) {
      const { messages } = isRecover
      // 判断是否已经完成
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'assistant' && !lastMessage.tool_calls) {
        // 说明已经执行完毕，直接返回
        this.messages = messages
        logInfo(lastMessage.content)
        return
      }
      this.messages = messages
      this.aiAgent.aiMessageManager.reLinkMsgs(this.messages)
      await this._recoverHistory(goal, this.messages)
    } else {
      if (!this.messages.length) {
        this.messages = getInitialMessages(goal)
        await this.aiAgent.work(this.messages)
      } else {
        this.aiAgent.aiMessageManager.reLinkMsgs(this.messages)
        this.aiAgent.aiMessageManager.addMsg({
          role: 'user',
          content: goal,
        })
        await this.aiAgent.work(this.messages)
      }
    }
    // this.aiRecorder.clear()
  }

  async _recoverHistory(goal, messages) {
    logInfo('Recovering from previous conversation...')
    let lastMessage = messages[messages.length - 1]
    if (lastMessage.role === 'tool') {
      // 删除最后一项
      messages.pop()
    }
    lastMessage = messages[messages.length - 1]
    if (lastMessage.role === 'assistant' && lastMessage.tool_calls) {
      // 最后一项正在执行工具，则重新执行
      await this.aiAgent.execTools(lastMessage.tool_calls)
      this.aiAgent.work(this.messages)
    } else if (lastMessage.role === 'assistant' && lastMessage.content) {
      return lastMessage.content || ''
    } else if (lastMessage.role === 'user') {
      // 最后一项是用户输入，说明是新的一轮对话
      this.aiAgent.work(this.messages)
    } else if (lastMessage.role === 'system') {
      this.aiAgent.aiMessageManager.addMsg({
        role: 'user',
        content: goal,
      })
      this.aiAgent.work(this.messages)
    }
    return ''
  }
}

module.exports = AiWorker
