/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-17 11:59:19
 * @LastEditors: roman_123 306863030@qq.com
 * @LastEditTime: 2026-04-25 01:15:56
 * @FilePath: \deepfish\src\AgentRobot\BaseAgentRobot\tools\FileTools.js
 * @Description: 文件处理扩展函数
 * @
 */
const path = require('path')
const fs = require('fs-extra')
const AdmZip = require('adm-zip')

function createSuccessResult(data = null) {
  return {
    success: true,
    data,
  }
}

function createErrorResult(error, data = null) {
  return {
    success: false,
    error: error?.message || String(error),
    data,
  }
}

async function createFile(filePath, content) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)
    const dirPath = path.dirname(fullPath)

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    fs.writeFileSync(fullPath, content)
    return createSuccessResult({ filePath: fullPath })
  } catch (error) {
    return createErrorResult(error, { filePath })
  }
}

async function modifyFile(filePath, content) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)

    if (!fs.existsSync(fullPath)) {
      return createErrorResult(`File does not exist: ${fullPath}`, {
        filePath: fullPath,
      })
    }

    fs.writeFileSync(fullPath, content)
    return createSuccessResult({ filePath: fullPath })
  } catch (error) {
    return createErrorResult(error, { filePath })
  }
}

async function readFile(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)

    if (!fs.existsSync(fullPath)) {
      return createErrorResult(`File does not exist: ${fullPath}`, {
        filePath: fullPath,
      })
    }

    const content = fs.readFileSync(fullPath, 'utf8')
    return createSuccessResult({ filePath: fullPath, content })
  } catch (error) {
    return createErrorResult(error, { filePath })
  }
}

/**
 * 替换文件中的文本内容
 * @param {string} filePath 要处理的文件路径
 * @param {string|RegExp} searchValue 要查找的文本或正则表达式
 * @param {string} replaceValue 替换后的文本内容
 * @param {boolean} [isGlobal=true] 是否进行全局替换，默认开启
 * @returns {Promise<boolean>} 操作是否成功，成功返回 true，失败返回 false
 */
async function replaceFileText(
  filePath,
  searchValue,
  replaceValue,
  isGlobal = true,
) {
  try {
    const readResult = await readFile(filePath)
    if (!readResult.success) {
      return readResult
    }
    const content = readResult.data.content
    const replacedContent = content.replace(
      typeof searchValue === 'string'
        ? new RegExp(searchValue, isGlobal ? 'g' : '')
        : searchValue,
      replaceValue,
    )
    const modifyResult = await modifyFile(filePath, replacedContent)
    if (!modifyResult.success) {
      return modifyResult
    }
    return createSuccessResult({
      filePath: path.resolve(process.cwd(), filePath),
    })
  } catch (error) {
    return createErrorResult(error, { filePath })
  }
}

async function appendToFile(filePath, content) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)

    if (!fs.existsSync(fullPath)) {
      return createErrorResult(`File does not exist: ${fullPath}`, {
        filePath: fullPath,
      })
    }

    fs.appendFileSync(fullPath, content)
    return createSuccessResult({ filePath: fullPath })
  } catch (error) {
    return createErrorResult(error, { filePath })
  }
}

function fileExists(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)
    return createSuccessResult({
      filePath: fullPath,
      exists: fs.existsSync(fullPath),
    })
  } catch (error) {
    return createErrorResult(error, { filePath })
  }
}

async function createDirectory(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath)
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true })
    }
    return createSuccessResult({ dirPath: fullPath })
  } catch (error) {
    return createErrorResult(error, { dirPath })
  }
}

async function deleteFile(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }
    return createSuccessResult({ filePath: fullPath })
  } catch (error) {
    return createErrorResult(error, { filePath })
  }
}

async function deleteDirectory(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath)

    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true })
    }
    return createSuccessResult({ dirPath: fullPath })
  } catch (error) {
    return createErrorResult(error, { dirPath })
  }
}

async function rename(oldPath, newPath) {
  try {
    const fullOldPath = path.resolve(process.cwd(), oldPath)
    const fullNewPath = path.resolve(process.cwd(), newPath)

    if (fs.existsSync(fullOldPath)) {
      fs.renameSync(fullOldPath, fullNewPath)
      return createSuccessResult({ oldPath: fullOldPath, newPath: fullNewPath })
    }
    return createErrorResult(`Source path does not exist: ${fullOldPath}`, {
      oldPath: fullOldPath,
      newPath: fullNewPath,
    })
  } catch (error) {
    return createErrorResult(error, { oldPath, newPath })
  }
}

async function copyFile(sourcePath, destinationPath) {
  try {
    const fullSourcePath = path.resolve(process.cwd(), sourcePath)
    const fullDestPath = path.resolve(process.cwd(), destinationPath)
    const destDirPath = path.dirname(fullDestPath)

    fs.ensureDirSync(destDirPath)

    if (fs.existsSync(fullSourcePath)) {
      fs.copyFileSync(fullSourcePath, fullDestPath)
      return createSuccessResult({
        sourcePath: fullSourcePath,
        destinationPath: fullDestPath,
      })
    } else {
      return createErrorResult(
        `Source file does not exist: ${fullSourcePath}`,
        {
          sourcePath: fullSourcePath,
          destinationPath: fullDestPath,
        },
      )
    }
  } catch (error) {
    return createErrorResult(error, { sourcePath, destinationPath })
  }
}

async function moveFile(sourcePath, destinationPath) {
  try {
    const fullSourcePath = path.resolve(process.cwd(), sourcePath)
    const fullDestPath = path.resolve(process.cwd(), destinationPath)
    const destDirPath = path.dirname(fullDestPath)

    if (!fs.existsSync(destDirPath)) {
      fs.mkdirSync(destDirPath, { recursive: true })
    }

    if (fs.existsSync(fullSourcePath)) {
      fs.renameSync(fullSourcePath, fullDestPath)
      return createSuccessResult({
        sourcePath: fullSourcePath,
        destinationPath: fullDestPath,
      })
    }
    return createErrorResult(`Source file does not exist: ${fullSourcePath}`, {
      sourcePath: fullSourcePath,
      destinationPath: fullDestPath,
    })
  } catch (error) {
    return createErrorResult(error, { sourcePath, destinationPath })
  }
}

async function getFileInfo(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)

    if (!fs.existsSync(fullPath)) {
      return createErrorResult(`File does not exist: ${fullPath}`, {
        filePath: fullPath,
      })
    }

    const stats = fs.statSync(fullPath)
    return createSuccessResult({
      path: fullPath,
      size: stats.size,
      birthtime: stats.birthtime,
      mtime: stats.mtime,
      ctime: stats.ctime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    })
  } catch (error) {
    return createErrorResult(error, { filePath })
  }
}

async function getFileNameList(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath)
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      return createErrorResult(
        `Directory does not exist or is not a directory: ${fullPath}`,
        {
          dirPath: fullPath,
        },
      )
    }
    const files = fs.readdirSync(fullPath)
    return createSuccessResult({ dirPath: fullPath, files })
  } catch (error) {
    return createErrorResult(error, { dirPath })
  }
}

async function clearDirectory(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath)

    if (!fs.existsSync(fullPath)) {
      return createErrorResult(`Directory does not exist: ${fullPath}`, {
        dirPath: fullPath,
      })
    }

    if (!fs.statSync(fullPath).isDirectory()) {
      return createErrorResult(`Path is not a directory: ${fullPath}`, {
        dirPath: fullPath,
      })
    }

    const files = fs.readdirSync(fullPath)

    for (const file of files) {
      const filePath = path.join(fullPath, file)
      if (fs.statSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true })
      } else {
        fs.unlinkSync(filePath)
      }
    }

    return createSuccessResult({ dirPath: fullPath })
  } catch (error) {
    return createErrorResult(error, { dirPath })
  }
}

/**
 * 【跨平台】压缩 文件/文件夹 为 zip（支持中文、多层目录）
 * @param {string} inputPath 要压缩的文件或文件夹路径
 * @param {string} outputZipPath 输出的 zip 路径
 * @returns {Promise<boolean>} 操作是否成功，成功返回 true，失败返回 false
 */
async function compressToZip(inputPath, outputZipPath) {
  try {
    const absoluteInput = path.resolve(inputPath)
    const absoluteOutput = path.resolve(outputZipPath)
    // 检查源路径是否存在
    await fs.access(absoluteInput)
    const zip = new AdmZip()
    // 判断是文件还是文件夹
    const stats = await fs.stat(absoluteInput)
    if (stats.isDirectory()) {
      // 压缩文件夹（递归添加所有子文件）
      zip.addLocalFolder(absoluteInput)
    } else {
      // 压缩单个文件
      zip.addLocalFile(absoluteInput)
    }
    // 写入 zip 文件
    await zip.writeZipPromise(absoluteOutput)
    return createSuccessResult({
      inputPath: absoluteInput,
      outputZipPath: absoluteOutput,
    })
  } catch (err) {
    return createErrorResult(err, { inputPath, outputZipPath })
  }
}

/**
 * 【跨平台】解压 zip 文件（支持密码、中文不乱码）
 * @param {string} zipFilePath zip 文件路径
 * @param {string} extractToPath 解压到哪个文件夹
 * @returns {Promise<boolean>} 操作是否成功，成功返回 true，失败返回 false
 */
async function extractZip(zipFilePath, extractToPath) {
  try {
    const absoluteZipPath = path.resolve(zipFilePath)
    const absoluteExtractPath = path.resolve(extractToPath)
    await fs.access(absoluteZipPath)
    const zip = new AdmZip(absoluteZipPath)
    // 自动创建目标目录
    await fs.mkdir(absoluteExtractPath, { recursive: true })
    // 解压所有文件
    zip.extractAllTo(absoluteExtractPath, true)
    return createSuccessResult({
      zipFilePath: absoluteZipPath,
      extractToPath: absoluteExtractPath,
    })
  } catch (err) {
    return createErrorResult(err, { zipFilePath, extractToPath })
  }
}

// 文档提取功能，提取文件相关内容
async function extractFileContent(filePrompt, filePathList) {
  try {
    let result = []
    for (const filePath of filePathList) {
      const absolutePath = path.resolve(process.cwd(), filePath)
      const fileName = path.basename(absolutePath)
      if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
        result.push({
          filePath: absolutePath,
          fileName,
          errorContent: `File does not exist or is not a file: ${absolutePath}`,
        })
      }
      const successContent = await this.Tools.createSubAgent(
        `你是文件内容提取助手。请从文件 ${fileName}（路径：${absolutePath}）中提取与“${filePrompt}”相关的内容。
要求：
1. 只返回与该主题直接相关的原文片段，保持原始语言与措辞。
2. 不要输出解释、总结、前后缀、Markdown 标记或任何额外说明。
3. 如果没有相关内容，只返回：null。`,
      )
      return createSuccessResult({
        filePath: absolutePath,
        fileName,
        successContent,
      })
    }
  } catch (error) {
    return createErrorResult(error, null)
  }
}

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'createFile',
      description:
        '创建一个包含指定内容的新文件。参数：filePath 为目标文件路径；content 为要写入的文件内容。返回值：对象，包含 success（是否成功）、data（成功数据）、error（失败错误信息）；若目录不存在会自动创建目录结构。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '目标文件路径。' },
          content: { type: 'string', description: '要写入的文件内容。' },
        },
        required: ['filePath', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'modifyFile',
      description:
        '修改指定文件的内容。参数：filePath 为目标文件路径；content 为新的完整文件内容。返回值：对象，包含 success、data、error；如果文件不存在会在 error 中返回原因。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '目标文件路径。' },
          content: { type: 'string', description: '新的完整文件内容。' },
        },
        required: ['filePath', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'readFile',
      description:
        '读取指定文件的内容。参数：filePath 为要读取的文件路径。返回值：对象，包含 success、data（含 content）、error；如果文件不存在或读取失败会在 error 中返回原因。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '要读取的文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'appendToFile',
      description:
        '向指定文件追加内容。参数：filePath 为目标文件路径；content 为要追加的文本内容。返回值：对象，包含 success、data、error；如果文件不存在会在 error 中返回原因。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '目标文件路径。' },
          content: { type: 'string', description: '要追加的文本内容。' },
        },
        required: ['filePath', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fileExists',
      description:
        '检查指定文件是否存在。参数：filePath 为待检查的文件路径。返回值：对象，包含 success、data（含 exists 布尔值）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '待检查的文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createDirectory',
      description:
        '创建一个新目录。参数：dirPath 为目标目录路径。返回值：对象，包含 success、data、error；支持递归创建目录结构。',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string', description: '目标目录路径。' },
        },
        required: ['dirPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteFile',
      description:
        '删除指定文件。参数：filePath 为要删除的文件路径。返回值：对象，包含 success、data、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '要删除的文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteDirectory',
      description:
        '删除指定目录。参数：dirPath 为要删除的目录路径。返回值：对象，包含 success、data、error；支持递归删除目录及其内容。',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string', description: '要删除的目录路径。' },
        },
        required: ['dirPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rename',
      description:
        '重命名文件或目录。参数：oldPath 为原路径；newPath 为新路径。返回值：对象，包含 success、data、error；如果原路径不存在会在 error 中返回原因。',
      parameters: {
        type: 'object',
        properties: {
          oldPath: { type: 'string', description: '原文件或目录路径。' },
          newPath: { type: 'string', description: '新的文件或目录路径。' },
        },
        required: ['oldPath', 'newPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'copyFile',
      description:
        '复制文件。参数：sourcePath 为源文件路径；destinationPath 为目标文件路径。返回值：对象，包含 success、data、error；如果目标目录不存在会自动创建；如果源文件不存在会在 error 中返回原因。',
      parameters: {
        type: 'object',
        properties: {
          sourcePath: { type: 'string', description: '源文件路径。' },
          destinationPath: { type: 'string', description: '目标文件路径。' },
        },
        required: ['sourcePath', 'destinationPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'moveFile',
      description:
        '移动文件。参数：sourcePath 为源文件路径；destinationPath 为目标文件路径。返回值：对象，包含 success、data、error；如果目标目录不存在会自动创建；如果源文件不存在会在 error 中返回原因。',
      parameters: {
        type: 'object',
        properties: {
          sourcePath: { type: 'string', description: '源文件路径。' },
          destinationPath: { type: 'string', description: '目标文件路径。' },
        },
        required: ['sourcePath', 'destinationPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getFileInfo',
      description:
        '获取指定文件的信息。参数：filePath 为目标文件路径。返回值：对象，包含 success、data（含 path、size、birthtime、mtime、ctime、isFile、isDirectory 等属性）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '目标文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getFileNameList',
      description:
        '获取指定目录下的所有文件名。参数：dirPath 为目标目录路径。返回值：对象，包含 success、data（含 files 数组）、error；如果目录不存在或不是目录会在 error 中返回原因。',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string', description: '目标目录路径。' },
        },
        required: ['dirPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clearDirectory',
      description:
        '清空指定目录的内容。参数：dirPath 为要清空的目录路径。返回值：对象，包含 success、data、error；如果目录不存在或不是目录会在 error 中返回原因。',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string', description: '要清空的目录路径。' },
        },
        required: ['dirPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replaceFileText',
      description:
        '替换文件中的文本。参数：filePath 为目标文件路径；searchValue 为查找文本或正则表达式字符串；replaceValue 为替换内容；isGlobal 控制是否全局替换（仅当 searchValue 为字符串时生效，默认 true）。返回值：对象，包含 success、data、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: '目标文件路径。',
          },
          searchValue: {
            type: 'string',
            description:
              '要查找的文本内容，支持按普通字符串或正则表达式字符串理解。',
          },
          replaceValue: {
            type: 'string',
            description: '用于替换匹配内容的新文本。',
          },
          isGlobal: {
            type: 'boolean',
            description: '是否执行全局替换，默认值为 true。',
          },
        },
        required: ['filePath', 'searchValue', 'replaceValue'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compressToZip',
      description:
        '压缩文件或文件夹为 zip 格式。参数：inputPath 为待压缩的文件或目录路径；outputZipPath 为输出 zip 文件路径。返回值：对象，包含 success、data、error；支持中文、多层目录。',
      parameters: {
        type: 'object',
        properties: {
          inputPath: {
            type: 'string',
            description: '要压缩的文件或文件夹路径。',
          },
          outputZipPath: {
            type: 'string',
            description: '生成的 zip 文件输出路径。',
          },
        },
        required: ['inputPath', 'outputZipPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extractZip',
      description:
        '解压 zip 文件。参数：zipFilePath 为待解压的 zip 文件路径；extractToPath 为解压目标目录。返回值：对象，包含 success、data、error；支持密码、中文不乱码。',
      parameters: {
        type: 'object',
        properties: {
          zipFilePath: {
            type: 'string',
            description: '待解压的 zip 文件路径。',
          },
          extractToPath: {
            type: 'string',
            description: '解压后的目标目录路径。',
          },
        },
        required: ['zipFilePath', 'extractToPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extractFileContent',
      description:
        '根据给定提示词从文件列表中提取相关内容。参数：filePrompt 为提取主题；filePathList 为待提取的文件路径数组。返回值：对象，包含 success、data（含 filePath、fileName、successContent）或 error。',
      parameters: {
        type: 'object',
        properties: {
          filePrompt: {
            type: 'string',
            description: '需要提取的主题或关键描述。',
          },
          filePathList: {
            type: 'array',
            items: { type: 'string' },
            description: '待提取内容的文件路径数组。',
          },
        },
        required: ['filePrompt', 'filePathList'],
      },
    },
  },
]

const functions = {
  createFile,
  modifyFile,
  readFile,
  replaceFileText,
  appendToFile,
  fileExists,
  createDirectory,
  deleteFile,
  deleteDirectory,
  rename,
  moveFile,
  getFileInfo,
  getFileNameList,
  clearDirectory,
  compressToZip,
  extractZip,
  copyFile,
  extractFileContent,
}

const FileTool = {
  name: 'FileTool',
  description:
    '提供文件和目录的创建、读取、修改、删除、移动、重命名、信息获取等文件系统操作功能',
  descriptions,
  functions,
  isSystem: true,
}

module.exports = FileTool
