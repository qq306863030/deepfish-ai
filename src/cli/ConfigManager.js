const path = require('path')
const os = require('os')
const fs = require('fs-extra')
const { defaultConfig } = require('./configTools')
const { logSuccess, logError, logInfo } = require('../core/utils/log')
const { GlobalVariable } = require('../core/globalVariable')

class ConfigManager {
  config = null
  configDir = path.join(os.homedir(), './.deepfish-ai')
  configPath = path.join(this.configDir, './config.js')
  constructor() {
    this.initConfig()
    GlobalVariable.configManager = this
  }
  // 初始化config
  initConfig() {
    fs.ensureDirSync(this.configDir)
    // 判断之前版本的配置文件是否存在，如果存在则迁移到新目录
    const isConfigExists = this.checkConfigExists()
    if (
      !isConfigExists &&
      fs.pathExistsSync(path.join(os.homedir(), '.ai-cmd.config.js'))
    ) {
      fs.moveSync(path.join(os.homedir(), '.ai-cmd.config.js'), this.configPath)
    } else if (!isConfigExists) {
      this._writeConfig()
    }
    this.config = this._getConfig()
  }

  edit() {
    const { exec } = require('child_process')
    const platform = process.platform

    let openCommand
    if (process.env.EDITOR) {
      openCommand = `${process.env.EDITOR} "${this.configPath}"`
    } else if (platform === 'darwin') {
      openCommand = `open -e "${this.configPath}"`
    } else if (platform === 'win32') {
      openCommand = `notepad "${this.configPath}"`
    } else {
      openCommand = `xdg-open "${this.configPath}"`
    }
    exec(openCommand, (error) => {
      if (error) {
        logError('Error opening configuration file:', error.message)
      }
    })
  }

  // 判断config是否存在
  checkConfigExists() {
    return fs.pathExistsSync(this.configPath)
  }

  // 重名验证
  checkName(aiName) {
    const existingIndex = this.config.ai.findIndex(
      (item) => item.name === aiName,
    )
    return existingIndex !== -1
  }

  isAiListEmpty() {
    return this.config.ai && this.config.ai.length === 0
  }

  // 添加一个aiConfig
  addAiConfig(aiConfig) {
    this.config.ai.push(aiConfig)
    this._writeConfig(this.config)
    logSuccess(`AI configuration "${aiConfig.name}" added successfully!`)
  }

  // 删除一个aiConfig
  delAiConfig(aiName) {
    const existingIndex = this.config.ai.findIndex(
      (item) => item.name === aiName,
    )
    if (existingIndex === -1) {
      logError(`Configuration with name "${aiName}" not found.`)
      return
    }
    const currentAi = this.config.currentAi
    // Check if it's the current configuration
    if (currentAi === aiName) {
      logError(`Cannot delete current configuration "${aiName}".`)
      return
    }
    // Remove the configuration
    this.config.ai.splice(existingIndex, 1)
    this._writeConfig(this.config)
    logSuccess(`AI configuration "${aiName}" deleted successfully!`)
  }

  // 设置当前Ai
  setCurrentAi(aiName) {
    // 查看列表中是否存在
    const existingIndex = this.config.ai.findIndex(
      (item) => item.name === aiName,
    )
    if (existingIndex === -1) {
      logError(`Configuration with name "${aiName}" not found.`)
      return
    }
    this.config.currentAi = aiName
    this._writeConfig(this.config)
    logSuccess(`Current AI configuration set to "${aiName}" successfully!`)
  }

  getCurrentAiConfig() {
    return this.config.ai.find((item) => item.name === this.config.currentAi)
  }

  getCurrentAi() {
    return this.config.currentAi
  }

  _getAiConfig(aiName) {
    return this.config.ai.find((item) => item.name === aiName)
  }

  // 获取Ai列表
  getAiList() {
    console.log('AI Configurations')
    console.log('='.repeat(50))
    if (this.config.ai && Array.isArray(this.config.ai)) {
      if (this.config.ai.length === 0) {
        logError('No AI configurations found.')
      } else {
        this.config.ai.forEach((config, index) => {
          const isCurrent = this.config.currentAi === config.name
          logInfo(`${config.name} ${isCurrent ? '(current)' : ''}`)
        })
      }
    } else {
      logError('No AI configurations found.')
    }
    console.log('='.repeat(50))
  }

  // 重置config
  resetConfig() {
    console.log('Resetting configuration file:', this.configPath)
    this._writeConfig()
    this.config = this._getConfig()
    logError('Configuration file has been reset to default settings.')
  }

  // 查看ai详情
  viewAiConfigDetail(aiName) {
    const aiConfig = this._getAiConfig(aiName)
    if (!aiConfig) {
      logError('No current AI configuration set.')
      return
    }
    console.log('AI Configuration Details')
    console.log('='.repeat(50))
    console.log(`Name: ${aiConfig.name}`)
    console.log(`Type: ${aiConfig.type}`)
    console.log(`API Base URL: ${aiConfig.baseUrl}`)
    console.log(`Model: ${aiConfig.model}`)
    if (aiConfig.apiKey) {
      console.log(`API Key: ${aiConfig.apiKey.substring(0, 8)}...`)
    }
    console.log(`Temperature: ${aiConfig.temperature}`)
    console.log(`Max Tokens: ${aiConfig.maxTokens}`)
    console.log(`Streaming Output: ${aiConfig.stream ? 'Enabled' : 'Disabled'}`)
    console.log(
      `Is Current: ${this.config.currentAi === aiConfig.name ? 'Yes' : 'No'}`,
    )
    console.log(`File Path: ${this.configPath}`)
    console.log('='.repeat(50))
  }

  // 更新扩展
  updateExtensions(extensions) {
    this.config.extensions = extensions
    this._writeConfig(this.config)
    logSuccess('Extensions updated successfully!')
  }

  // 删除扩展
  removeExtensionByIndex(extIndex) {
    const filePath = this.config.extensions.splice(extIndex, 1)
    this._writeConfig(this.config)
    logSuccess(
      `Extension removed from config: ${filePath}.You can run 'ai ext ls' to view the changes.`,
    )
  }

  removeExtensionByPath(filePath) {
    this.config.extensions = this.config.extensions.filter(
      (ext) => ext !== filePath,
    )
    this._writeConfig(this.config)
    logSuccess(
      `Extension removed from config: ${filePath}.You can run 'ai ext ls' to view the changes.`,
    )
  }

  _getConfig() {
    return require(this.configPath)
  }

  // 写入配置
  _writeConfig(config) {
    if (!config) {
      config = defaultConfig
    }
    fs.writeFileSync(
      this.configPath,
      `module.exports = ${JSON.stringify(config, null, 2)}`,
    )
  }
}

module.exports = ConfigManager
