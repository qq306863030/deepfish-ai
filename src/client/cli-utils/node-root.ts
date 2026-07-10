const path = require('path')
const fs = require('fs')

/**
 * 辅助函数：解析路径（处理软链/快捷方式，验证路径存在性）
 */
function resolveValidPath(targetPath: string) {
  if (!targetPath) return null
  try {
    const realPath = fs.realpathSync(targetPath)
    return fs.existsSync(realPath) ? realPath : null
  } catch {
    return null
  }
}

/**
 * 通过 Node 内置变量计算全局 node_modules 路径（不执行 shell 命令，避免 Windows 黑窗）
 */
function getGlobalNodeModulesPath() {
  try {
    const nodeExecPath = process.execPath
    let globalPrefix: string
    if (process.platform === 'win32') {
      globalPrefix = path.dirname(path.dirname(nodeExecPath))
    } else {
      globalPrefix = path.dirname(path.dirname(path.dirname(nodeExecPath)))
    }
    return resolveValidPath(path.join(globalPrefix, 'lib', 'node_modules'))
  } catch {
    return null
  }
}


export default getGlobalNodeModulesPath