const { logInfo } = require("../../utils");
const {
  agentWorkflow,
  goalAnalysisPrompt,
  workFlowPrompt,
} = require("./AiTools");

class AiWorkFlow {
  constructor(aiCli, client) {
    this.aiCli = aiCli;
    this.client = client;
    this.recorder = this.aiCli.recorder;
    this.messages = [];
  }

  async main(goal) {
    const isRecover = await this.recorder.recover();
    if (isRecover) {
      const { goal, messages } = isRecover;
      // 判断是否已经完成
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'assistant' && !lastMessage.tool_calls) {
          // 说明已经执行完毕，直接返回
          this.messages = messages
          logInfo(lastMessage.content)
          return
      }
      // 判断是否是分析目标阶段
      this.messages = this.getMessages("workFlow", goal, messages);
      await agentWorkflow(this.aiCli, this.client, goal, this.messages, true);
    } else {
      if (!this.messages.length) {
        this.messages = this.getMessages("workFlow", goal, null);
        await agentWorkflow(
          this.aiCli,
          this.client,
          goal,
          this.messages,
          false
        );
      } else {
        this.messages.push({
          role: "user",
          content: goal,
        })
        const mainGoal = this.messages[1].content
        await agentWorkflow(this.aiCli, this.client, mainGoal, this.messages, false);
      }
    }
    // this.recorder.clear()
  }

  getMessages(type, goal, messages) {
    if (messages && messages.length) {
      return messages;
    } else {
      if (type === "goalAnalysis") {
        return [
          {
            role: "system",
            content: goalAnalysisPrompt,
          },
          {
            role: "user",
            content: goal,
          },
        ];
      } else if (type === "workFlow") {
        return [
          {
            role: "system",
            content: workFlowPrompt,
          },
          {
            role: "user",
            content: goal,
          },
        ];
      }
    }
  }

}

module.exports = AiWorkFlow;
