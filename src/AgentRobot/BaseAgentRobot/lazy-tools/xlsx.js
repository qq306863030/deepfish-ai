/**
 * @Author: Roman 306863030@qq.com
 * @Description: Excel/XLSX 文档处理工具集（xlsx / SheetJS）
 */
const path = require('path')
const fs = require('fs-extra')
const XLSX = require('xlsx')

// ─── 统一返回结构 ─────────────────────────────────────────────────────────────

function ok(data = null) {
  return { success: true, data }
}

function fail(error, data = null) {
  return { success: false, error: error?.message || String(error), data }
}

function resolvePath(filePath) {
  return path.resolve(process.cwd(), filePath)
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function xlsxReadme() {
  return `【XLSX 工具使用说明】
1. 优先使用本工具内置函数完成任务（读取、写入、搜索、合并、CSV 互转等）。
2. 如果内置函数无法满足需求（如复杂格式保真、特殊公式处理、跨格式高级转换），再尝试使用 LibreOffice 命令行。
3. 在调用 LibreOffice 前，先检测系统是否已安装 LibreOffice：
   - 已安装：直接使用 LibreOffice 命令行继续处理。
   - 未安装：询问用户是否允许安装。
4. 若用户同意安装：引导完成安装后继续执行原任务。
5. 若用户拒绝安装：明确告知当前能力限制，并终止该操作。

建议：
- 简单与结构化数据处理优先使用内置函数，速度更快且依赖更少。
- 仅在确实需要高保真格式转换时才启用 LibreOffice 路径。`
}

/**
 * 获取 XLSX 文件基本信息（工作表名称、行列数等）
 */
async function getXlsxInfo(filePath) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const workbook = XLSX.readFile(fullPath)
    const stat = fs.statSync(fullPath)
    const sheets = workbook.SheetNames.map((name) => {
      const ws = workbook.Sheets[name]
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
      return {
        name,
        rows: range.e.r - range.s.r + 1,
        cols: range.e.c - range.s.c + 1,
      }
    })
    return ok({
      filePath: fullPath,
      size: stat.size,
      mtime: stat.mtime,
      sheetCount: workbook.SheetNames.length,
      sheets,
    })
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 获取所有工作表名称列表
 */
async function getSheetNames(filePath) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const workbook = XLSX.readFile(fullPath)
    return ok({ filePath: fullPath, sheetNames: workbook.SheetNames })
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 读取指定工作表为 JSON 数组（第一行作为 header）
 */
async function readSheet(filePath, sheetName) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const workbook = XLSX.readFile(fullPath)
    const name = sheetName || workbook.SheetNames[0]
    if (!workbook.Sheets[name]) return fail(`Sheet "${name}" not found`, { filePath: fullPath, sheetName: name })
    const ws = workbook.Sheets[name]
    const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
    return ok({
      filePath: fullPath,
      sheetName: name,
      rowCount: data.length,
      colCount: range.e.c - range.s.c + 1,
      data,
    })
  } catch (error) {
    return fail(error, { filePath, sheetName })
  }
}

/**
 * 读取指定工作表为二维数组（不解析 header）
 */
async function readSheetRaw(filePath, sheetName) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const workbook = XLSX.readFile(fullPath)
    const name = sheetName || workbook.SheetNames[0]
    if (!workbook.Sheets[name]) return fail(`Sheet "${name}" not found`, { filePath: fullPath, sheetName: name })
    const ws = workbook.Sheets[name]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    return ok({ filePath: fullPath, sheetName: name, rowCount: data.length, data })
  } catch (error) {
    return fail(error, { filePath, sheetName })
  }
}

/**
 * 读取全部工作表，返回 { sheetName: jsonArray } 对象
 */
async function readAllSheets(filePath) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const workbook = XLSX.readFile(fullPath)
    const result = {}
    for (const name of workbook.SheetNames) {
      result[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '' })
    }
    return ok({ filePath: fullPath, sheetCount: workbook.SheetNames.length, sheets: result })
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 将 JSON 数据写入新 XLSX 文件（可指定多个 sheet）
 * sheetsData 格式：[ { name, data: [{},...] } ] 或 [ { name, data: [[...]], isRaw: true } ]
 */
async function writeXlsx(outputPath, sheetsData = [], options = {}) {
  try {
    const fullOutput = resolvePath(outputPath)
    fs.ensureDirSync(path.dirname(fullOutput))
    const workbook = XLSX.utils.book_new()
    for (const sheetDef of sheetsData) {
      const name = sheetDef.name || 'Sheet1'
      const ws = sheetDef.isRaw
        ? XLSX.utils.aoa_to_sheet(sheetDef.data || [[]])
        : XLSX.utils.json_to_sheet(sheetDef.data || [], { skipHeader: sheetDef.skipHeader })
      XLSX.utils.book_append_sheet(workbook, ws, name)
    }
    XLSX.writeFile(workbook, fullOutput, { bookType: options.bookType || 'xlsx' })
    return ok({ outputPath: fullOutput, sheetCount: sheetsData.length })
  } catch (error) {
    return fail(error, { outputPath })
  }
}

/**
 * 向已有 XLSX 的指定 sheet 末尾追加行数据
 */
async function appendRows(filePath, rows = [], sheetName) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const workbook = XLSX.readFile(fullPath)
    const name = sheetName || workbook.SheetNames[0]
    if (!workbook.Sheets[name]) return fail(`Sheet "${name}" not found`, { filePath: fullPath, sheetName: name })
    const ws = workbook.Sheets[name]
    XLSX.utils.sheet_add_json(ws, rows, { skipHeader: true, origin: -1 })
    XLSX.writeFile(workbook, fullPath)
    return ok({ filePath: fullPath, sheetName: name, appendedRows: rows.length })
  } catch (error) {
    return fail(error, { filePath, sheetName })
  }
}

/**
 * 在 XLSX 的指定 sheet 中搜索关键词，返回匹配的单元格位置
 */
async function searchXlsx(filePath, keyword, sheetName) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const workbook = XLSX.readFile(fullPath)
    const targetSheets = sheetName ? [sheetName] : workbook.SheetNames
    const matches = []
    for (const name of targetSheets) {
      const ws = workbook.Sheets[name]
      if (!ws) continue
      for (const cellAddr of Object.keys(ws)) {
        if (cellAddr.startsWith('!')) continue
        const cell = ws[cellAddr]
        const val = String(cell.v ?? '')
        if (val.includes(keyword)) {
          matches.push({ sheet: name, cell: cellAddr, value: val })
        }
      }
    }
    return ok({ filePath: fullPath, keyword, matchCount: matches.length, matches })
  } catch (error) {
    return fail(error, { filePath, keyword, sheetName })
  }
}

/**
 * 删除 XLSX 中的指定工作表
 */
async function deleteSheet(filePath, sheetName) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const workbook = XLSX.readFile(fullPath)
    if (!workbook.Sheets[sheetName]) return fail(`Sheet "${sheetName}" not found`, { filePath: fullPath, sheetName })
    const idx = workbook.SheetNames.indexOf(sheetName)
    workbook.SheetNames.splice(idx, 1)
    delete workbook.Sheets[sheetName]
    XLSX.writeFile(workbook, fullPath)
    return ok({ filePath: fullPath, deletedSheet: sheetName, remainingSheets: workbook.SheetNames })
  } catch (error) {
    return fail(error, { filePath, sheetName })
  }
}

/**
 * 重命名工作表
 */
async function renameSheet(filePath, oldName, newName) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const workbook = XLSX.readFile(fullPath)
    if (!workbook.Sheets[oldName]) return fail(`Sheet "${oldName}" not found`, { filePath: fullPath, oldName })
    const idx = workbook.SheetNames.indexOf(oldName)
    workbook.SheetNames[idx] = newName
    workbook.Sheets[newName] = workbook.Sheets[oldName]
    delete workbook.Sheets[oldName]
    XLSX.writeFile(workbook, fullPath)
    return ok({ filePath: fullPath, oldName, newName })
  } catch (error) {
    return fail(error, { filePath, oldName, newName })
  }
}

/**
 * 合并多个 XLSX 文件为一个（各文件的 sheet 合并到新文件中）
 */
async function mergeXlsx(inputPaths, outputPath) {
  try {
    const fullOutput = resolvePath(outputPath)
    fs.ensureDirSync(path.dirname(fullOutput))
    const newWorkbook = XLSX.utils.book_new()
    const usedNames = new Set()
    for (const inputPath of inputPaths) {
      const fullInput = resolvePath(inputPath)
      if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
      const wb = XLSX.readFile(fullInput)
      for (let name of wb.SheetNames) {
        let uniqueName = name
        let count = 1
        while (usedNames.has(uniqueName)) uniqueName = `${name}_${count++}`
        usedNames.add(uniqueName)
        XLSX.utils.book_append_sheet(newWorkbook, wb.Sheets[name], uniqueName)
      }
    }
    XLSX.writeFile(newWorkbook, fullOutput)
    return ok({ outputPath: fullOutput, sheetCount: newWorkbook.SheetNames.length, sheets: newWorkbook.SheetNames })
  } catch (error) {
    return fail(error, { outputPath })
  }
}

/**
 * 将 XLSX 导出为 CSV 文件（指定 sheet）
 */
async function xlsxToCsv(filePath, outputPath, sheetName) {
  try {
    const fullPath = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    fs.ensureDirSync(path.dirname(fullOutput))
    const workbook = XLSX.readFile(fullPath)
    const name = sheetName || workbook.SheetNames[0]
    if (!workbook.Sheets[name]) return fail(`Sheet "${name}" not found`, { filePath: fullPath, sheetName: name })
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name])
    fs.writeFileSync(fullOutput, csv, 'utf8')
    return ok({ filePath: fullPath, outputPath: fullOutput, sheetName: name })
  } catch (error) {
    return fail(error, { filePath, outputPath, sheetName })
  }
}

/**
 * 将 CSV 文件导入为 XLSX
 */
async function csvToXlsx(inputPath, outputPath, sheetName) {
  try {
    const fullInput = resolvePath(inputPath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    fs.ensureDirSync(path.dirname(fullOutput))
    const csv = fs.readFileSync(fullInput, 'utf8')
    const workbook = XLSX.read(csv, { type: 'string' })
    const ws = workbook.Sheets[workbook.SheetNames[0]]
    const newWb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(newWb, ws, sheetName || 'Sheet1')
    XLSX.writeFile(newWb, fullOutput)
    return ok({ inputPath: fullInput, outputPath: fullOutput })
  } catch (error) {
    return fail(error, { inputPath, outputPath })
  }
}

/**
 * 统计 XLSX 指定 sheet 的行列数及数据摘要
 */
async function getSheetStats(filePath, sheetName) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const workbook = XLSX.readFile(fullPath)
    const name = sheetName || workbook.SheetNames[0]
    if (!workbook.Sheets[name]) return fail(`Sheet "${name}" not found`, { filePath: fullPath, sheetName: name })
    const ws = workbook.Sheets[name]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
    const headers = data[0] || []
    const dataRows = data.slice(1)
    const nonEmpty = dataRows.filter((row) => row.some((c) => c !== '' && c !== null && c !== undefined))
    return ok({
      filePath: fullPath,
      sheetName: name,
      totalRows: range.e.r - range.s.r + 1,
      totalCols: range.e.c - range.s.c + 1,
      dataRows: nonEmpty.length,
      headers,
    })
  } catch (error) {
    return fail(error, { filePath, sheetName })
  }
}

// ─── 工具描述 ─────────────────────────────────────────────────────────────────

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'xlsxReadme',
      description: '获取 XLSX 工具集的使用说明, 调用函数前必须先查看本说明。',
      parameters: {},
    }
  },
  {
    type: 'function',
    function: {
      name: 'getXlsxInfo',
      description: '获取 XLSX 文件基本信息（工作表名列表、各 sheet 行列数、文件大小等）。参数：filePath 为 .xlsx 文件路径。返回值：对象，包含 success、data（含 sheetCount、sheets 数组、size、mtime）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'XLSX 文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSheetNames',
      description: '获取 XLSX 文件中所有工作表的名称列表。参数：filePath 为 .xlsx 文件路径。返回值：对象，包含 success、data（含 sheetNames 数组）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'XLSX 文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'readSheet',
      description: '读取 XLSX 指定工作表数据，以第一行为 header，返回 JSON 对象数组。参数：filePath 为路径；sheetName 为工作表名（省略则读第一个）。返回值：对象，包含 success、data（含 sheetName、rowCount、colCount、data 数组）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'XLSX 文件路径。' },
          sheetName: { type: 'string', description: '工作表名，省略则读取第一个 sheet。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'readSheetRaw',
      description: '读取 XLSX 指定工作表为二维数组（不解析 header）。参数：filePath 为路径；sheetName 为工作表名。返回值：对象，包含 success、data（含 sheetName、rowCount、data 二维数组）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'XLSX 文件路径。' },
          sheetName: { type: 'string', description: '工作表名，省略则读取第一个。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'readAllSheets',
      description: '读取 XLSX 文件的所有工作表，返回 { sheetName: jsonArray } 对象。参数：filePath 为路径。返回值：对象，包含 success、data（含 sheetCount、sheets 对象）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'XLSX 文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'writeXlsx',
      description: '将数据写入新的 XLSX 文件，支持多 sheet。参数：outputPath 为输出路径；sheetsData 为数组，每项含 name（sheet名）、data（JSON数组 或二维数组）、isRaw（是否为二维数组，默认 false）；options 可选（{ bookType: xlsx/csv/ods }）。返回值：对象，包含 success、data（含 outputPath、sheetCount）、error。',
      parameters: {
        type: 'object',
        properties: {
          outputPath: { type: 'string', description: '输出 .xlsx 文件路径。' },
          sheetsData: {
            type: 'array',
            description: 'sheet 数据数组，每项：{ name, data, isRaw }。',
            items: { type: 'object' },
          },
          options: { type: 'object', description: '可选：{ bookType }。' },
        },
        required: ['outputPath', 'sheetsData'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'appendRows',
      description: '向 XLSX 指定工作表末尾追加行数据。参数：filePath 为路径；rows 为 JSON 对象数组；sheetName 为工作表名（省略则用第一个）。返回值：对象，包含 success、data（含 sheetName、appendedRows）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'XLSX 文件路径。' },
          rows: { type: 'array', description: '要追加的行数据（JSON 对象数组）。', items: { type: 'object' } },
          sheetName: { type: 'string', description: '目标工作表名。' },
        },
        required: ['filePath', 'rows'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchXlsx',
      description: '在 XLSX 指定（或全部）sheet 中搜索关键词，返回匹配单元格位置。参数：filePath 为路径；keyword 为关键词；sheetName 为工作表名（省略则搜索全部）。返回值：对象，包含 success、data（含 keyword、matchCount、matches 数组）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'XLSX 文件路径。' },
          keyword: { type: 'string', description: '搜索关键词。' },
          sheetName: { type: 'string', description: '要搜索的工作表名，省略则搜索全部。' },
        },
        required: ['filePath', 'keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteSheet',
      description: '删除 XLSX 中的指定工作表。参数：filePath 为路径；sheetName 为要删除的工作表名。返回值：对象，包含 success、data（含 deletedSheet、remainingSheets）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'XLSX 文件路径。' },
          sheetName: { type: 'string', description: '要删除的工作表名。' },
        },
        required: ['filePath', 'sheetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'renameSheet',
      description: '重命名 XLSX 中的工作表。参数：filePath 为路径；oldName 为原工作表名；newName 为新工作表名。返回值：对象，包含 success、data（含 oldName、newName）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'XLSX 文件路径。' },
          oldName: { type: 'string', description: '原工作表名。' },
          newName: { type: 'string', description: '新工作表名。' },
        },
        required: ['filePath', 'oldName', 'newName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mergeXlsx',
      description: '将多个 XLSX 文件合并为一个（各文件的所有 sheet 合并到新文件）。参数：inputPaths 为源文件路径数组；outputPath 为输出路径。返回值：对象，包含 success、data（含 outputPath、sheetCount、sheets）、error。',
      parameters: {
        type: 'object',
        properties: {
          inputPaths: { type: 'array', items: { type: 'string' }, description: '要合并的 XLSX 文件路径数组。' },
          outputPath: { type: 'string', description: '合并后输出的 XLSX 文件路径。' },
        },
        required: ['inputPaths', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'xlsxToCsv',
      description: '将 XLSX 工作表导出为 CSV 文件。参数：filePath 为 .xlsx 路径；outputPath 为 .csv 输出路径；sheetName 为工作表名（省略则用第一个）。返回值：对象，包含 success、data（含 outputPath、sheetName）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'XLSX 文件路径。' },
          outputPath: { type: 'string', description: '输出 CSV 文件路径。' },
          sheetName: { type: 'string', description: '要导出的工作表名。' },
        },
        required: ['filePath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'csvToXlsx',
      description: '将 CSV 文件转换为 XLSX 文件。参数：inputPath 为 .csv 路径；outputPath 为 .xlsx 输出路径；sheetName 为工作表名（默认 Sheet1）。返回值：对象，包含 success、data（含 inputPath、outputPath）、error。',
      parameters: {
        type: 'object',
        properties: {
          inputPath: { type: 'string', description: 'CSV 文件路径。' },
          outputPath: { type: 'string', description: '输出 XLSX 文件路径。' },
          sheetName: { type: 'string', description: '工作表名，默认 Sheet1。' },
        },
        required: ['inputPath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSheetStats',
      description: '统计 XLSX 指定工作表的行列数量及 header 信息。参数：filePath 为路径；sheetName 为工作表名（省略则用第一个）。返回值：对象，包含 success、data（含 totalRows、totalCols、dataRows、headers）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'XLSX 文件路径。' },
          sheetName: { type: 'string', description: '工作表名。' },
        },
        required: ['filePath'],
      },
    },
  },
]

// ─── 导出 ──────────────────────────────────────────────────────────────────────

const functions = {
  xlsxReadme,
  getXlsxInfo,
  getSheetNames,
  readSheet,
  readSheetRaw,
  readAllSheets,
  writeXlsx,
  appendRows,
  searchXlsx,
  deleteSheet,
  renameSheet,
  mergeXlsx,
  xlsxToCsv,
  csvToXlsx,
  getSheetStats,
}

const XlsxTool = {
  name: 'XlsxTool',
  description: '提供 Excel/XLSX 文件的信息读取、单Sheet/全Sheet读取、数据写入、追加行、搜索、删除/重命名Sheet、合并文件、CSV互转等全面处理能力',
  platform: 'all',
  descriptions,
  functions,
  isSystem: true
}

module.exports = XlsxTool
