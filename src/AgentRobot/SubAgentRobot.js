import path from 'path'
import os from 'os'
import BaseAgentRobot from './BaseAgentRobot/index.js'
import Logger from './BaseAgentRobot/Logger.js'
import AttachmentToolScanner, { AttachmentToolType } from './BaseAgentRobot/utils/AttachmentToolScanner.js'
import SubSkillAgentRobot from './SubSkillAgentRobot.js'

export default class SubAgentRobot extends BaseAgentRobot {
  // opt: { root, parent, ...MainAgentOpt }
  constructor(opt) {
    super(opt)
    this.type = 'sub'
  }

  _initFiles(opt) {
    this.root = opt.root
    this.parent = opt.parent
    this.attachTools = opt.attachTools || []
    this.workspace = opt.workspace || process.cwd() // 工作空间，目录
    this.basespace = opt.basespace || path.join(os.homedir(), '.deepfish-ai') // 记忆空间，目录
    this.memorySpace = path.join(this.basespace, 'memory') // 记忆空间，目录
    this.agentRecordFilePath = path.join(this.memorySpace, 'agentRecord.json')
    this.agentSpace = path.join(this.memorySpace, this.root.id) // 机器人空间，目录
    this.agentTreeFilePath = path.join(this.agentSpace, 'agentTree.json')
    this.memoryFilePath = path.join(this.agentSpace, `memory-${this.id}.json`)
    this.logDirPath = path.join(this.agentSpace, 'logs')
    this.logger = new Logger(this) // 初始化日志系统
    this.toolCollection = AttachmentToolScanner.getToolCollection(
      this.workspace,
    ) // 加载工具集合
    this.clawSkillCollection = AttachmentToolScanner.getClawSkillCollection(
      this.basespace,
    ) // 加载Claw技能集合
  }

  _getDefaultSystemPrompt(opt) {
    const systemPrompt = super._getDefaultSystemPrompt(opt)
    return `
  ${systemPrompt}
  ### 工具调用
  对于复杂的任务，先从可以使用的Skills中查找并使用合适的Skill，如果没有合适的Skill，再使用内置工具函数，使用时请严格按照工具函数的调用方式进行调用。
  ${AttachmentToolScanner.getAttachToolPrompt(this.toolCollection, this.clawSkillCollection)}
      `
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
      this.systemPrompt = this.systemPrompt + '\n' + AttachmentToolScanner.getClawSkillPrompt(clawSkill)
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
