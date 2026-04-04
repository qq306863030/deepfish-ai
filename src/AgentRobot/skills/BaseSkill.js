const descriptions = [] // openai能识别的描述
const functions = {} // key为函数名称，value为方法体

const BaseSkill = {
  name: 'BaseSkill',
  extensionDescription: '基础扩展模板，提供扩展的基本结构定义',
  filePath: __dirname, // 扩展文件路径，默认为当前文件所在目录
  platform: 'all', // 扩展支持的平台(process.platform)，all或空表示所有平台, win32表示仅支持Windows, darwin表示仅支持MacOS, linux表示仅支持Linux
  descriptions,
  functions,
}

export default BaseSkill