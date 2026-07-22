import SubAIAgent from "@/agent/AIAgent/SubAgents/SubAIAgent";
import { getUserFilePath, getSessionPath, getSessionDirPath } from "@/cli/cli-utils/getGlobalPath";
import { getCurrentAIConfig } from "@/cli/cli-utils/init-agent";
import { getConfig } from "@/cli/cli-utils/init-config";
import { randomUUID } from "crypto";

export async function createSubAgent(workspace?:string) {
    const config = getConfig();
    if (!config) {
        return
    }
    const currentAI = getCurrentAIConfig(config);
      const userPath = getUserFilePath();
      const id = randomUUID();
      const agent = new SubAIAgent({
        id,
        modelOpt: {
          type: currentAI.type,
          apiKey: currentAI.apiKey,
          modelName: currentAI.model,
          baseUrl: currentAI.baseUrl,
          maxContextLength: currentAI.maxContextLength,
        },
        basespace: getSessionPath(id),
        workspace: workspace,
        memoryFilePath: userPath.memory,
        userStorePath: userPath.userStore,
        sessionDirPath: getSessionDirPath(id),
        agentRulesPath: userPath.agentRules,
        maxBlockFileSize: config.maxBlockFileSize,
        encoding: config.encoding,
        maxSubAgentCount: config.maxSubAgentCount,
        externalSkills: [],
        excludeTools: ['ask_question', 'learn_self', 'get_learned_detail', 'update_learned_content', 'get_catalog_file_path'], // 服务端执行，不能进行交互
        isPrintThinking: true,
        isUseMemory: config.isUseMemory,
        isVision: currentAI.isVision,
        isSilence: true
      });
      await agent.init();
      return agent;
}