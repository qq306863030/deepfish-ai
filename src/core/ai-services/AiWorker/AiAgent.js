/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-16 09:18:05
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-26 10:55:55
 * @FilePath: \deepfish\src\core\ai-services\AiWorker\AiAgent.js
 * @Description: 工作流循环
 * @
 */

const { logError, logInfo, loading } = require('../../utils/log')
const AIMessageManager = require('./AIMessageManager')
const { aiRequestByTools } = require('./AiTools')

class AiAgent {
  messages
  maxIterations
  goal
  aiMessageManager
  constructor(
    aiClient,
    config,
    aiConfig,
    extensionTools = { descriptions: [], functions: {} },
    messageType = 1
  ) {
    this.aiClient = aiClient
    this.config = config
    this.aiConfig = aiConfig
    this.maxIterations =
      config.maxIterations === -1 ? Infinity : config.maxIterations
    this.maxBlockFileSize = this.config.maxBlockFileSize || 20 // 默认20KB
    this.aiMessageManager = new AIMessageManager(aiClient, config, aiConfig, [], messageType)
    this.messageType = messageType
    this.extensionTools = extensionTools
    this.name = config.name
  }

  // 工作流循环
  async work(messages) {
    this.aiMessageManager.reLinkMsgs(messages)
    let maxIterations = this.maxIterations
    let loadingStop
    try {
      while (maxIterations-- > 0) {
        // 压缩上下文
        const newMessages = await this.aiMessageManager.compress(messages)
        if (messages !== newMessages) {
          messages.splice(0, messages.length, ...newMessages)
        }
        if (!this.aiConfig.stream) {
          loadingStop = loading('Thinking...')
        }
        const { message, content, tool_calls } = await aiRequestByTools(
          this.aiClient,
          this.aiConfig,
          messages,
          this.extensionTools.descriptions,
        )
        this.aiMessageManager.addMsg(message)
        if (loadingStop) {
          loadingStop(`${this.name} have finished thinking.`)
          loadingStop = null
        }
        // 检查是否是任务完成的总结响应（没有工具调用且有内容）
        if (tool_calls) {
          // 执行函数
          logInfo(content)
          await this.execTools(tool_calls)
        } else {
          if (this.messageType === 1) {
            // 只有主任务输出最后总结
            logInfo(content)
          }
          // 没有工具调用，结束
          break
        }
      }
      return messages[messages.length - 1]?.content || ''
    } catch (error) {
      if (loadingStop) {
        loadingStop(
          'AI process terminated unexpectedly: ' + error.message,
          true,
        )
      } else {
        logError('AI process terminated unexpectedly: ' + error.message)
      }
      throw error
    }
  }

  // 执行函数
  async execTools(tool_calls) {
    for (const toolCall of tool_calls) {
      const { id, function: func } = toolCall
      const { name, arguments: args } = func
      let toolFunction = this.extensionTools.functions[name]
      logInfo(`Calling tool ${toolCall.function.name}`)
      if (toolFunction) {
        try {
          const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args
          if (name === 'readFile') {
            const fileInfo = await this.extensionTools.functions['getFileInfo'](
              parsedArgs.filePath,
            )
            if (fileInfo && fileInfo.isFile && fileInfo.size > this.maxBlockFileSize * 1024) {
              this.aiMessageManager.addTool(id, {
                error:
                  '文件过大，请使用executeJSCode工具编写脚本分块读取和处理文件，避免一次性读取整个文件内容到对话中。建议使用fs.createReadStream逐行或分块读取，仅返回必要的结果或总结。',
                fileSize: fileInfo.size,
                fileSizeKB: Math.round(fileInfo.size / 1024),
              })
              continue
            }
          }
          let result = await toolFunction(...Object.values(parsedArgs))
          let toolContent = JSON.stringify(result)
          if (name !== 'requestAI') {
            const MAX_CONTENT_SIZE = this.maxBlockFileSize * 1024
            if (toolContent.length > MAX_CONTENT_SIZE) {
              if (
                typeof result === 'string' &&
                result.length > MAX_CONTENT_SIZE
              ) {
                toolContent = {
                  truncated: true,
                  message:
                    '文件内容过大，请使用executeJSCode工具编写脚本分块读取和处理文件，避免一次性读取整个文件内容到对话中。',
                  preview: toolContent.substring(0, MAX_CONTENT_SIZE) + '...',
                }
              } else {
                toolContent = {
                  truncated: true,
                  message: '结果数据量过大，请使用更具体的查询或分块处理。',
                  preview: toolContent.substring(0, MAX_CONTENT_SIZE) + '...',
                }
              }
            }
          }
          this.aiMessageManager.addTool(id, toolContent)
        } catch (error) {
          this.aiMessageManager.addTool(id, { error: error.message })
        }
        logInfo(`Tool ${toolCall.function.name} finished.`)
      } else {
        this.aiMessageManager.addTool(id, { error: `Tool ${name} not found` })
        logError(`Tool ${toolCall.function.name} not found.`)
      }
    }
  }
}

module.exports = AiAgent
