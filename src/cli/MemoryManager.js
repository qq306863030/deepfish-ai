/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-16 09:18:05
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-04-08 18:31:55
 * @FilePath: \deepfish\src\cli\MemoryManager.js
 * @Description: 对话历史记录、恢复
 * @
 */
import fs from 'fs-extra'
import path from 'path'
import { GlobalVariable } from './GlobalVariable.js'
import aiConsole from '../AgentRobot/BaseAgentRobot/utils/aiConsole.js'
import { openDirectory } from '../AgentRobot/BaseAgentRobot/utils/normal.js'
class MemoryManager {
  constructor() {
    this.configManager = GlobalVariable.configManager
    this.memoryDir = path.join(this.configManager.configDir, 'memory')
    this.agentRecordFilePath = path.join(this.memoryDir, 'agentRecord.json')
    this.workspace = process.cwd()
  }

  openDirectory() {
    // 根据路径查看id
    const agentRecord = fs.readJSONSync(this.agentRecordFilePath, { throws: false }) || []
    const agent = agentRecord?.find(item => {
      return item.workspace === this.workspace
    })
    if (!agent) {
      return aiConsole.logError('No memory found for the current directory.')
    }
    const agentId = agent.agentId
    const dir = path.join(this.memoryDir, agentId)
    openDirectory(dir)
  }

  clearMessage() {
    // 根据路径查看id
    const agentRecord = fs.readJSONSync(this.agentRecordFilePath, { throws: false }) || []
    const agentIndex = agentRecord?.findIndex(item => {
      return item.workspace === this.workspace
    })
    if (!~agentIndex) {
      return aiConsole.logError('No memory found for the current directory.')
    }
    fs.removeSync(path.join(this.memoryDir, agentRecord[agentIndex].agentId))
    agentRecord.splice(agentIndex, 1)
    fs.writeJSONSync(this.agentRecordFilePath, agentRecord, { spaces: 2 })
    aiConsole.logSuccess('Memory cleared.')
  }
}

export default MemoryManager
