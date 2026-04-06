import path from 'path'
import os from 'os'
import BaseAgentRobot from './BaseAgentRobot/index.js'
import Logger from './BaseAgentRobot/Logger.js'

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
    this.memerySpace = path.join(this.basespace, 'memery') // 记忆空间，目录
    this.agentRecordFilePath = path.join(this.memerySpace, 'agentRecord.json')
    this.agentSpace = path.join(this.memerySpace, this.root.id) // 机器人空间，目录
    this.agentTreeFilePath = path.join(this.agentSpace, 'agentTree.json')
    this.memoryFilePath = path.join(this.agentSpace, `memory-${this.id}.json`)
    this.logDirPath = path.join(this.agentSpace, 'logs')
    this.logger = new Logger(this) // 初始化日志系统
  }

  // 创建子机器人
  createSubAgent(id, attachTools = []) {
    const subAgent = new SubAgentRobot({
        ...this.originOpt,
        id,
        name: `SubAgent-${attachTools[0].name}`,
        parent: this,
        root: this.root || this,
        attachTools,
    })
    this.children.push(subAgent)
    return subAgent
  }
}
