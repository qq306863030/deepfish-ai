const path = require('path')
const fs = require('fs-extra')
const chardet = require('chardet')
const os = require('os')
const { spawn } = require('child_process')

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

module.exports = {
  objStrToObj,
  delay,
  traverseFiles,
  openDirectory,
  detectEncoding,
  sleep,
}
