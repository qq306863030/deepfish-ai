const descriptions = [] // openai能识别的描述
const functions = {} // key为函数名称，value为方法体

module.exports = {
  name: 'BaseExtension',
  extensionDescription: "基础扩展模板，提供扩展的基本结构定义",
  descriptions,
  functions,
}