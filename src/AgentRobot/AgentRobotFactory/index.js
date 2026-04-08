import AttachmentToolScanner, { AttachmentToolType } from '../BaseAgentRobot/utils/AttachmentToolScanner.js'
import MainAgentRobot from './MainAgentRobot.js'
import SubAgentRobot from './SubAgentRobot.js'
import SubSkillAgentRobot from './SubSkillAgentRobot.js'

export default class AgentRobotFactory {
  createMainAgent(opt) {
    return new MainAgentRobot(opt)
  }
  // 创建子技能机器人
  createSubSkillAgent(parent, id, attachTools = []) {
    const baseSkill = []
    const clawSkill = []
    for (const tool of attachTools) {
      if (tool.type === AttachmentToolType.BASE_SKILL) {
        baseSkill.push(tool)
      } else if (tool.type === AttachmentToolType.CLAW_SKILL) {
        clawSkill.push(tool)
      }
    }
    const subAgent = new SubSkillAgentRobot({
      ...parent.originOpt,
      id,
      name: `SubSkillAgent-${attachTools[0].name}`,
      parent: parent,
      root: parent.root || parent,
      attachTools: baseSkill,
    })
    if (clawSkill.length > 0) {
      parent.systemPrompt =
        parent.systemPrompt +
        '\n' +
        AttachmentToolScanner.getClawSkillPrompt(clawSkill)
    }
    parent.children.push(subAgent)
    return subAgent
  }

  // 创建子机器人
  createSubAgent(parent, id) {
    const subAgent = new SubAgentRobot({
      ...parent.originOpt,
      id,
      name: `SubAgent-${id}`,
      parent: parent,
      root: parent.root || parent,
    })
    parent.children.push(subAgent)
    return subAgent
  }
}
