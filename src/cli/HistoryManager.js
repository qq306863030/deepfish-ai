/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-16 09:18:05
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-25 16:15:03
 * @FilePath: \deepfish\src\cli\HistoryManager.js
 * @Description: 对话历史记录、恢复
 * @
 */
const fs = require('fs-extra')
const path = require('path')
const dayjs = require('dayjs')
const { GlobalVariable } = require('../core/globalVariable')
const { v4: uuidv4 } = require('uuid')
const { logSuccess, logError } = require('../core/utils/log')
const { openDirectory } = require('../core/utils/normal')
// cache => [history.json, id => [message.json, logs => [log.txt]]]
class HistoryManager {
  constructor() {
    this.configManager = GlobalVariable.configManager
    this.cacheDir = null
    this.historyFilePath = null
    this.history = null
    this.id = null
    this.logDir = null
    GlobalVariable.historyManager = this
    this.initRecord()
  }

  reset() {
    // 删除缓存目录
    if (this.cacheDir && fs.existsSync(this.cacheDir)) {
      fs.removeSync(this.cacheDir)
    }
    this.initRecord()
  }

  initRecord() {
    this.cacheDir = path.join(this.configManager.configDir, './cache')
    fs.ensureDirSync(this.cacheDir)
    this.historyFilePath = path.join(this.cacheDir, 'history.json')
    this.history = this.getHistory()
    this.autoClearRecord()
    const currentPath = process.cwd()
    const historyItem = this.history.find(
      (item) => item.execPath === currentPath,
    )
    if (!historyItem) {
      const id = uuidv4()
      const newHistoryItem = {
        id: id,
        execPath: currentPath,
        execTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      }
      // 根据id创建目录，再创建一个message.json文件
      const recordDir = path.join(this.cacheDir, id)
      const messageFile = path.join(recordDir, 'message.json')
      fs.ensureDirSync(recordDir)
      fs.writeJsonSync(messageFile, [], { spaces: 2 })
      this.history.push(newHistoryItem)
      this.updateHistory(this.history)
      this.id = newHistoryItem.id
    } else {
      historyItem.execTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
      this.id = historyItem.id
    }
    const logDir = path.join(this.cacheDir, this.id, 'logs')
    fs.ensureDirSync(logDir)
    this.logDir = logDir
    this.autoClearLog()
  }

  openDirectory() {
    const dir = path.join(this.cacheDir, this.id)
    openDirectory(dir)
  }

  autoClearRecord() {
    const config = this.configManager.getConfig()
    const retentionDays = config.maxHistoryExpireTime || 30
    if (retentionDays === -1) {
      return
    } else if (retentionDays === 0) {
      this.clearMessage()
    }
    const currentDate = dayjs()
    const history = this.history.filter(
      (item) => currentDate.diff(dayjs(item.execTime), 'day') > retentionDays,
    )
    if (history.length > 0) {
      history.forEach((item) => {
        const recordDir = path.join(this.cacheDir, item.id)
        fs.removeSync(recordDir)
      })
      this.history = this.history.filter(
        (item) =>
          currentDate.diff(dayjs(item.execTime), 'day') <= retentionDays,
      )
      this.updateHistory(this.history)
    }
  }

  autoClearLog() {
    const config = this.configManager.getConfig()
    const retentionDays = config.maxLogExpireTime || 3
    if (retentionDays === -1) {
      return
    }
    if (this.history.length > 0) {
      this.history.forEach((item) => {
        const currentDate = dayjs()
        const logDir = path.join(this.cacheDir, item.id, 'logs')
        const logFiles = fs.readdirSync(logDir)
        logFiles.forEach((logFile) => {
          // 解析日志文件名中的日期
          if (logFile.startsWith('log-') && logFile.endsWith('.txt')) {
            const logDate = dayjs(logFile.slice(4, -4))
            if (currentDate.diff(logDate, 'day') > retentionDays) {
              fs.removeSync(path.join(logDir, logFile))
            }
          }
        })
      })
    }
  }

  clearMessage() {
    const messageFile = path.join(this.cacheDir, this.id, 'message.json')
    if (fs.existsSync(messageFile)) {
      fs.writeJsonSync(messageFile, [], { spaces: 2 })
    }
  }

  updateMessage(message) {
    const messageFile = path.join(this.cacheDir, this.id, 'message.json')
    if (fs.pathExistsSync(messageFile)) {
      fs.writeJsonSync(messageFile, message, { spaces: 2 })
    }
  }

  getMessage() {
    const messageFile = path.join(this.cacheDir, this.id, 'message.json')
    if (!fs.pathExistsSync(messageFile)) {
      return []
    }
    return fs.readJsonSync(messageFile, { throws: false }) || []
  }

  outputMessage() {
    const message = this.getMessage()
    const outputFile = path.join(process.cwd(), 'message.json')
    fs.writeJsonSync(outputFile, message, { spaces: 2 })
    logSuccess(`History messages have been output to ${outputFile}`)
  }

  getHistory() {
    const isExists = fs.existsSync(this.historyFilePath)
    if (isExists) {
      return fs.readJsonSync(this.historyFilePath, { throws: false })
    } else {
      // 创建一个文件
      fs.writeJsonSync(this.historyFilePath, [], { spaces: 2 })
      return []
    }
  }

  // 更新history文件
  updateHistory(history) {
    this.history = history
    fs.writeJsonSync(this.historyFilePath, this.history, { spaces: 2 })
  }

  record(messages) {
    try {
      const config = this.configManager.getConfig()
      if (config.maxHistoryExpireTime === 0) {
        return false
      }
      this.updateMessage(messages)
      return true
    } catch (error) {
      console.error('Failed to record:', error.message)
      return false
    }
  }

  // 记录message以及压缩后的messages
  log(message, isCompress = false) {
    const config = this.configManager.getConfig()
    if (config.maxLogExpireTime === 0) {
      return false
    }
    const logFile = path.join(
      this.logDir,
      `log-${dayjs().format('YYYY-MM-DD HH')}.txt`,
    )
    try {
      let logEntry = ''
      if (isCompress) {
        logEntry = `[${new Date().toISOString()}][compress] ${message.content}\n`
      } else {
        logEntry = `[${new Date().toISOString()}][${message.role}] ${message.content}\n`
      }
      fs.appendFileSync(logFile, logEntry)
      return true
    } catch (error) {
      console.error('Failed to log:', error.message)
      return false
    }
  }
}

module.exports = HistoryManager
