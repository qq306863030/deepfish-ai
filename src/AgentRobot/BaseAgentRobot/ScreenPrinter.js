import aiConsole from "./utils/aiConsole.js"

export default class ScreenPrinter {
    // 日志相关工具函数
    logInfo(message) {
      aiConsole.logInfo(message)
    }
    
    logSuccess(message) {
      aiConsole.logSuccess(message)
    }
    
    logError(message) {
      aiConsole.logError(message)
    }
    
    logWarning(message) {
      aiConsole.logWarning(message)
    }
    
    logDisabled(message) {
      aiConsole.logDisabled(message)
    }
    
    writeLine(msg1, msg2 = '', color = 'blue') {
      aiConsole.writeLine(msg1, msg2, color)
    }
    
    // 流式输出
    async streamOutput(text, color = '#9bed7f') {
      return aiConsole.streamOutput(text, color)
    }
    
    // 流式换行
    async streamLineBreak() {
      return aiConsole.streamLineBreak()
    }
    
    
    loading(label = 'Thinking...') {
      return aiConsole.loading(label)
    }
    
    log(msg, color) {
      aiConsole.log(msg, color)
    }
}