import chalk from 'chalk'

export default class ScreenPrinter {
    // 日志相关工具函数
    logInfo(message) {
      this.log(message, '#6dd2ea')
    }
    
    logSuccess(message) {
      this.log(message, '#9bed7f')
    }
    
    logError(message) {
      this.log(message, '#ed7f7f')
    }
    
    logWarning(message) {
      this.log(message, '#f2c94c')
    }
    
    logDisabled(message) {
      this.log(message, '#999999')
    }
    
    writeLine(msg1, msg2 = '', color = 'blue') {
      if (color === 'blue') {
        process.stdout.write('\r' + chalk.hex('#6dd2ea')(msg1) + ' ' + msg2)
      } else if (color === 'green') {
        process.stdout.write('\r' + chalk.hex('#9bed7f')(msg1) + ' ' + msg2)
      } else if (color === 'red') {
        process.stdout.write('\r' + chalk.hex('#ed7f7f')(msg1) + ' ' + msg2)
      } else {
        process.stdout.write('\r' + chalk.hex(color)(msg1) + ' ' + msg2)
      }
    }
    
    // 流式输出
    async streamOutput(text, color = '#9bed7f') {
      process.stdout.write(chalk.hex(color)(text))
    }
    
    // 流式换行
    async streamLineBreak() {
      process.stdout.write('\n')
    }
    
    
    loading(label = 'Thinking...') {
      let animationInterval
      const spinners = ['|', '/', '-', '\\']
      let spinnerIndex = 0
      process.stdout.write('\r')
      animationInterval = setInterval(() => {
        this.writeLine(spinners[spinnerIndex], label)
        spinnerIndex = (spinnerIndex + 1) % spinners.length
      }, 200)
      return (endLabel, isError = false) => {
        clearInterval(animationInterval)
        if (endLabel) {
          this.writeLine(endLabel, '', isError ? 'red' : 'green')
        }
        process.stdout.write('\r\n')
      }
    }
    
    log(msg, color) {
      if (!color) {
        console.log(msg)
      } else {
        console.log(chalk.hex(color)(msg))
      }
    }
}