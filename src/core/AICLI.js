const OllamaService = require('./ai-services/OllamaService')
const DeepSeekService = require('./ai-services/DeepSeekService')
const OpenaiService = require('./ai-services/OpenaiService')
const ExtensionManager = require('./extension/ExtensionManager')
const readline = require('readline')
const { logError } = require('./utils')
const { GlobalVariable } = require('./globalVariable')
const AiWorkFlow = require('./ai-services/AiWorkFlow')
const Recorder = require('./ai-services/AiWorkFlow/AiRecorder')

class AICLI {
  constructor(config) {
    GlobalVariable.aiCli = this
    GlobalVariable.isRecordHistory = Boolean(config.isRecordHistory)
    GlobalVariable.isLog = Boolean(config.isLog)
    this.config = config
    this.aiService = null
    this.extensionManager = null
    this.aiWorkFlow = null
    this.recorder = null
    const currentName = this.config.currentAi || 'default'
    const currentAiConfig = this.config.ai.find(
      (cfg) => cfg.name === currentName,
    )
    this.aiConfig = currentAiConfig || this.config.ai[0]
    this.initialize()
  }
  // 解析配置文件
  initialize() {
    this.recorder = new Recorder(this);
    const service = this.aiConfig?.type || 'ollama'
    if (service === 'deepseek') {
      this.aiService = new DeepSeekService(this)
    } else if (service === 'openai') {
      this.aiService = new OpenaiService(this)
    } else {
      this.aiService = new OllamaService(this)
    }
    // 初始化扩展
    this.extensionManager = new ExtensionManager(this)
    this.Tools = this.extensionManager.extensions.toolFunctions
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

module.exports = AICLI
