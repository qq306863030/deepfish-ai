const path = require("path");
const fs = require("fs-extra");
const { GlobalVariable } = require('../core/globalVariable')
const { logError, logSuccess } = require('../core/utils/log');
const { traverseFiles } = require("./configTools");

class ExtConfigManager {
  constructor() {
    this.configManager = GlobalVariable.configManager
  }

  // 添加
  add(fileName) {
    // 检查 fileName 是否为空
    if (!fileName) {
      logError('Extension file name is required.')
      return
    }
    const filePath = path.resolve(process.cwd(), fileName)
    // 判断是否路径是文件还是目录
    if (fs.statSync(filePath).isDirectory()) {
      // 扫描目录和子目录下所有js、cjs文件
      const files = traverseFiles()
      const jsFiles = files.filter(
        (file) => file.endsWith('.js') || file.endsWith('.cjs'),
      )
      jsFiles.forEach((jsFile) => {
        // 读取文件，查询文件内是否存在‘descriptions’和‘functions’
        const fileContent = fs.readFileSync(jsFile, 'utf-8')
        if (
          fileContent.includes('module.exports') &&
          fileContent.includes('descriptions') &&
          fileContent.includes('functions')
        ) {
          this.add(jsFile)
        }
      })
      return
    }
    // 判断文件是否存在
    if (!fs.existsSync(filePath)) {
      logError(`File not found: ${filePath}`)
      return
    }
    const userConfig = this.configManager.config
    userConfig.extensions.push(filePath)
    // 数组去重
    this.configManager.updateExtensions([...new Set(userConfig.extensions)])
  }

  // 删除
  remove(fileName) {
    const userConfig = this.configManager.config
    // 增加对数字索引的支持
    if (!isNaN(Number(fileName))) {
      const extIndex = Number(fileName)
      if (extIndex < 0 || extIndex >= userConfig.extensions.length) {
        logError(`Invalid extension index: ${extIndex}`)
        return
      }
      this.configManager.removeExtensionByIndex(extIndex)
      return
    }
    const filePath = path.resolve(process.cwd(), fileName)
    this.configManager.removeExtensionByPath(filePath)
  }

  // 查看列表
  viewList() {
    const extensions = this.configManager.config.extensions
    if (extensions && Array.isArray(extensions)) {
      console.log('='.repeat(50))
      // 打印扩展列表，并加上索引
      if (extensions.length === 0) {
        console.log(`No extensions in config.`)
      } else {
        console.log('Extensions in config:')
        extensions.forEach((ext, index) => {
          console.log(`[${index}] ${ext}`)
        })
      }
      console.log('='.repeat(50))
    } else {
      logSuccess(`No extensions in config.`)
    }
  }

}

module.exports = ExtConfigManager
