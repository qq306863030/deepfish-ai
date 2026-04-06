import { getPath, sleep } from "../utils/normal.js"

const { fileDir, filePath } = getPath(import.meta.url)

// 创建子 agent 并让其仅携带指定 skill 执行任务
async function createSubAgent(skillName, workGoal) {
  try {
    const toolCollection = this.agentRobot?.toolCollection || []
    const tool = toolCollection.find((t) => t?.name === skillName)
    if (!tool) {
      return {
        success: false,
        error: `Skill not found: ${skillName}`,
        availableSkills: toolCollection.map((t) => t?.name).filter(Boolean),
      }
    }

    if (!workGoal || typeof workGoal !== 'string') {
      return {
        success: false,
        error: 'workGoal must be a non-empty string',
      }
    }

    const agentId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const agent = this.agentRobot.createSubAgent(agentId, [tool])
    const result = await agent.executeTask(workGoal)

    return {
      success: true,
      agentId,
      skillName,
      result,
    }
  } catch (error) {
    return {
      success: false,
      error: error?.message || String(error),
    }
  }
}

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'createSubAgent',
      description:
        '根据技能名称创建一个只携带该技能的子agent，并让其执行给定工作目标。返回执行结果与状态信息。',
      parameters: {
        type: 'object',
        properties: {
          skillName: {
            type: 'string',
            description: '要加载到子agent中的技能名称（与技能对象name字段一致）。',
          },
          workGoal: {
            type: 'string',
            description: '子agent要完成的任务目标描述。',
          },
        },
        required: ['skillName', 'workGoal'],
      },
    },
  },
]

const functions = {
  createSubAgent,
}

const CreateAgentTool = {
  name: 'CreateAgentTool',
  description: '提供子agent创建与任务分发能力，可按技能选择子agent执行目标任务',
  location: fileDir,
  filePath,
  descriptions,
  functions,
}

export default CreateAgentTool
