import readline from 'readline'
import { logError } from './utils/log.js'
import MainAgentRobot from '../AgentRobot/MainAgentRobot.js'

class AICLI {
  constructor(config) {
    // 启动一个机器人
    this.agentRobot = new MainAgentRobot(config)
  }

  // 单轮对话
  async run(userPrompt) {
    try {
      await this.agentRobot.executeTask(userPrompt)
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
