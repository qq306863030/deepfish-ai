const path = require('path')
const os = require('os')
const fs = require('fs-extra')
const dayjs = require('dayjs')
const Logger = require('../BaseAgentRobot/Logger.js')
const BaseAgentRobot = require('../BaseAgentRobot/index.js')
const AttachmentToolScanner = require('../BaseAgentRobot/utils/AttachmentToolScanner.js')

class MainAgentRobot extends BaseAgentRobot {
  // toolCollection = null // 工具集合，包含所有工具函数
  constructor(opt) {
    super(opt)
    this.type = 'main'
  }

  // 初始化文件
  _initFiles(opt) {
    this.workspace = opt.workspace || process.cwd() // 工作空间，目录
    this.basespace = opt.basespace || path.join(os.homedir(), '.deepfish-ai') // 记忆空间，目录
    this.memorySpace = path.join(this.basespace, 'memory') // 记忆空间，目录
    this.agentRecordFilePath = path.join(this.memorySpace, 'agentRecord.json')
    fs.ensureDirSync(this.memorySpace)
    // 查看agentRecord.json文件是否存在，不存在则创建
    if (!fs.pathExistsSync(this.agentRecordFilePath)) {
      fs.writeJsonSync(this.agentRecordFilePath, [], { spaces: 2 })
    }
    // 判断是否已经存在workspace
    let agentRecord = fs.readJsonSync(this.agentRecordFilePath)
    const record = agentRecord.find(
      (record) => record.workspace === this.workspace,
    )
    if (record) {
      this.id = record.agentId
      this.name = record.name
      this.updateTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
    } else {
      agentRecord.push({
        agentId: this.id,
        name: this.name,
        workspace: this.workspace,
        createTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        updateTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      })
    }
    fs.writeJsonSync(this.agentRecordFilePath, agentRecord, { spaces: 2 })
    this.agentSpace = path.join(this.memorySpace, this.id) // 机器人空间，目录
    fs.ensureDirSync(this.agentSpace)
    this.agentTreeFilePath = path.join(this.agentSpace, 'agentTree.json')
    if (!fs.pathExistsSync(this.agentTreeFilePath)) {
      fs.writeJsonSync(
        this.agentTreeFilePath,
        { agentId: this.id, children: [] },
        { spaces: 2 },
      )
    } else {
      const agentTree = fs.readJsonSync(this.agentTreeFilePath)
      if (agentTree && agentTree.agentId === this.id) {
        // 恢复子机器人
        // this._parseAgentTree(this, agentTree)
      } else {
        agentTree.push({ agentId: this.id, children: [] })
        fs.writeJsonSync(this.agentTreeFilePath, agentTree, { spaces: 2 })
      }
    }
    this.agentTree = fs.readJsonSync(this.agentTreeFilePath)
    this.memoryFilePath = path.join(this.agentSpace, 'memory.json')
    this.logDirPath = path.join(this.agentSpace, 'logs')
    fs.ensureDirSync(this.logDirPath)

    // 自动清除过期的记忆和日志
    const currentDate = dayjs()
    agentRecord = agentRecord.filter((record) => {
      if (
        currentDate.diff(dayjs(record.updateTime), 'day') >
        opt.maxMemoryExpireTime
      ) {
        // 删除机器人空间
        fs.removeSync(path.join(this.memorySpace, record.agentId))
        return false
      }
      return true
    })
    fs.writeJsonSync(this.agentRecordFilePath, agentRecord, { spaces: 2 })
    this.logger = new Logger(this) // 初始化日志系统
    this.logger.clearAllLogs()
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
}

module.exports = MainAgentRobot
