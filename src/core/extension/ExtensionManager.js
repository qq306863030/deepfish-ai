const { descriptions, functions } = require('./DefaultExtension')
const path = require('path')
const fs = require('fs-extra')
const axios = require('axios')
const dayjs = require('dayjs')
const lodash = require('lodash')
const shelljs = require('shelljs')
const iconv = require('iconv-lite') // 用于编码转换
const os = require('os') // 用于判断系统类型
const { logError } = require('../utils')
const { getGlobalNodeModulesPath } = require('../utils/node-root')

class ExtensionManager {
  constructor(aiCli) {
    this.aiCli = aiCli
    this.extensions = {
      descriptions,
      functions,
    }
    this.parseExtends(this.aiCli.config.extensions || [])
  }

  parseExtends(configExtends) {
    // 自动扫描扩展模块
    const autoScannedExtends = this.autoScanExtensions()
    configExtends = configExtends.concat(autoScannedExtends)
    for (const extensionPath of configExtends) {
      try {
        // 解析扩展路径
        const resolvedPath = path.isAbsolute(extensionPath)
          ? extensionPath
          : path.resolve(process.cwd(), extensionPath)

        if (!fs.existsSync(resolvedPath)) {
          logError(`Extension file not found: ${resolvedPath}`)
          continue
        }

        // 动态加载扩展模块
        let { descriptions, functions } = require(resolvedPath)
        descriptions = descriptions.map((item) => {
          if (!item.type) {
            return {
              type: 'function',
              function: item,
            }
          } else {
            return item
          }
        })
        this.extensions.descriptions =
          this.extensions.descriptions.concat(descriptions)
        this.extensions.functions = Object.assign(
          this.extensions.functions,
          functions,
        )
      } catch (error) {
        logError(`Error loading extension ${extensionPath}: ${error.message}`)
      }
    }
    const functions = this.extensions.functions
    for (const fnName of Object.keys(functions)) {
      functions[fnName] = functions[fnName].bind(this.aiCli)
      if (fnName === 'test') {
        functions[fnName]()
      }
    }
    functions['fs'] = fs
    functions['axios'] = axios
    functions['dayjs'] = dayjs
    functions['lodash'] = lodash
  }

  // 自动扫描node_modules和命令执行目录下的扩展模块
  autoScanExtensions() {
    const result = []
    // 扫描本程序所在目录下node_modules目录
    const nodeModulesPath1 = path.resolve(__dirname, '../../../node_modules')
    // 扫描根node_modules目录
    const nodeModulesPath2 = getGlobalNodeModulesPath()
    // 扫描命令执行目录下node_modules目录
    const nodeModulesPath3 = path.resolve(process.cwd(), 'node_modules')
    // 扫描命令执行目录
    const nodeModulesPath4 = process.cwd()
    for (const dirPath of [
      nodeModulesPath1,
      nodeModulesPath2,
      nodeModulesPath3,
      nodeModulesPath4,
    ]) {
      if (!dirPath) {
        continue
      }
      if (!fs.existsSync(dirPath)) {
        continue
      }
      const fileNames = fs.readdirSync(dirPath)
      for (const fileName of fileNames) {
        // 如果是目录且目录名称前缀是"deepfish-"，则认为是扩展模块
        const extensionDir = path.resolve(dirPath, fileName)
        if (
          fileName.startsWith('deepfish-') &&
          fileName !== 'deepfish-ai' &&
          fs.statSync(extensionDir).isDirectory()
        ) {
          const subDirNames = fs.readdirSync(extensionDir)
          const jsFiles = subDirNames.filter(
            (file) => file.endsWith('.js') || file.endsWith('.cjs'),
          )
          for (const jsFile of jsFiles) {
            const jsFilePath = path.resolve(extensionDir, jsFile)
            // 读取文件，查询文件内是否存在‘descriptions’和‘functions’
            const fileContent = fs.readFileSync(jsFilePath, 'utf-8')
            if (
              fileContent.includes('descriptions') &&
              fileContent.includes('functions')
            ) {
              result.push(jsFilePath)
            }
          }
        }
      }
    }
    return result
  }

  _executeCommand(command) {
    return new Promise((resolve, reject) => {
      const platform = os.platform()
      const targetEncoding = platform === 'win32' ? 'gbk' : 'utf-8' // Windows(含PowerShell)用gbk，Linux/macOS用utf-8
      shelljs.exec(
        command,
        {
          async: true,
          cwd: process.cwd(),
          encoding: 'binary',
          silent: true,
        },
        (code, stdout, stderr) => {
          try {
            const stdoutUtf8 = iconv.decode(
              Buffer.from(stdout, 'binary'),
              targetEncoding,
            )
            const stderrUtf8 = iconv.decode(
              Buffer.from(stderr, 'binary'),
              targetEncoding,
            )
            if (stderrUtf8 && !stderrUtf8.trim().startsWith('WARNING')) {
              // 过滤无关警告
              const error = new Error(
                `Command failed (code ${code}): ${stderrUtf8}`,
              )
              reject(error)
              return
            }
            resolve(stdoutUtf8)
          } catch (decodeError) {
            reject(
              new Error(
                `Failed to parse command output: ${decodeError.message}`,
              ),
            )
          }
        },
      )
    })
  }
}

module.exports = ExtensionManager
