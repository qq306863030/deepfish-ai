const { EventEmitterSuper } = require('eventemitter-super')

const HandEvent = {
  USE_TOOL_BEFORE: '1',
  USE_TOOL_REPORT: '1.1',
  USE_TOOL_ERROR: '1.2',
  USE_TOOL_AFTER: '2',
}

class Hand extends EventEmitterSuper {
  constructor(agentRobot) {
    super()
    this.agentRobot = agentRobot
    this.maxBlockFileSize = agentRobot.opt.maxBlockFileSize || 20 // KB
    this.tools = agentRobot.toolManager.functions
  }

  _parseToolCalls(tool_call) {
    const { id, function: func } = tool_call
    const { name, arguments: args } = func
    let parsedArgs
    try {
      parsedArgs = typeof args === 'string' ? JSON.parse(args) : args
    } catch (error) {
      if (typeof args === 'string') {
        parsedArgs = {
          value: args,
        }
      }
    }
    return {
      toolId: id,
      funcArgs: parsedArgs,
      funcName: name,
    }
  }

  _getFunctionParamNames(fn) {
    if (typeof fn !== 'function') return []
    const src = fn.toString()
    const match = src.match(/^[\s\S]*?\(([^)]*)\)/)
    if (!match) return []
    return match[1]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.replace(/\s*=.*$/, '').trim())
  }

  _buildOrderedArgs(fn, funcArgs) {
    if (funcArgs == null) return []
    if (Array.isArray(funcArgs)) return funcArgs
    if (typeof funcArgs !== 'object') return [funcArgs]
    const paramNames = this._getFunctionParamNames(fn)
    if (paramNames.length === 0) return Object.values(funcArgs)
    return paramNames.map((name) => funcArgs[name])
  }

  _getRequiredParamNames(funcName) {
    const descriptions = this.agentRobot.toolManager.descriptions
    const current = descriptions.find((item) => item?.function?.name === funcName)
    return current?.function?.parameters?.required || []
  }

  async useTools(tool_calls) {
    for (const toolCall of tool_calls) {
      const { toolId, funcArgs, funcName } = this._parseToolCalls(toolCall)
      const toolFunctions = this.tools
      this.emit(HandEvent.USE_TOOL_BEFORE, toolId, funcName, funcArgs)
      if (toolFunctions[funcName]) {
        try {
          const requiredParams = this._getRequiredParamNames(funcName)
          if (funcArgs && typeof funcArgs === 'object' && !Array.isArray(funcArgs)) {
            const missingParams = requiredParams.filter((name) => funcArgs[name] === undefined)
            if (missingParams.length > 0) {
              throw new Error(`Missing required tool arguments for ${funcName}: ${missingParams.join(', ')}`)
            }
          }
          const orderedArgs = this._buildOrderedArgs(toolFunctions[funcName], funcArgs)
          let result = await toolFunctions[funcName](...orderedArgs)
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
                    '文件内容过大，请使用executeJSCode工具编写脚本分块读取和处理文件，避免一次性读取整个文件内容到对话中。如果不是本地文件，建议创建或下载成本地文件后再进行分块读取。',
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
          this.emit(HandEvent.USE_TOOL_ERROR, toolId, funcName, { error: true, message: error.message, stack: error.stack })
        }
        this.emit(HandEvent.USE_TOOL_AFTER, toolId, funcName, funcArgs)
      } else {
        this.emit(HandEvent.USE_TOOL_ERROR, toolId, funcName, { error: true, message: `Tool ${funcName} not found` })
      }
    }
  }
}

module.exports = {
  Hand,
  HandEvent
}
