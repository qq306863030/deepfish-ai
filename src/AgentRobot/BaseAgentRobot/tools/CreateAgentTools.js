const { AttachmentToolType } = require("../utils/AttachmentToolScanner.js")

// 创建子 agent 并让其仅携带指定 skill 执行任务
async function createSubSkillAgent(skillName, skillType, workGoal) {
  try {
    const clawSkillCollection = this.agentRobot?.clawSkillCollection || []
    const toolCollection = this.agentRobot?.toolCollection || []
    let tool = null
    if (skillType === AttachmentToolType.CLAW_SKILL) {
      tool = clawSkillCollection.find((t) => t?.name === skillName)
    } else if (skillType === AttachmentToolType.BASE_SKILL) {
      tool = toolCollection.find((t) => t?.name === skillName)
    }
    if (!tool) {
      return {
        success: false,
        error: `Skill not found: ${skillName}`,
      }
    }

    if (!workGoal || typeof workGoal !== 'string') {
      return {
        success: false,
        error: 'workGoal must be a non-empty string',
      }
    }

    const agentId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const agent = this.agentRobot.createSubSkillAgent(agentId, [tool])
    const result = await agent.executeTask(workGoal)
    agent.destroy()

    return {
      success: true,
      agentId,
      skillName,
      result,
    }
  } catch (error) {
    console.error('Error in createSubSkillAgent:', error)
    return {
      success: false,
      error: error?.message || String(error),
    }
  }
}

// 创建携带所有技能说明的子agent
async function createSubAgent(workGoal) {
  try {
    const agentId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const agent = this.agentRobot.createSubAgent(agentId)
    const result = await agent.executeTask(workGoal)
    agent.destroy()
    return {
      success: true,
      agentId,
      result,
    }
  } catch (error) {
    return {
      success: false,
      error: error?.message || String(error),
    }
  }
}

function loadAttachTool(toolName) {
  try {
    this.agentRobot.loadAttachTool(toolName)
    return `Tool ${toolName} loaded successfully`
  } catch (error) {
    return `Failed to load tool ${toolName}: ${error.message}`
  }
}

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'createSubSkillAgent',
      description:
        '根据技能名称创建一个加载了该技能包的子agent，并让其执行给定工作目标。返回执行结果与状态信息。',
      parameters: {
        type: 'object',
        properties: {
          skillName: {
            type: 'string',
            description:
              '要加载到子agent中的技能名称（与技能对象name字段一致）。',
          },
          skillType: {
            type: 'string',
            description: '要加载到子agent中的技能类型（与技能对象type字段一致）, 枚举类型"BaseSkill"、"ClawSkill"。',
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
  {
    type: 'function',
    function: {
      name: 'createSubAgent',
      description:
        '创建一个子agent，并让其执行给定工作目标。可以进行复杂的任务分配，如知识库查询、多源搜索结果整合、多步骤任务处理等，返回执行结果与状态信息。',
      parameters: {
        type: 'object',
        properties: {
          workGoal: {
            type: 'string',
            description: '子agent要完成的任务目标描述。',
          },
        },
        required: ['workGoal'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'loadAttachTool',
      description:
        '按名称加载一个附加工具（Attach Tool）到当前agent实例中，返回加载结果信息。',
      parameters: {
        type: 'object',
        properties: {
          toolName: {
            type: 'string',
            description: '要加载的附加工具名称（与可用工具名称一致）。',
          },
        },
        required: ['toolName'],
      },
    },
  },
]

const functions = {
  createSubSkillAgent,
  createSubAgent,
  loadAttachTool,
}

const CreateAgentTool = {
  name: 'CreateAgentTool',
  description: '提供子agent创建与任务分发能力，可按技能选择子agent执行目标任务',
  descriptions,
  functions,
}

module.exports = CreateAgentTool
