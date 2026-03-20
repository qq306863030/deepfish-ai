/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-17 11:59:19
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-20 15:40:09
 * @FilePath: \deepfish\src\core\extension\ExtensionManager.js
 * @Description: 扩展函数管理
 * @
 */
const { descriptions, functions } = require('./DefaultExtension')
const path = require('path')
const fs = require('fs-extra')
const axios = require('axios')
const dayjs = require('dayjs')
const lodash = require('lodash')
const shelljs = require('shelljs')
const iconv = require('iconv-lite') // 用于编码转换
const os = require('os') // 用于判断系统类型
const { logError } = require('../utils/log')
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
  // 扫描位置1.ai进程所在目录的node_modules 2.根目录的node_modules 3.命令执行目录的node_modules 4.命令执行目录
  // 扫描文件1.@deepfish-ai目录下的扩展 2.deepfish-开头的扩展 3.命令执行目录的js文件
  // 判断标准：扩展工具包中读取package.json文件，获取主文件路径；命令执行目录中存在的js文件，文件内同时包含'module.exports'、'descriptions'和'functions'字符
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
      // 查询目录下是否有@deepfish-ai目录
      fileNames.forEach((dirName) => {
        if (dirName === '@deepfish-ai') {
          const deepFishPath = path.resolve(dirPath, '@deepfish-ai')
          const packageNames = fs.readdirSync(deepFishPath)
          packageNames.forEach((packageName) => {
            const mainFile = this._scanDeepFishPackage(
              deepFishPath,
              packageName,
            )
            if (mainFile) {
              result.push(mainFile)
            }
          })
        } else if (
          dirName.startsWith('deepfish-') &&
          dirName !== 'deepfish-ai'
        ) {
          const mainFile = this._scanDeepFishPackage(dirPath, dirName)
          if (mainFile) {
              result.push(mainFile)
          }
        }
      })
    }
    const fileNames = fs.readdirSync(nodeModulesPath4)
    fileNames.forEach((fileName) => {
      if (fileName.endsWith('.js') || fileName.endsWith('.cjs')) {
        const mainFile = this._scanDeepFishJsFile(nodeModulesPath4, fileName)
        if (mainFile) {
          result.push(mainFile)
        }
      }
    })
    return result
  }

  // 扫描包
  _scanDeepFishPackage(parentDir, packageName) {
    const dirPath = path.resolve(parentDir, packageName)
    const packageJsonPath = path.resolve(dirPath, 'package.json')
    if (fs.pathExistsSync(packageJsonPath)) {
      const packageJson = fs.readJsonSync(packageJsonPath)
      if (packageJson.main) {
        return this._scanDeepFishJsFile(dirPath, packageJson.main)
      }
    }
    return null
  }
  // 扫描文件
  _scanDeepFishJsFile(parentDir, fileName) {
    const filePath = path.resolve(parentDir, fileName)
    if (fs.pathExistsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      if (
        fileContent.includes('module.exports') &&
        fileContent.includes('descriptions') &&
        fileContent.includes('functions')
      ) {
        return filePath
      }
    }
    return null
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
