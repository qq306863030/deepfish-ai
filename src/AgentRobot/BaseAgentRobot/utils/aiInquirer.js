const inquirer = require('inquirer')

// 判断问答
async function askConfirm(message, defaultVal = true, opt = {}) {
  const questions = [
    {
      type: 'confirm',
      name: 'confirm',
      message,
      default: defaultVal,
      ...opt
    }
  ]
  const answers = await inquirer.prompt(questions)
  return answers['confirm']
}

// 选择问答
async function askList(message, choices, defaultVal = 0, opt = {}) {
  const questions = [
    {
      type: 'list',
      name: 'list',
      message,
      choices,
      default: defaultVal,
      ...opt
    }
  ]
  const answers = await inquirer.prompt(questions)
  return answers['list']
}

// 输入问答
async function askInput(message, defaultVal = '', opt = {}) {
  const questions = [
    {
      type: 'input',
      name: 'input',
      message,
      default: defaultVal,
      ...opt
    },
  ]
  const answers = await inquirer.prompt(questions)
  return answers['input']
}

// 输入数字
async function askNumber(message, defaultVal = 0, opt = {}) {
  const questions = [
    {
      type: 'number',
      name: 'number',
      message,
      default: defaultVal,
      ...opt
    },
  ]
  const answers = await inquirer.prompt(questions)
  return answers['number']
}

// 输入任何
function askAny(questions) {
  return inquirer.prompt(questions)
}

const aiInquirer = {
  askAny,
  askConfirm,
  askList,
  askInput,
  askNumber,
}


module.exports = aiInquirer
