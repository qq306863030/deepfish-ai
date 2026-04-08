import MainAgentRobot from './AgentRobot/AgentRobotFactory/MainAgentRobot.js'
import SubAgentRobot from './AgentRobot/AgentRobotFactory/SubAgentRobot.js'
import SubSkillAgentRobot from './AgentRobot/AgentRobotFactory/SubSkillAgentRobot.js'
import readline from 'readline'

class DeepFishAI {
  constructor(config) {
    // 启动一个机器人
    this.agentRobot = new MainAgentRobot(config)
  }

  // 单轮对话
  async run(userPrompt) {
    await this.agentRobot.executeTask(userPrompt)
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
}

export { DeepFishAI, MainAgentRobot, SubAgentRobot, SubSkillAgentRobot }