const descriptions = [] // openai能识别的描述
const functions = {} // key为函数名称，value为方法体

const BaseTool = {
  name: 'BaseTool',
  description: '基础扩展模板，提供扩展的基本结构定义',
  platform: 'all', // 扩展支持的平台(process.platform)，all或空表示所有平台, win32表示仅支持Windows, darwin表示仅支持MacOS, linux表示仅支持Linux
  descriptions,
  functions,
  isSystem: true
}

module.exports = BaseTool