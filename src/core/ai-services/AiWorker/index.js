/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-16 09:18:05
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-25 20:25:28
 * @FilePath: \deepfish\src\core\ai-services\AiWorker\index.js
 * @Description: 工作流类
 * @
 */
const AiAgent = require('./AiAgent')
const {
  getInitialMessages,
  getInitialMessagesForSkill,
  getInitialMessagesForTest,
  getSystemPrompt,
} = require('./AiTools')

class AiWorker {
  constructor(aiCli, client) {
    this.aiCli = aiCli
    this.client = client
    this.historyManager = this.aiCli.historyManager
    this.messages = []
    this.aiAgent = new AiAgent(
      this.client,
      this.aiCli.config,
      this.aiCli.aiConfig,
      this.aiCli.extensionManager.extensions,
    )
  }

  async main(goal) {
    // 自动加载历史记录
    if (this.messages.length === 0) {
      const messages = this.historyManager.getMessage()
      if (messages.length) {
        // 更新系统skill提示词
        const systemPrompt = getSystemPrompt()
        messages[0].content = systemPrompt
        this.clearUserMessage(messages)
        this.messages = messages
        // await this.loadHhistoryMessages(messages)
        await this.main(goal)
      } else {
        this.messages = getInitialMessages(goal)
        await this.aiAgent.work(this.messages)
      }
    } else {
      this.aiAgent.aiMessageManager.reLinkMsgs(this.messages)
      this.aiAgent.aiMessageManager.addMsg({
        role: 'user',
        content: goal,
      })
      await this.aiAgent.work(this.messages)
    }
  }

  subSkillAgent(skillContent, goal) {
    const aiAgent = new AiAgent(
      this.client,
      this.aiCli.config,
      this.aiCli.aiConfig,
      this.aiCli.extensionManager.extensions,
    )
    const initMessages = getInitialMessagesForSkill(skillContent, goal)
    return aiAgent.work(initMessages)
  }

  subTestAgent(goal) {
    const aiAgent = new AiAgent(
      this.client,
      this.aiCli.config,
      this.aiCli.aiConfig,
      this.aiCli.extensionManager.extensions,
    )
    const initMessages = getInitialMessagesForTest(goal)
    return aiAgent.work(initMessages)
  }

  clearUserMessage(messages) {
    while (
      messages.length > 0 &&
      messages[messages.length - 1].role === 'user'
    ) {
      messages.pop()
    }
    let lastMessage = messages[messages.length - 1]
    if (lastMessage.role === 'assistant' && lastMessage.tool_calls) {
      messages.pop()
    }
    while (
      messages.length > 0 &&
      messages[messages.length - 1].role === 'user'
    ) {
      messages.pop()
    }
    lastMessage = messages[messages.length - 1]
    if (lastMessage.role === 'tool' && lastMessage.tool_call_id) {
      messages.push({
        role: 'assistant',
        content:
          '上次对话未完成，已清除用户输入，请重新输入。',
        reasoning_content: '',
      })
    }
  }

  async loadHhistoryMessages(messages) {
    // 判断是否已经完成
    let lastMessage = messages[messages.length - 1]
    if (lastMessage.role === 'assistant' && !lastMessage.tool_calls) {
      // 说明已经执行完毕，直接返回
      this.messages = messages
      return
    }
    this.messages = messages
    this.aiAgent.aiMessageManager.reLinkMsgs(this.messages)
    if (lastMessage.role === 'tool') {
      // 删除最后一项
      messages.pop()
    }
    lastMessage = messages[messages.length - 1]
    if (lastMessage.role === 'assistant' && lastMessage.tool_calls) {
      // 最后一项正在执行工具，则重新执行
      await this.aiAgent.execTools(lastMessage.tool_calls)
      await this.aiAgent.work(this.messages)
    } else if (lastMessage.role === 'assistant' && lastMessage.content) {
      return lastMessage.content || ''
    } else if (lastMessage.role === 'user') {
      // 最后一项是用户输入，说明是新的一轮对话
      await this.aiAgent.work(this.messages)
    }
    return ''
  }
}

module.exports = AiWorker
