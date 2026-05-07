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

// 判断代码是否有返回值
function analyzeReturn(code) {
  if (typeof code !== 'string' || !code.trim()) {
    return {
      hasReturn: false,
      hasReturnValue: false,
    }
  }

  // 移除字符串和注释，避免把文本中的 return 误判为代码关键字。
  function stripStringsAndComments(input) {
    const chars = input.split('')
    let i = 0
    let state = 'normal'

    while (i < chars.length) {
      const ch = chars[i]
      const next = chars[i + 1]

      if (state === 'normal') {
        if (ch === '/' && next === '/') {
          state = 'line-comment'
          chars[i] = ' '
          chars[i + 1] = ' '
          i += 2
          continue
        }
        if (ch === '/' && next === '*') {
          state = 'block-comment'
          chars[i] = ' '
          chars[i + 1] = ' '
          i += 2
          continue
        }
        if (ch === "'") {
          state = 'single-quote'
          chars[i] = ' '
          i += 1
          continue
        }
        if (ch === '"') {
          state = 'double-quote'
          chars[i] = ' '
          i += 1
          continue
        }
        if (ch === '`') {
          state = 'template'
          chars[i] = ' '
          i += 1
          continue
        }
        i += 1
        continue
      }

      if (state === 'line-comment') {
        if (ch === '\n') {
          state = 'normal'
        } else {
          chars[i] = ' '
        }
        i += 1
        continue
      }

      if (state === 'block-comment') {
        if (ch === '*' && next === '/') {
          chars[i] = ' '
          chars[i + 1] = ' '
          state = 'normal'
          i += 2
        } else {
          if (ch !== '\n') {
            chars[i] = ' '
          }
          i += 1
        }
        continue
      }

      if (state === 'single-quote') {
        if (ch === '\\') {
          chars[i] = ' '
          if (i + 1 < chars.length) {
            chars[i + 1] = ' '
          }
          i += 2
          continue
        }
        chars[i] = ch === '\n' ? '\n' : ' '
        if (ch === "'") {
          state = 'normal'
        }
        i += 1
        continue
      }

      if (state === 'double-quote') {
        if (ch === '\\') {
          chars[i] = ' '
          if (i + 1 < chars.length) {
            chars[i + 1] = ' '
          }
          i += 2
          continue
        }
        chars[i] = ch === '\n' ? '\n' : ' '
        if (ch === '"') {
          state = 'normal'
        }
        i += 1
        continue
      }

      if (state === 'template') {
        if (ch === '\\') {
          chars[i] = ' '
          if (i + 1 < chars.length) {
            chars[i + 1] = ' '
          }
          i += 2
          continue
        }
        chars[i] = ch === '\n' ? '\n' : ' '
        if (ch === '`') {
          state = 'normal'
        }
        i += 1
      }
    }

    return chars.join('')
  }

  function isReturnWithValue(input, startIndex) {
    let i = startIndex
    while (i < input.length) {
      const ch = input[i]
      const next = input[i + 1]
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        i += 1
        continue
      }

      if (ch === '/' && next === '/') {
        i += 2
        while (i < input.length && input[i] !== '\n') {
          i += 1
        }
        continue
      }

      if (ch === '/' && next === '*') {
        i += 2
        while (i < input.length) {
          if (input[i] === '*' && input[i + 1] === '/') {
            i += 2
            break
          }
          i += 1
        }
        continue
      }

      if (ch === '\n' || ch === ';' || ch === '}' || ch === ')') {
        return false
      }
      return true
    }
    return false
  }

  function isControlKeyword(token) {
    return ['if', 'for', 'while', 'switch', 'catch', 'with'].includes(token)
  }

  const cleaned = stripStringsAndComments(code)
  const tokenRegex = /[A-Za-z_$][\w$]*|=>|[{}()\[\]]/g
  const blockStack = []
  const parenStack = []
  let functionDepth = 0
  let pendingFunctionBlock = 0
  let pendingArrow = false
  let hasReturn = false
  let hasReturnValue = false
  let lastToken = ''
  let recentClosedParen = null
  let match

  while ((match = tokenRegex.exec(cleaned)) !== null) {
    const token = match[0]
    const index = match.index

    if (token === '(') {
      parenStack.push({
        beforeToken: lastToken,
      })
      lastToken = token
      continue
    }

    if (token === ')') {
      recentClosedParen = parenStack.pop() || null
      lastToken = token
      continue
    }

    if (token === 'function') {
      pendingFunctionBlock += 1
      pendingArrow = false
      lastToken = token
      recentClosedParen = null
      continue
    }

    if (token === '=>') {
      pendingArrow = true
      lastToken = token
      recentClosedParen = null
      continue
    }

    if (token === '{') {
      let isFunctionBlock = false
      if (pendingFunctionBlock > 0 || pendingArrow) {
        isFunctionBlock = true
      } else if (lastToken === ')' && recentClosedParen) {
        const beforeToken = recentClosedParen.beforeToken
        if (beforeToken && !isControlKeyword(beforeToken)) {
          // 识别 class/object method 这类无 function 关键字的方法体。
          isFunctionBlock = true
        }
      }

      if (isFunctionBlock) {
        blockStack.push('function')
        functionDepth += 1
        if (pendingFunctionBlock > 0) {
          pendingFunctionBlock -= 1
        }
      } else {
        blockStack.push('block')
      }

      pendingArrow = false
      lastToken = token
      recentClosedParen = null
      continue
    }

    if (token === '}') {
      const top = blockStack.pop()
      if (top === 'function' && functionDepth > 0) {
        functionDepth -= 1
      }
      pendingArrow = false
      lastToken = token
      recentClosedParen = null
      continue
    }

    if (token === 'return' && functionDepth === 0) {
      hasReturn = true
      if (isReturnWithValue(code, index + token.length)) {
        hasReturnValue = true
      }
      if (hasReturn && hasReturnValue) {
        break
      }
    }

    if (pendingArrow) {
      // 箭头函数表达式体不带 {} 时，不会有 return 关键字参与判断。
      pendingArrow = false
    }

    lastToken = token
    recentClosedParen = null
  }

  return {
    hasReturn,
    hasReturnValue,
  }
}

module.exports = {
  objStrToObj,
  delay,
  traverseFiles,
  openDirectory,
  detectEncoding,
  sleep,
  analyzeReturn,
}
