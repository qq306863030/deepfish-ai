import path from 'path'
import fs from 'fs-extra'
import chardet from 'chardet'
import os from 'os'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// 动态加载模块
function importModule(modulePath) {
  const targetPath =
    modulePath.startsWith('.') || path.isAbsolute(modulePath)
      ? path.resolve(process.cwd(), modulePath)
      : modulePath
  const resolvedModulePath = require.resolve(targetPath)
  delete require.cache[resolvedModulePath]
  const mod = require(resolvedModulePath)
  return mod?.default ?? mod
}
// 对象字符串转对象
function objStrToObj(str) {
  try {
    if (typeof str === 'string') {
      return eval(`(${str})`)
    } else {
      return str
    }
  } catch (error) {
    throw new Error(`对象转换失败：${error.message}`)
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 在 ESM 中安全获取当前模块目录
function getPath(metaUrl) {
  const filePath = fileURLToPath(metaUrl)
  return {
    fileDir: path.dirname(filePath),
    filePath,
  }
}

// 遍历目录和子目录下所有文件
function traverseFiles() {
  try {
    const currentDir = process.cwd()
    const allFiles = []
    const currentItems = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const item of currentItems) {
      const itemPath = path.join(currentDir, item.name)
      if (item.isFile()) {
        allFiles.push(itemPath)
        continue
      }
      if (item.isDirectory()) {
        try {
          const subItems = fs.readdirSync(itemPath, { withFileTypes: true })
          for (const subItem of subItems) {
            if (subItem.isFile()) {
              allFiles.push(path.join(itemPath, subItem.name))
            }
          }
        } catch (subErr) {
          console.warn(`读取子目录失败 ${itemPath}：${subErr.message}`)
        }
      }
    }
    return allFiles
  } catch (err) {
    console.error(`遍历目录失败：${err.message}`)
    return []
  }
}

// 打开目录
function openDirectory(dirPath) {
  // 打开目录
  const platform = process.platform
  let command
  let args
  const dir = dirPath
  if (platform === 'darwin') {
    command = 'open'
    args = [dir]
  } else if (platform === 'win32') {
    command = 'explorer.exe'
    args = [dir]
  } else {
    command = 'xdg-open'
    args = [dir]
  }
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  })
  child.on('error', (error) => {
    console.error(`Error opening directory "${dirPath}": ${error.message}`)
  })
  child.unref()
}

// 判断编码类型
function detectEncoding(buffer) {
  if (!buffer) {
    const platform = os.platform()
    return platform === 'win32' ? 'gbk' : 'utf-8'
  }
  const encoding = chardet.detect(buffer)
  if (encoding?.toLowerCase() === 'utf-8') {
    return 'utf-8'
  } else if (['gbk', 'gb2312', 'gb18030'].includes(encoding?.toLowerCase())) {
    return 'gbk'
  } else {
    const platform = os.platform()
    return platform === 'win32' ? 'gbk' : 'utf-8'
  }
}

export {
  importModule,
  objStrToObj,
  delay,
  getPath,
  traverseFiles,
  openDirectory,
  detectEncoding,
}
