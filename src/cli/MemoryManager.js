/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-16 09:18:05
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-04-07 15:17:03
 * @FilePath: \deepfish\src\cli\HistoryManager.js
 * @Description: 对话历史记录、恢复
 * @
 */
import fs from 'fs-extra'
import path from 'path'
import { GlobalVariable } from './GlobalVariable.js'
import aiConsole from '../AgentRobot/BaseAgentRobot/utils/aiConsole.js'
import { openDirectory } from '../AgentRobot/BaseAgentRobot/utils/normal.js'
// cache => [history.json, id => [message.json, logs => [log.txt]]]
// messageType:1.主会话 2.子会话（每次开始前自动清空上下文） 3.子任务会话（任务开始前，自动加载会话历史，或加载主会话历史）
class MemoryManager {
  constructor() {
    this.configManager = GlobalVariable.configManager
    this.memoryDir = path.join(this.configManager.configDir, 'memory')
    this.agentRecordFilePath = path.join(this.memoryDir, 'agentRecord.json')
    this.workspace = process.cwd()
  }

  openDirectory() {
    // 根据路径查看id
    const agentRecord = fs.readJSONSync(this.agentRecordFilePath, { throws: false }) || {}
    const agent = agentRecord?.find(item => {
      return item.workspace === this.workspace
    })
    if (!agent) {
      return aiConsole.logError('No history found for the current directory.')
    }
    const agentId = agent.agentId
    const dir = path.join(this.memoryDir, agentId)
    openDirectory(dir)
  }

  clearMessage() {
    // 根据路径查看id
    const agentRecord = fs.readJSONSync(this.agentRecordFilePath, { throws: false }) || {}
    const agentIndex = agentRecord?.findIndex(item => {
      return item.workspace === this.workspace
    })
    if (!~agentIndex) {
      return aiConsole.logError('No history found for the current directory.')
    }
    fs.removeSync(path.join(this.memoryDir, agentRecord[agentIndex].agentId))
    agentRecord.splice(agentIndex, 1)
    fs.writeJSONSync(this.agentRecordFilePath, agentRecord, { spaces: 2 })
    aiConsole.logSuccess('History cleared.')
  }
}

export default MemoryManager
