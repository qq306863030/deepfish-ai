import dayjs from 'dayjs'
import path from 'path'
import fs from 'fs-extra'

export default class Logger {
  constructor(agentRobot) {
    this.logDirPath = agentRobot.logDirPath
    this.screenPrinter = agentRobot.screenPrinter
    this.maxLogExpireTime = agentRobot.config.maxLogExpireTime
    this.memerySpace = agentRobot.memerySpace
    this.logTimeMap = new Map()
  }
  clearAllLogs() {
    const fileNames = fs.readdirSync(this.memerySpace)
    const currentDate = dayjs()
    fileNames.forEach((fileName) => {
      // 如果是目录则进入logs目录，清除日志文件
      const filePath = path.join(this.memerySpace, fileName)
      if (fs.statSync(filePath).isDirectory()) {
        const logDir = path.join(filePath, 'logs')
        if (fs.existsSync(logDir) && fs.statSync(logDir).isDirectory()) {
          const logFiles = fs.readdirSync(logDir)
          logFiles.forEach((logFile) => {
            if (logFile.startsWith('log-') && logFile.endsWith('.txt')) {
              const logDate = dayjs(logFile.slice(4, -4))
              if (currentDate.diff(logDate, 'day') > this.maxLogExpireTime) {
                fs.removeSync(path.join(logDir, logFile))
              }
            }
          })
        }
      }
    })
  }

  logExecTime(id, description = '') {
    if (this.logTimeMap.has(id)) {
      const startTime = this.logTimeMap.get(id)
      const duration = dayjs().diff(startTime, 'second')
      this.logTimeMap.delete(id)
      this.screenPrinter.logInfo(
        `${description} Execution time: ${duration} seconds`,
      )
      this.logInfo(`${description} Execution time: ${duration} seconds`)
    } else {
      this.logTimeMap.set(id, dayjs())
    }
  }
  logMessage(message) {
    if (this.maxLogExpireTime === 0) {
      return false
    }
    const logFile = path.join(
      this.logDir,
      `log-${dayjs().format('YYYY-MM-DD HH')}.txt`,
    )
    try {
      let logEntry = `[${new Date().toISOString()}][${message.role}] ${message.content}\n`
      fs.appendFileSync(logFile, logEntry)
      return true
    } catch (error) {
      console.error('Failed to log message:', error.message)
      return false
    }
  }
  logCompress(messages) {
    if (this.maxLogExpireTime === 0) {
      return false
    }
    const logFile = path.join(
      this.logDir,
      `log-${dayjs().format('YYYY-MM-DD HH')}.txt`,
    )
    try {
      let logEntry = `[${new Date().toISOString()}][***COMPRESS START***] 
      ${messages.map(m => `[${m.role}] ${m.content}`).join('\n')}
      [${new Date().toISOString()}][***COMPRESS END***] 
      `
      fs.appendFileSync(logFile, logEntry)
      return true
    } catch (error) {
      console.error('Failed to log compress:', error.message)
      return false
    }
  }
  logInfo(message) {
    if (this.maxLogExpireTime === 0) {
      return false
    }
    const logFile = path.join(
      this.logDir,
      `log-${dayjs().format('YYYY-MM-DD HH')}.txt`,
    )
    try {
      let logEntry = `[${new Date().toISOString()}][###############] ${message}\n`
      fs.appendFileSync(logFile, logEntry)
      return true
    } catch (error) {
      console.error('Failed to log info:', error.message)
      return false
    }
  }
}
