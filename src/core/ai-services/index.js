import { OpenAI } from 'openai'
import AiWorker from './AiWorker/index.js'

class AIService {
  constructor(type = 'deepseek', aiCli) {
    this.type = type
    this.aiCli = aiCli
    this.config = aiCli.config
    this.aiConfig = aiCli.aiConfig
    this.name = this.config.currentAi || 'I'
    this.config.name = this.name
    this.config.type = this.type
    this.aiConfig.type = this.type
    this.client = new OpenAI({
      baseURL: this.aiConfig.baseUrl,
      apiKey: this.aiConfig.apiKey || '',
    })
    this.aiWorker = new AiWorker(this.aiCli, this.client)
    this.aiWorker.aiService = this
  }

  mainWorkflow(goal) {
    return this.aiWorker.main(goal);
  }

  subSkillWorkflow(skillContent, goal) {
    return this.aiWorker.subSkillAgent(skillContent, goal);
  }

  subTestWorkflow(goal) {
    return this.aiWorker.subTestAgent(goal);
  }

  subTaskWorkflow(goal) {
    return this.aiWorker.subTaskAgent(goal);
  }
}

export default AIService
