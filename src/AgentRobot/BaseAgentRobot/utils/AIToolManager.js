const path = require('path')
const os = require('os')
const fs = require('fs-extra')
const dayjs = require('dayjs')
const axios = require('axios')
const echarts = require('echarts')
const canvas = require('canvas')
const cheerio = require('cheerio')
const puppeteer = require('puppeteer')
const lodash = require('lodash')
const { AttachmentToolScanner } = require('./AttachmentToolScanner')

class AIToolManager {
  originalTools = null // 原装工具
  attachTools = null // 附加工具, Agent后续安装的工具函数
  functions = {} // key为函数名称，value为方法体
  descriptions = [] // openai能识别的描述
  tools = [] // 工具列表
  toolCollection = null // 工具集合
  clawSkillCollection = null // Claw技能集合
  constructor(agentRobot) {
    this.agentRobot = agentRobot
    this.initTools(agentRobot.opt)
  }
  initTools(opt) {
    this.originalTools = this._getOriginalTools() // 天赋技能
    this.attachTools = opt.attachTools || [] // 附加工具, Agent后续安装的工具函数
    const tools = [...this.originalTools, ...this.attachTools]
    tools.forEach((tool) => {
      this._addTool(tool)
    })
    Object.assign(this.functions, {
      fs,
      axios,
      dayjs,
      lodash,
      canvas,
      echarts,
      cheerio,
      puppeteer,
    })

    this.functions.agentRobot = this.agentRobot
    this.functions.Tools = this.functions
    // 兼容老版本
    this.functions.aiCli = {
      Tools: this.functions,
    }
    // 外部工具扫描
    this.toolCollection = AttachmentToolScanner.getToolCollection(
      this.agentRobot.workspace,
    ) // 加载工具集合
    this.clawSkillCollection = AttachmentToolScanner.getClawSkillCollection(
      this.agentRobot.basespace,
    ) // 加载Claw技能集合
  }

  // 动态添加工具
  addTool(toolName) {
    let tool = this.tools.find((t) => t.name === toolName)
    if (!tool) {
      tool = this.toolCollection.find((t) => t.name === toolName)
      if (tool) {
        this._addTool(tool)
      }
    }
  }

  _addTool(tool) {
    const platform = tool.platform || 'all'
    if (platform === 'all' || platform === process.platform) {
      tool.descriptions = tool.descriptions.map((item) => {
        if (!item.type) {
          item = {
            type: 'function',
            function: item,
          }
        }
        return item
      })
      if (tool.name && !tool.isSystem) {
        for (const funcName in tool.functions) {
          if (!funcName.includes('_')) {
            this.functions[`${tool.name}_${funcName}`] =
              tool.functions[funcName]
          } else {
            this.functions[funcName] = tool.functions[funcName]
          }
        }
        const descriptions = tool.descriptions.map((item) => {
          if (
            tool.name &&
            item.function.name &&
            !item.function.name.includes('_')
          ) {
            item.function.name = `${tool.name}_${item.function.name}`
            return item
          } else {
            return item
          }
        })
        this.descriptions.push(...descriptions)
      } else {
        Object.assign(this.functions, tool.functions)
        this.descriptions.push(...tool.descriptions)
      }
      this.tools.push(tool)
    }
  }

  // 获取原装工具
  _getOriginalTools() {
    // 自动扫描tools目录
    const toolsPath = path.join(__dirname, '../tools')
    const toolFiles = fs.readdirSync(toolsPath).filter((file) => {
      return file.endsWith('.js') || file.endsWith('.cjs')
    })
    const tools = []
    toolFiles.forEach((file) => {
      const tool = require(path.join(toolsPath, file))
      tools.push(tool)
    })
    return tools
  }
}

module.exports = AIToolManager
