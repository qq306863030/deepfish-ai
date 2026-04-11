const aiInquirer = require("../utils/aiInquirer.js")

// 判断问答
async function inquirerConfirm(message, defaultVal = true, opt = {}) {
  return aiInquirer.askConfirm(message, defaultVal = true, opt = {})
}

// 选择问答
function inquirerList(message, choices, defaultVal = 0, opt = {}) {
  return aiInquirer.askList(message, choices, defaultVal = 0, opt = {})
}

// 输入问答
async function inquirerInput(message, defaultVal = '', opt = {}) {
  return aiInquirer.askInput(message, defaultVal = '', opt = {})
}

// 输入数字
async function inquirerNumber(message, defaultVal = 0, opt = {}) {
  return aiInquirer.askNumber(message, defaultVal = 0, opt = {})
}

// 输入任何
function inquirerAny(questions) {
  return aiInquirer.askAny(questions)
}

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'inquirerConfirm',
      description:
        '用户交互：提示用户确认问题，用户输入Y/N后返回布尔值（true/false）。message-显示给用户的问题文本；defaultVal-默认布尔值（默认true）；opt-inquirer额外配置选项对象（可选）。',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description:
              "显示给用户的确认问题文本，例如 '是否确认删除？'、'你同意继续吗？'",
          },
          defaultVal: {
            type: 'boolean',
            description:
              '用户直接按回车时的默认值，true表示默认确认，false表示默认拒绝，默认为true',
          },
          opt: {
            type: 'object',
            description:
              'inquirer额外配置选项对象，可选。支持的字段包括：when（条件函数）、prefix（问题前缀符号）、suffix（问题后缀符号）等',
          },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inquirerList',
      description:
        '用户交互：提示用户从列表中选择一项，返回用户选中的值。message-显示给用户的提示文本；choices-选项数组（字符串或{name,value,short}对象）；defaultVal-默认选中索引（默认0）；opt-inquirer额外配置选项对象（可选）。',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description:
              "显示给用户的选择提示文本，例如 '请选择编程语言：'、'请选择主题风格：'",
          },
          choices: {
            type: 'array',
            description:
              "选项数组，每项可以是字符串（同时作为显示文本和值），也可以是对象 {name: '显示文本', value: '实际值', short: '选中后的简短显示'}。还支持 new inquirer.Separator() 作为分隔线",
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: '选项的显示文本' },
                value: {
                  type: 'string',
                  description: '选项被选中后的实际返回值',
                },
                short: {
                  type: 'string',
                  description: '选中后在提示行中显示的简短文本，可选',
                },
              },
            },
          },
          defaultVal: {
            type: 'number',
            description:
              '默认选中项的索引（从0开始），默认为0即选中第一项。例如传入2表示默认高亮第三个选项',
          },
          opt: {
            type: 'object',
            description:
              'inquirer额外配置选项对象，可选。支持的字段包括：loop（布尔值，是否循环滚动列表，默认true）、pageSize（数字，一次显示的选项数量，超出则滚动）、when（条件函数）、filter（结果过滤函数）等',
          },
        },
        required: ['message', 'choices'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inquirerInput',
      description:
        '用户交互：提示用户输入一段文本，返回用户输入的字符串。message-显示给用户的提示文本；defaultVal-默认输入值（默认空字符串）；opt-inquirer额外配置选项对象（支持validate、filter等，可选）。',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description:
              "显示给用户的输入提示文本，例如 '请输入用户名：'、'请输入文件路径：'",
          },
          defaultVal: {
            type: 'string',
            description:
              "用户直接按回车时的默认输入值，默认为空字符串。例如传入 './output' 表示默认路径",
          },
          opt: {
            type: 'object',
            description:
              'inquirer额外配置选项对象，可选。支持的字段包括：validate（校验函数，接收输入值返回true或错误提示字符串）、filter（过滤函数）、transformer（显示转换函数）、when（条件函数）等',
          },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inquirerNumber',
      description:
        '用户交互：提示用户输入一个数字，返回Number类型值（非数字输入返回NaN）。message-显示给用户的提示文本；defaultVal-默认数字值（默认0）；opt-inquirer额外配置选项对象（支持validate、filter等，可选）。',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description:
              "显示给用户的数字输入提示文本，例如 '请输入端口号：'、'请输入重试次数：'",
          },
          defaultVal: {
            type: 'number',
            description:
              '用户直接按回车时的默认数字值，默认为0。例如传入8080表示默认端口号',
          },
          opt: {
            type: 'object',
            description:
              'inquirer额外配置选项对象，可选。支持的字段包括：validate（校验函数，可用于限制数值范围）、filter（过滤函数）、when（条件函数）等',
          },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inquirerAny',
      description:
        '用户交互：直接调用inquirer.prompt()的通用封装，接受自定义问题对象数组，支持一次提出多个问题进行连续交互，返回包含所有答案的对象（{问题name: 对应答案}）。参数说明(不是对象参数)：questions-inquirer问题对象数组，每个对象包含type（问题类型：input/confirm/list/checkbox/password/editor/rawlist/expand）、name（标识名称）、message（提示文本）及可选的default、choices、validate、filter、when等字段。',
      parameters: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            description:
              "inquirer问题对象数组，每个问题对象包含以下字段：type（问题类型，如'input'/'confirm'/'list'/'checkbox'/'password'/'editor'/'rawlist'/'expand'）、name（问题标识名称）、message（提示文本）、default（默认值）、choices（选项数组，适用于list/checkbox/rawlist/expand类型）、validate（校验函数）、filter（过滤函数）、when（条件函数，控制是否显示该问题，接收前面的回答作为参数）、transformer（显示转换函数）等。多个问题会按数组顺序依次向用户提问",
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  description:
                    "问题类型：'input'（文本输入）、'confirm'（是否确认）、'list'（单选列表）、'checkbox'（多选列表）、'password'（密码输入，输入内容隐藏）、'editor'（打开编辑器输入大段文本）、'rawlist'（带编号的列表选择）、'expand'（按键选择展开列表）",
                },
                name: {
                  type: 'string',
                  description:
                    '问题的唯一标识名称，用于在返回的答案对象中作为key提取对应答案',
                },
                message: {
                  type: 'string',
                  description: '显示给用户的问题提示文本',
                },
                default: {
                  type: 'string',
                  description: '默认值，类型根据问题类型而定',
                },
                choices: {
                  type: 'array',
                  description:
                    '选项数组，适用于list/checkbox/rawlist/expand类型',
                },
                validate: {
                  type: 'string',
                  description:
                    '校验函数，接收用户输入返回true表示通过或返回错误字符串',
                },
              },
              required: ['type', 'name', 'message'],
            },
          },
        },
        required: ['questions'],
      },
    },
  },
]

const functions = {
  inquirerConfirm,
  inquirerList,
  inquirerInput,
  inquirerNumber,
  inquirerAny,
}

const InquirerTool = {
  name: 'InquirerTool',
  description:
    '提供用户交互功能，支持确认、列表选择、文本输入、数字输入等多种交互方式',
  descriptions,
  functions,
}

module.exports = InquirerTool
