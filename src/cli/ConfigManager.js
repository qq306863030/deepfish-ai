import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { exec } from 'child_process'
import lodash from 'lodash'
import { defaultConfig } from './DefaultConfig.js'
import { GlobalVariable } from './GlobalVariable.js'
import { importModule, openDirectory } from '../AgentRobot/BaseAgentRobot/utils/normal.js'
import aiConsole from '../AgentRobot/BaseAgentRobot/utils/aiConsole.js'

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
      this.writeConfig()
    }
    this.config = this.getConfig()
    this.writeConfig(this.config)
  }

  dir() {
    openDirectory(this.configDir)
  }

  edit() {
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
        aiConsole.logError('Error opening configuration file:', error.message)
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
    this.writeConfig(this.config)
    aiConsole.logSuccess(`AI configuration "${aiConfig.name}" added successfully!`)
    return aiConfig
  }

  // 删除一个aiConfig
  delAiConfig(aiName) {
    const existingIndex = this.config.ai.findIndex(
      (item) => item.name === aiName,
    )
    if (existingIndex === -1) {
      aiConsole.logError(`Configuration with name "${aiName}" not found.`)
      return
    }
    const currentAi = this.config.currentAi
    // Check if it's the current configuration
    if (currentAi === aiName) {
      aiConsole.logError(`Cannot delete current configuration "${aiName}".`)
      return
    }
    // Remove the configuration
    this.config.ai.splice(existingIndex, 1)
    this.writeConfig(this.config)
    aiConsole.logSuccess(`AI configuration "${aiName}" deleted successfully!`)
  }

  // 设置当前Ai
  setCurrentAi(aiName) {
    // 查看列表中是否存在
    const existingIndex = this.config.ai.findIndex(
      (item) => item.name === aiName,
    )
    if (existingIndex === -1) {
      aiConsole.logError(`Configuration with name "${aiName}" not found.`)
      return
    }
    this.config.currentAi = aiName
    this.writeConfig(this.config)
    aiConsole.logSuccess(`Current AI configuration set to "${aiName}" successfully!`)
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
        aiConsole.logError('No AI configurations found.')
      } else {
        this.config.ai.forEach((config, index) => {
          const isCurrent = this.config.currentAi === config.name
          aiConsole.logInfo(`${config.name} ${isCurrent ? '(current)' : ''}`)
        })
      }
    } else {
      aiConsole.logError('No AI configurations found.')
    }
    console.log('='.repeat(50))
  }

  // 重置config
  resetConfig() {
    console.log('Resetting configuration file:', this.configPath)
    this.writeConfig()
    this.config = this.getConfig()
    aiConsole.logSuccess('Configuration file has been reset to default settings.')
  }

  // 查看ai详情
  viewAiConfigDetail(aiName) {
    if (this.isAiListEmpty()) {
      aiConsole.logError(
        'No AI configurations found. Please add an AI configuration first.',
      )
      return
    }
    if (!aiName) {
      aiName = this.config.currentAi
      if (!aiName) {
        aiConsole.logError(
          'No current AI configuration set. Please input "ai config use <name>" to set a current configuration.',
        )
        return
      }
    }
    const aiConfig = this._getAiConfig(aiName)
    if (!aiConfig) {
      aiConsole.logError(
        'AI configuration not found. Please check the name and try again.',
      )
      return
    }
    aiConsole.logSuccess('AI Configuration Details')
    aiConsole.logSuccess('='.repeat(50))
    aiConsole.logInfo(`Name: ${aiConfig.name}`)
    aiConsole.logInfo(`Type: ${aiConfig.type}`)
    aiConsole.logInfo(`API Base URL: ${aiConfig.baseUrl}`)
    aiConsole.logInfo(`Model: ${aiConfig.model}`)
    if (aiConfig.apiKey) {
      aiConsole.logInfo(`API Key: ${aiConfig.apiKey}`)
    }
    aiConsole.logInfo(`Temperature: ${aiConfig.temperature}`)
    aiConsole.logInfo(`Max Tokens: ${aiConfig.maxTokens}`)
    aiConsole.logInfo(`Streaming Output: ${aiConfig.stream ? 'Enabled' : 'Disabled'}`)
    aiConsole.logInfo(
      `Is Current: ${this.config.currentAi === aiConfig.name ? 'Yes' : 'No'}`,
    )
    aiConsole.logInfo(`File Path: ${this.configPath}`)
    aiConsole.logSuccess('='.repeat(50))
  }

  // 更新扩展
  updateExtensions(extensions) {
    this.config.extensions = extensions
    this.writeConfig(this.config)
    aiConsole.logSuccess('Extensions updated successfully!')
  }

  // 删除扩展
  removeExtensionByIndex(extIndex) {
    const filePath = this.config.extensions.splice(extIndex, 1)
    this.writeConfig(this.config)
    aiConsole.logSuccess(
      `Extension removed from config: ${filePath}.You can run 'ai ext ls' to view the changes.`,
    )
  }

  removeExtensionByPath(filePath) {
    this.config.extensions = this.config.extensions.filter(
      (ext) => ext !== filePath,
    )
    this.writeConfig(this.config)
    aiConsole.logSuccess(
      `Extension removed from config: ${filePath}.You can run 'ai ext ls' to view the changes.`,
    )
  }

  getConfig() {
    const config = importModule(this.configPath)
    return lodash.merge(lodash.cloneDeep(defaultConfig), config)
  }

  getAppConfig() {
    const config = importModule(this.configPath)
    const mergedConfig = lodash.merge(lodash.cloneDeep(defaultConfig), config)
    if (mergedConfig.currentAi) {
      const aiConfig = mergedConfig.ai.find(
        (item) => item.name === mergedConfig.currentAi,
      )
      mergedConfig.aiConfig = aiConfig
    }
    return mergedConfig
  }

  // 写入配置
  writeConfig(config) {
    if (!config) {
      config = lodash.cloneDeep(defaultConfig)
    }
    fs.writeFileSync(
      this.configPath,
      `export default ${JSON.stringify(config, null, 2)}`,
    )
    this.config = config
  }
}

export default ConfigManager
