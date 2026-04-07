import path from 'path'
import os from 'os'
import BaseAgentRobot from './BaseAgentRobot/index.js'
import Logger from './BaseAgentRobot/Logger.js'
import SubAgentRobot from './SubAgentRobot.js'
import AttachmentToolScanner, { AttachmentToolType } from './BaseAgentRobot/utils/AttachmentToolScanner.js'

export default class SubSkillAgentRobot extends BaseAgentRobot {
  // opt: { root, parent, ...MainAgentOpt }
  constructor(opt) {
    super(opt)
    this.type = 'sub-skill'
  }

  _initFiles(opt) {
    this.root = opt.root
    this.parent = opt.parent
    this.attachTools = opt.attachTools || []
    this.workspace = opt.workspace || process.cwd() // 工作空间，目录
    this.basespace = opt.basespace || path.join(os.homedir(), '.deepfish-ai') // 记忆空间，目录
    this.memerySpace = path.join(this.basespace, 'memery') // 记忆空间，目录
    this.agentRecordFilePath = path.join(this.memerySpace, 'agentRecord.json')
    this.agentSpace = path.join(this.memerySpace, this.root.id) // 机器人空间，目录
    this.agentTreeFilePath = path.join(this.agentSpace, 'agentTree.json')
    this.memoryFilePath = path.join(this.agentSpace, `memory-${this.id}.json`)
    this.logDirPath = path.join(this.agentSpace, 'logs')
    this.logger = new Logger(this) // 初始化日志系统
  }

  // 创建子技能机器人
  createSubSkillAgent(id, attachTools = []) {
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
      ...this.originOpt,
      id,
      name: `SubSkillAgent-${attachTools[0].name}`,
      parent: this,
      root: this.root || this,
      attachTools: baseSkill,
    })
    if (clawSkill.length > 0) {
      this.systemPrompt =
        this.systemPrompt +
        '\n' +
        AttachmentToolScanner.getClawSkillPrompt(clawSkill)
    }
    this.children.push(subAgent)
    return subAgent
  }

  // 创建子机器人
  createSubAgent(id) {
    const subAgent = new SubAgentRobot({
      ...this.originOpt,
      id,
      name: `SubAgent-${id}`,
      parent: this,
      root: this.root || this,
    })
    this.children.push(subAgent)
    return subAgent
  }
}
