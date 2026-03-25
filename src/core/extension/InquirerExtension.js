const { default: inquirer } = require('inquirer')

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

const descriptions = [
  {
    type: "function",
    function: {
      name: "askConfirm",
      description: "用户交互：提示用户确认问题，返回布尔值。通过message参数显示问题文本，defaultVal参数设置默认值（默认为true），opt参数可传递inquirer的其他选项。",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "问题的标识名称" },
          message: { type: "string", description: "显示给用户的问题文本" },
          defaultVal: { type: "boolean", description: "默认值，默认为true" },
          opt: { type: "object", description: "inquirer的其他选项对象，可选" },
        },
        required: ["name", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "askList",
      description: "用户交互：提示用户从列表中选择一项，返回选择项对象。通过choices参数传递选项数组，defaultVal参数设置默认选择的索引（默认为0），opt参数可传递inquirer的其他选项。",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "问题的标识名称" },
          message: { type: "string", description: "显示给用户的问题文本" },
          choices: { type: "array", description: "选项数组" },
          defaultVal: { type: "number", description: "默认选择索引，默认为0" },
          opt: { type: "object", description: "inquirer的其他选项对象，可选" },
        },
        required: ["name", "message", "choices"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "askInput",
      description: "用户交互：提示用户输入文本，返回输入的字符串。通过message参数显示问题文本，defaultVal参数设置默认值（默认为空字符串），opt参数可传递inquirer的其他选项。",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "问题的标识名称" },
          message: { type: "string", description: "显示给用户的问题文本" },
          defaultVal: { type: "string", description: "默认值，默认为空字符串" },
          opt: { type: "object", description: "inquirer的其他选项对象，可选" },
        },
        required: ["name", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "askNumber",
      description: "用户交互：提示用户输入数字，返回输入的数字。通过message参数显示问题文本，defaultVal参数设置默认值（默认为0），opt参数可传递inquirer的其他选项。",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "问题的标识名称" },
          message: { type: "string", description: "显示给用户的问题文本" },
          defaultVal: { type: "number", description: "默认值，默认为0" },
          opt: { type: "object", description: "inquirer的其他选项对象，可选" },
        },
        required: ["name", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "askAny",
      description: "用户交互：提示用户根据自定义问题对象数组进行交互，返回答案对象。通过questions参数传递inquirer格式的问题数组，支持多种问题类型和复杂配置。",
      parameters: {
        type: "object",
        properties: {
          questions: { type: "array", description: "inquirer的问题对象数组" },
        },
        required: ["questions"],
      },
    },
  },
]

const functions = {
  askConfirm,
  askList,
  askInput,
  askNumber,
  askAny,
}

module.exports = {
  name: 'InquirerExtension',
  extensionDescription: "提供用户交互功能，支持确认、列表选择、文本输入、数字输入等多种交互方式",
  descriptions,
  functions,
}