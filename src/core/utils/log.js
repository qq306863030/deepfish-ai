const chalk = require('chalk')
const { default: inquirer } = require('inquirer')


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

function logWarning(message) {
  log(message, '#f2c94c')
}

function logDisabled(message) {
  log(message, '#999999')
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

// 判断问答
async function askConfirm(name, message, defaultVal = true, opt = {}) {
  const questions = [
    {
      type: 'confirm',
      name,
      message,
      default: defaultVal,
      ...opt
    }
  ]
  const answers = await inquirer.prompt(questions)
  return answers[name]
}

// 选择问答
function askList(name, message, choices, defaultVal = 0, opt = {}) {
  const questions = [
    {
      type: 'list',
      name,
      message,
      choices,
      default: defaultVal,
      ...opt
    }
  ]
  return inquirer.prompt(questions)
}

// 输入问答
async function askInput(name, message, defaultVal = '', opt = {}) {
  const questions = [
    {
      type: 'input',
      name,
      message,
      default: defaultVal,
      ...opt
    },
  ]
  const answers = await inquirer.prompt(questions)
  return answers[name]
}

// 输入数字
async function askNumber(name, message, defaultVal = 0, opt = {}) {
  const questions = [
    {
      type: 'number',
      name,
      message,
      default: defaultVal,
      ...opt
    },
  ]
  const answers = await inquirer.prompt(questions)
  return answers[name]
}

// 输入任何
function askAny(questions) {
  return inquirer.prompt(questions)
}


module.exports = {
  logInfo,
  logSuccess,
  logError,
  logWarning,
  logDisabled,
  loading,
  writeLine,
  streamOutput,
  streamLineBreak,
  askAny,
  askConfirm,
  askList,
  askInput,
  askNumber
}
