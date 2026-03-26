/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-16 09:18:05
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-26 11:02:17
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
// messageType:1.主会话 2.子会话（每次开始前自动清空上下文） 3.子任务会话（任务开始前，自动加载会话历史，或加载主会话历史）
class HistoryManager {
  constructor() {
    this.configManager = GlobalVariable.configManager
    this.cacheDir = null
    this.historyFilePath = null
    this.history = null
    this.messagePath = null // 主会话历史记录
    this.subMessagePath = null // 子会话历史记录
    this.taskMessagePath = null // 任务会话历史记录
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
    logSuccess('History has been reset.')
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
      this.messagePath = path.join(recordDir, 'message.json')
      this.subMessagePath = path.join(recordDir,'subMessage.json')
      this.taskMessagePath = path.join(recordDir,'taskMessage.json')
      fs.ensureDirSync(recordDir)
      fs.writeJsonSync(this.messagePath, [], { spaces: 2 })
      this.history.push(newHistoryItem)
      this.updateHistory(this.history)
      this.id = newHistoryItem.id
    } else {
      historyItem.execTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
      this.id = historyItem.id
      const recordDir = path.join(this.cacheDir, this.id)
      this.messagePath = path.join(recordDir, 'message.json')
      this.subMessagePath = path.join(recordDir,'subMessage.json')
      this.taskMessagePath = path.join(recordDir,'taskMessage.json')
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

  // 清除主会话
  clearMainMessage() {
    if (fs.existsSync(this.messagePath)) {
      fs.writeJsonSync(this.messagePath, [], { spaces: 2 })
      logSuccess('History messages have been cleared.')
      return
    }
    logError('No history messages found to clear.')
  }
    

  // 清除子会话
  clearSubMessage() {
    if (fs.existsSync(this.subMessagePath)) {
      fs.writeJsonSync(this.subMessagePath, [], { spaces: 2 })
      return
    }
  }

  // 清除任务会话
  clearTaskMessage() {
    if (fs.existsSync(this.taskMessagePath)) {
      fs.writeJsonSync(this.taskMessagePath, [], { spaces: 2 })
      return
    }
  }

  // 更新主会话
  updateMainMessage(message) {
    if (fs.pathExistsSync(this.messagePath)) {
      fs.writeJsonSync(this.messagePath, message, { spaces: 2 })
    }
  }

  // 更新子会话
  updateSubMessage(message) {
    fs.writeJsonSync(this.subMessagePath, message, { spaces: 2 })
  }

  // 更新任务会话
  updateTaskMessage(message) {
    if (!message || !message.length) {
      message = this.getMessage(1)
    }
    fs.writeJsonSync(this.taskMessagePath, message, { spaces: 2 })
  }


  clearMessage(messageType = 1) {
    switch (messageType) {
      case 1:
        this.clearMainMessage()
        break
      case 2:
        this.clearSubMessage()
        break
      case 3:
        this.clearTaskMessage()
        break
    }
  }

  updateMessage(messageType = 1, message) {
    switch (messageType) {
      case 1:
        this.updateMainMessage(message)
        break
      case 2:
        this.updateSubMessage(message)
        break
      case 3:
        this.updateTaskMessage(message)
        break
    }
  }

  getMessage(messageType = 1) {
    let messageFile = this.messagePath
    if (messageType === 2) {
      messageFile = this.subMessagePath
    } else if (messageType === 3) {
      messageFile = this.taskMessagePath
    }
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

  
  record(messages, messageType = 1) {
    try {
      const config = this.configManager.getConfig()
      if (config.maxHistoryExpireTime === 0) {
        return false
      }
      this.updateMessage(messageType, messages)
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
      if (typeof message === 'string') {
        logEntry = `[${new Date().toISOString()}][###############] ${message}\n`
      } else {
        if (isCompress) {
          logEntry = `[${new Date().toISOString()}][***compress***] ${message.content}\n`
        } else {
          logEntry = `[${new Date().toISOString()}][${message.role}] ${message.content}\n`
        }
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
