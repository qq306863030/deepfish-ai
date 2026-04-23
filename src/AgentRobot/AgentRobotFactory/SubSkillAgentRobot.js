const path = require('path')
const os = require('os')
const BaseAgentRobot = require('../BaseAgentRobot/index.js')
const Logger = require('../BaseAgentRobot/Logger.js')
const AgentTree = require('../BaseAgentRobot/utils/AgentTree.js')
const {
  AttachmentToolScanner,
} = require('../BaseAgentRobot/utils/AttachmentToolScanner.js')

class SubSkillAgentRobot extends BaseAgentRobot {
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
    this.userspace = path.join(this.basespace, 'user-info') // 用户空间，目录
    this.memorySpace = path.join(this.basespace, 'memory') // 记忆空间，目录
    this.agentRecordFilePath = path.join(this.memorySpace, 'agentRecord.json')
    this.agentSpace = path.join(this.memorySpace, this.root.id) // Agent空间，目录
    this.agentTreeFilePath = path.join(this.agentSpace, 'agentTree.json')
    this.memoryFilePath = path.join(this.agentSpace, `memory-${this.id}.json`)
    this.logDirPath = path.join(this.agentSpace, 'logs')
    this.logger = new Logger(this) // 初始化日志系统
    this.agentTree = new AgentTree(this)
    this.agentTree.init()
  }

  _getDefaultSystemPrompt(opt) {
    const clawSkills = opt.clawSkills || []
    let systemPrompt = super._getDefaultSystemPrompt(opt)
    systemPrompt =
      systemPrompt + '\n' + AttachmentToolScanner.getClawSkillPrompt(clawSkills, this.toolManager.toolCollection, this.toolManager.clawSkillCollection)
    return systemPrompt
  }
}

module.exports = SubSkillAgentRobot
