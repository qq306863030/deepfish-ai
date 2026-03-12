const { toolDescriptions, toolFunctions } = require('./DefaultExtension')
const path = require('path')
const fs = require('fs-extra')
const axios = require('axios')
const dayjs = require('dayjs')
const { logError } = require('../utils')

class ExtensionManager {
  constructor(aiCli) {
    this.aiCli = aiCli
    this.extensions = {
      toolDescriptions,
      toolFunctions,
    }
    this.parseExtends(this.aiCli.config.extensions || [])
  }

  parseExtends(configExtends) {
    for (const extensionPath of configExtends) {
      try {
        // 解析扩展路径
        const resolvedPath = path.isAbsolute(extensionPath)
          ? extensionPath
          : path.resolve(process.cwd(), extensionPath)

        if (!fs.existsSync(resolvedPath)) {
          logError(`Extension file not found: ${resolvedPath}`)
          continue
        }

        // 动态加载扩展模块
        let { toolDescriptions, toolFunctions } = require(resolvedPath)
        toolDescriptions = toolDescriptions.map(item => {
          if (!item.type) {
            return {
              type: 'function',
              function: item
            }
          } else {
            return item
          }
        })
        this.extensions.toolDescriptions =
          this.extensions.toolDescriptions.concat(toolDescriptions)
        this.extensions.toolFunctions = Object.assign(
          this.extensions.toolFunctions,
          toolFunctions,
        )
      } catch (error) {
        logError(
          `Error loading extension ${extensionPath}: ${error.message}`,
        )
      }
    }
    const toolFunctions = this.extensions.toolFunctions
    for (const fnName of Object.keys(toolFunctions)) {
      toolFunctions[fnName] = toolFunctions[fnName].bind(this.aiCli)
      if (fnName === 'test') {
        toolFunctions[fnName]()
      }
    }
    toolFunctions['fs']  = fs
    toolFunctions['axios']  = axios
    toolFunctions['dayjs']  = dayjs
  }
}

module.exports = ExtensionManager
