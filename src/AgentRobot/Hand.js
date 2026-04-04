import { EventEmitterSuper } from 'eventemitter-super'

export const HandEvent = {
  USE_TOOL_BEFORE: '1',
  USE_TOOL_REPORT: '1.1',
  USE_TOOL_ERROR: '1.2',
  USE_TOOL_AFTER: '2',
}

export default class Hand extends EventEmitterSuper {
  constructor(agentRobot) {
    super()
    this.agentRobot = agentRobot
    this.maxBlockFileSize = agentRobot.opt.maxBlockFileSize || 20 // KB
    this.tools = agentRobot.getSkillFunctions()
  }

  _parseToolCalls(tool_call) {
    const { id, function: func } = tool_call
    const { name, arguments: args } = func
    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args
    return {
      toolId: id,
      funcArgs: parsedArgs,
      funcName: name,
    }
  }

  async useTools(tool_calls) {
    for (const toolCall of tool_calls) {
      const { toolId, funcArgs, funcName } = this._parseToolCalls(toolCall)
      const toolFunctions = this.tools
      this.emit(HandEvent.USE_TOOL_BEFORE, toolId, funcName, funcArgs)
      const toolFunction = toolFunctions[funcName]
      if (toolFunction) {
        try {
          let result = await toolFunction(...Object.values(funcArgs))
          let toolContent = JSON.stringify(result)
          if (funcName !== 'requestAI') {
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
                  preview: toolContent.substring(0, 1000) + '...',
                }
              } else {
                toolContent = {
                  truncated: true,
                  message: '结果数据量过大，请使用更具体的查询或分块处理。',
                  preview: toolContent.substring(0, 1000) + '...',
                }
              }
            }
          }
          this.emit(HandEvent.USE_TOOL_REPORT, toolId, funcName, toolContent)
        } catch (error) {
          this.emit(HandEvent.USE_TOOL_ERROR, toolId, funcName, { error: error.message })
        }
        this.emit(HandEvent.USE_TOOL_AFTER, toolId, funcName, funcArgs)
      } else {
        this.emit(HandEvent.USE_TOOL_ERROR, toolId, funcName, { error: `Tool ${funcName} not found` })
      }
    }
  }
}
