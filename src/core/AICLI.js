import readline from 'readline'
import ExtensionManager from './extension/ExtensionManager.js'
import { logError } from './utils/log.js'
import { GlobalVariable } from './GlobalVariable.js'
import AIService from './ai-services/index.js'
import ConfigManager from '../cli/ConfigManager.js'
import SkillConfigManager from '../cli/SkillConfigManager.js'
import HistoryManager from '../cli/HistoryManager.js'

class AICLI {
  constructor(config) {
    if (!GlobalVariable.configManager) {
      GlobalVariable.configManager = new ConfigManager()
    }
    if (!GlobalVariable.skillConfigManager) {
      GlobalVariable.skillConfigManager = new SkillConfigManager()
    }
    if (!GlobalVariable.historyManager) {
      GlobalVariable.historyManager = new HistoryManager()
    }
    this.config = config || GlobalVariable.configManager.getConfig()
    this.aiConfig = GlobalVariable.configManager.getCurrentAiConfig()
    this.skillConfigManager = GlobalVariable.skillConfigManager
    this.historyManager = GlobalVariable.historyManager
    // 初始化扩展
    this.extensionManager = new ExtensionManager(this)
    this.Tools = this.extensionManager.extensions.functions
    
    this.aiService = new AIService(this.aiConfig.type, this)
    GlobalVariable.aiCli = this
  }
  
  // 单轮对话
  async run(userPrompt) {
    try {
      await this.aiService.mainWorkflow(userPrompt)
    } catch (error) {
      logError(error.stack)
      throw error
    }
  }
  // 多轮对话
  startInteractive() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    })

    console.log('AI CLI Assistant')
    console.log('Type your question or command. Type "exit" to quit.')
    console.log('='.repeat(50))
    rl.prompt()

    rl.on('line', async (line) => {
      const input = line.trim()

      if (input.toLowerCase() === 'exit') {
        rl.close()
        return
      }

      try {
        await this.run(input)
      } catch (error) {
        console.error('Error:', error.message)
      }

      console.log('='.repeat(50))
      rl.prompt()
    })

    rl.on('close', () => {
      console.log('Goodbye!')
      process.exit(0)
    })
  }

  _parseResponse(response) {
    if (!response) {
      throw new Error('AI returned empty data')
    }
    response = response.trim().replace(/^```json\n|```$/g, '')
    try {
      const steps = JSON.parse(response)
      if (Array.isArray(steps)) {
        return steps
      } else {
        return [{ type: 1, content: response, description: '' }]
      }
    } catch (error) {
      logError('返回数据解析错误,' + error.stack)
      return [{ type: 1, content: response, description: '' }]
    }
  }
}

export default AICLI
