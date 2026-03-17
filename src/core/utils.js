const chalk = require('chalk')


// 日志相关工具函数
function logInfo(message) {
  log(message, '#6dd2ea')
}

function logSuccess(message) {
  log(message, '#9bed7f')
}

function logError(message) {
  log(message, '#ed7f7f')
}

function writeLine(msg1, msg2 = '', color = 'blue') {
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
async function streamOutput(text, color = '#9bed7f') {
  process.stdout.write(chalk.hex(color)(text))
}

// 流式换行
async function streamLineBreak() {
  process.stdout.write('\n')
}

function objStrToObj(str) {
  try {
    if (typeof str === 'string') {
      return eval(`(${str})`)
    } else {
      return str
    }
  } catch (error) {
    throw new Error(`对象转换失败：${error.message}`)
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loading(label = 'Thinking...') {
  let animationInterval
  const spinners = ['|', '/', '-', '\\']
  let spinnerIndex = 0
  process.stdout.write('\r')
  animationInterval = setInterval(() => {
    writeLine(spinners[spinnerIndex], label)
    spinnerIndex = (spinnerIndex + 1) % spinners.length
  }, 200)
  return (endLabel, isError = false) => {
    clearInterval(animationInterval)
    if (endLabel) {
      writeLine(endLabel, '', isError ? 'red' : 'green')
    }
    process.stdout.write('\r\n')
  }
}

function log(msg, color) {
  if (!color) {
    console.log(msg)
  } else {
    console.log(chalk.hex(color)(msg))
  }
}

module.exports = {
  logInfo,
  logSuccess,
  logError,
  loading,
  writeLine,
  streamOutput,
  streamLineBreak,
  objStrToObj,
  delay,
}
