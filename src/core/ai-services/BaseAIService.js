const { OpenAI } = require("openai");
const { loading } = require("../utils");
const AiWorkFlow = require("./AiWorkFlow");

class BaseAIService {
  constructor(aiCli) {
    this.aiCli = aiCli;
    this.config = aiCli.config;
    this.aiConfig = aiCli.aiConfig;
    this.name = this.config.currentAi || "I";
    this.client = new OpenAI({
      baseURL: this.aiConfig.baseUrl,
      apiKey: this.aiConfig.apiKey || "",
    });
    this.aiWorkFlow = new AiWorkFlow(this.aiCli, this.client)
    this.aiWorkFlow.aiService = this
  }

  mainWorkflow(goal) {
    return this.aiWorkFlow.main(goal)
  }

  async derictGenerateResponse(systemDescription, prompt) {
    const messages = [];
    messages.push({
      role: "system",
      content: systemDescription,
    });
    messages.push({
      role: "user",
      content: prompt,
    });
    let loadingStop = loading("Thinking...");
    try {
      const response = await this.client.chat.completions.create({
        model: this.aiConfig.model,
        messages: messages,
        temperature: this.aiConfig.temperature,
        max_tokens: this.aiConfig.maxTokens,
        stream: false,
      });
      loadingStop(`${this.name} have finished thinking.`);
      return response.choices[0].message.content;
    } catch (error) {
      loadingStop("AI process terminated unexpectedly." + error.message, true);
      throw error;
    }
  }
}

module.exports = BaseAIService;
