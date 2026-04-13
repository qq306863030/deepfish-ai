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

    // 先清理工具调用消息序列，避免历史坏数据触发 400
    this._normalizeInPlace(messages)

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

    // 3. 中间需要压缩的区间：第1条 ~ 安全保留尾部起点
    const compressStart = 1
    const minTailStart = Math.max(1, totalMsg - this.KEEP_LATEST_COUNT)
    const safeTailStart = this._findSafeTailStart(messages, minTailStart)
    const compressEnd = safeTailStart
    const middleMessages = messages.slice(compressStart, compressEnd)

    // 4. 压缩中间历史
    if (middleMessages.length > 0) {
      const summary = await this._getSummary(middleMessages)
      newMessages.push(summary)
    }

    // 5. 保留最新消息（不压缩），并保证不会截断 tool_calls 对应关系
    const latestMessages = messages.slice(safeTailStart)
    newMessages.push(...latestMessages)

    // 再做一次序列归一化，避免压缩后出现非法 tool 消息
    const normalized = this._normalizeToolMessageSequence(newMessages)

    // 替换原数组
    messages.splice(0, messages.length, ...normalized)

    this.robotBrain.emit(BrainEvent.COMPRESS_MESSAGES_AFTER, messages, this._getLength(normalized))
    return messages
  }

  /**
   * 计算安全尾部起点，避免产生孤立的 tool 消息：
   * - 如果起点落在 tool 消息上，向前回退到触发该 tool 的 assistant(tool_calls)
   * - 如果 assistant(tool_calls) 后存在任意 tool 消息被保留，则 assistant(tool_calls) 必须一并保留
   */
  _findSafeTailStart(messages, minTailStart) {
    let start = minTailStart
    while (start > 1) {
      const current = messages[start]
      const prev = messages[start - 1]

      if (current?.role === 'tool') {
        start -= 1
        continue
      }

      if (current?.role !== 'tool' && prev?.role === 'tool') {
        start -= 1
        continue
      }

      const hasToolMessagesAfter = messages
        .slice(start + 1)
        .some((msg) => msg?.role === 'tool')
      if (current?.role === 'assistant' && current?.tool_calls && hasToolMessagesAfter) {
        return start
      }

      break
    }

    while (start < messages.length) {
      const msg = messages[start]
      if (msg?.role !== 'tool') {
        break
      }
      start += 1
    }

    return start
  }

  _normalizeInPlace(messages) {
    const normalized = this._normalizeToolMessageSequence(messages)
    if (normalized.length === messages.length && normalized.every((m, i) => m === messages[i])) {
      return
    }
    messages.splice(0, messages.length, ...normalized)
  }

  _normalizeToolMessageSequence(messages) {
    const normalized = []
    let pending = null

    const flushPending = () => {
      if (!pending) return
      const hasAllToolReports = pending.callIds.size > 0 && pending.respondedIds.size === pending.callIds.size
      if (hasAllToolReports) {
        normalized.push(pending.assistant)
        normalized.push(...pending.toolReports)
      }
      pending = null
    }

    for (const msg of messages) {
      if (msg?.role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        flushPending()
        pending = {
          assistant: msg,
          toolReports: [],
          callIds: new Set(msg.tool_calls.map((item) => item?.id).filter(Boolean)),
          respondedIds: new Set(),
        }
        continue
      }

      if (msg?.role === 'tool') {
        if (!pending) {
          continue
        }
        if (!msg.tool_call_id || !pending.callIds.has(msg.tool_call_id)) {
          continue
        }
        pending.toolReports.push(msg)
        pending.respondedIds.add(msg.tool_call_id)
        continue
      }

      flushPending()
      normalized.push(msg)
    }

    flushPending()
    return normalized
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
