const { AttachmentToolType, AttachmentToolScanner } = require('../BaseAgentRobot/utils/AttachmentToolScanner.js')
const MainAgentRobot = require('./MainAgentRobot.js')
const SubAgentRobot = require('./SubAgentRobot.js')
const SubSkillAgentRobot = require('./SubSkillAgentRobot.js')

class AgentRobotFactory {
  createMainAgent(opt) {
    return new MainAgentRobot(opt)
  }
  // 创建子技能Agent
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
      ...parent.opt,
      id,
      name: `SubSkillAgent-${attachTools[0].name}`,
      parent: parent,
      root: parent.root || parent,
      attachTools: baseSkill,
      clawSkills: clawSkill
    })
    parent.children.push(subAgent)
    return subAgent
  }

  // 创建子Agent
  createSubAgent(parent, id) {
    const subAgent = new SubAgentRobot({
      ...parent.opt,
      id,
      name: `SubAgent-${id}`,
      parent: parent,
      root: parent.root || parent,
    })
    parent.children.push(subAgent)
    return subAgent
  }
}

module.exports = AgentRobotFactory
