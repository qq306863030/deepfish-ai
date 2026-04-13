/**
 * @Author: Roman 306863030@qq.com
 * @Description: Word 文档处理工具集（mammoth / docx / pizzip / docxtemplater）
 */
const path = require('path')
const fs = require('fs-extra')
const mammoth = require('mammoth')
const docx = require('docx')
const PizZip = require('pizzip')
const Docxtemplater = require('docxtemplater')

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

// ─── 内部辅助：将 sections 描述转换为 docx children ──────────────────────────
/**
 * sections 数组每项结构：
 * { type: 'paragraph'|'heading'|'table'|'list'|'numberedList'|'pageBreak'|'horizontalRule',
 *   text, level, rows, items, runs, bold, italic, alignment, color, fontSize }
 * runs 数组每项：{ text, bold, italic, underline, color, fontSize }
 */
function buildChildren(sections, docxLib) {
  const {
    Paragraph, TextRun, HeadingLevel,
    Table, TableRow, TableCell, WidthType,
    AlignmentType, ExternalHyperlink,
  } = docxLib

  const HEADING_MAP = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  }

  function makeRun(r) {
    return new TextRun({
      text: String(r.text ?? ''),
      bold: r.bold || false,
      italics: r.italic || false,
      underline: r.underline ? {} : undefined,
      color: r.color || undefined,
      size: r.fontSize ? r.fontSize * 2 : undefined,
    })
  }

  const alignment = (a) =>
    a ? AlignmentType[a.toUpperCase()] || AlignmentType.LEFT : undefined

  const children = []
  for (const sec of (sections || [])) {
    switch (sec.type) {
      case 'heading':
        children.push(
          new Paragraph({
            text: String(sec.text || ''),
            heading: HEADING_MAP[sec.level || 1] || HeadingLevel.HEADING_1,
            alignment: alignment(sec.alignment),
          }),
        )
        break

      case 'paragraph': {
        const runs = Array.isArray(sec.runs)
          ? sec.runs.map(makeRun)
          : [new TextRun({
              text: String(sec.text || ''),
              bold: sec.bold || false,
              italics: sec.italic || false,
              color: sec.color || undefined,
              size: sec.fontSize ? sec.fontSize * 2 : undefined,
            })]
        children.push(new Paragraph({ children: runs, alignment: alignment(sec.alignment) }))
        break
      }

      case 'table': {
        const colCount = Math.max(...(sec.rows || [[]]).map(r => r.length), 1)
        const colWidth = Math.floor(9000 / colCount)
        const rows = (sec.rows || []).map((row) =>
          new TableRow({
            children: (row || []).map((cell) =>
              new TableCell({
                children: [new Paragraph({ text: String(cell ?? '') })],
                width: { size: colWidth, type: WidthType.DXA },
              }),
            ),
          }),
        )
        children.push(new Table({ rows, width: { size: 9000, type: WidthType.DXA } }))
        break
      }

      case 'list':
        for (const item of (sec.items || [])) {
          children.push(new Paragraph({ text: String(item), bullet: { level: sec.level || 0 } }))
        }
        break

      case 'numberedList': {
        const numRef = sec.numReference || 'default-numbering'
        for (const item of (sec.items || [])) {
          children.push(
            new Paragraph({
              text: String(item),
              numbering: { reference: numRef, level: 0 },
            }),
          )
        }
        break
      }

      case 'pageBreak':
        children.push(new Paragraph({ pageBreakBefore: true }))
        break

      case 'horizontalRule':
        children.push(
          new Paragraph({
            children: [new TextRun({ text: '', break: 1 })],
            border: { bottom: { color: '999999', space: 1, value: 'single', size: 6 } },
          }),
        )
        break

      default:
        // 未知类型作为普通段落处理
        if (sec.text) {
          children.push(new Paragraph({ text: String(sec.text) }))
        }
    }
  }
  return children
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/**
 * 读取 Word 文档为纯文本
 */
async function readDocxText(filePath) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) {
      return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    }
    const result = await mammoth.extractRawText({ path: fullPath })
    return ok({ filePath: fullPath, text: result.value, messages: result.messages })
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 读取 Word 文档为 HTML
 */
async function readDocxHtml(filePath) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) {
      return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    }
    const result = await mammoth.convertToHtml({ path: fullPath })
    return ok({ filePath: fullPath, html: result.value, messages: result.messages })
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 获取 Word 文档基础信息（字数、行数、文件大小等）
 */
async function getDocxInfo(filePath) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) {
      return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    }
    const result = await mammoth.extractRawText({ path: fullPath })
    const text = result.value || ''
    const stats = fs.statSync(fullPath)
    return ok({
      filePath: fullPath,
      size: stats.size,
      mtime: stats.mtime,
      wordCount: text.trim().split(/\s+/).filter(Boolean).length,
      charCount: text.length,
      lineCount: text.split('\n').length,
      paragraphCount: text.split(/\n\n+/).filter(Boolean).length,
    })
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 搜索 Word 文档中是否包含指定文本，返回匹配行列表
 */
async function searchDocxText(filePath, keyword) {
  try {
    const readResult = await readDocxText(filePath)
    if (!readResult.success) return readResult
    const lines = readResult.data.text.split('\n')
    const matches = lines
      .map((line, idx) => ({ line: idx + 1, text: line }))
      .filter(({ text }) => text.includes(keyword))
    return ok({
      filePath: resolvePath(filePath),
      keyword,
      matchCount: matches.length,
      matches,
    })
  } catch (error) {
    return fail(error, { filePath, keyword })
  }
}

/**
 * 将 Word 文档导出为纯文本文件
 */
async function docxToText(inputPath, outputPath) {
  try {
    const readResult = await readDocxText(inputPath)
    if (!readResult.success) return readResult
    const fullOutputPath = resolvePath(outputPath)
    fs.ensureDirSync(path.dirname(fullOutputPath))
    fs.writeFileSync(fullOutputPath, readResult.data.text, 'utf8')
    return ok({ inputPath: resolvePath(inputPath), outputPath: fullOutputPath })
  } catch (error) {
    return fail(error, { inputPath, outputPath })
  }
}

/**
 * 将 Word 文档导出为 HTML 文件
 */
async function docxToHtml(inputPath, outputPath) {
  try {
    const readResult = await readDocxHtml(inputPath)
    if (!readResult.success) return readResult
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${readResult.data.html}</body></html>`
    const fullOutputPath = resolvePath(outputPath)
    fs.ensureDirSync(path.dirname(fullOutputPath))
    fs.writeFileSync(fullOutputPath, html, 'utf8')
    return ok({ inputPath: resolvePath(inputPath), outputPath: fullOutputPath })
  } catch (error) {
    return fail(error, { inputPath, outputPath })
  }
}

/**
 * 创建 Word 文档（支持段落、标题、表格、列表等）
 */
async function createDocx(filePath, sections = []) {
  try {
    const { Document, Packer } = docx
    const fullPath = resolvePath(filePath)
    fs.ensureDirSync(path.dirname(fullPath))
    const children = buildChildren(sections, docx)
    const doc = new Document({ sections: [{ properties: {}, children }] })
    const buffer = await Packer.toBuffer(doc)
    fs.writeFileSync(fullPath, buffer)
    return ok({ filePath: fullPath, sectionCount: sections.length })
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 向已有 Word 文档末尾追加内容（以原文本段落 + 新 sections 重建文档）
 */
async function appendToDocx(filePath, sections = []) {
  try {
    const readResult = await readDocxText(filePath)
    if (!readResult.success) return readResult
    const existingSections = readResult.data.text
      .split('\n')
      .filter(Boolean)
      .map((line) => ({ type: 'paragraph', text: line }))
    return await createDocx(filePath, [...existingSections, ...sections])
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 替换 Word 文档中的文本内容（通过直接修改 XML 实现）
 */
async function replaceDocxText(filePath, searchText, replaceText) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) {
      return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    }
    const content = fs.readFileSync(fullPath, 'binary')
    const zip = new PizZip(content)
    const targets = ['word/document.xml', 'word/header1.xml', 'word/footer1.xml']
    let replaceCount = 0
    for (const target of targets) {
      const file = zip.file(target)
      if (!file) continue
      let xml = file.asText()
      const before = xml.split(searchText).length - 1
      xml = xml.split(searchText).join(replaceText)
      replaceCount += before
      zip.file(target, xml)
    }
    const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
    fs.writeFileSync(fullPath, buf)
    return ok({ filePath: fullPath, searchText, replaceText, replaceCount })
  } catch (error) {
    return fail(error, { filePath, searchText, replaceText })
  }
}

/**
 * 用数据填充 Word 模板（模板标签格式：{变量名}）
 */
async function fillDocxTemplate(templatePath, outputPath, data) {
  try {
    const fullTemplatePath = resolvePath(templatePath)
    const fullOutputPath = resolvePath(outputPath)
    if (!fs.existsSync(fullTemplatePath)) {
      return fail(`Template file does not exist: ${fullTemplatePath}`, { templatePath: fullTemplatePath })
    }
    const content = fs.readFileSync(fullTemplatePath, 'binary')
    const zip = new PizZip(content)
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
    doc.render(data || {})
    const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' })
    fs.ensureDirSync(path.dirname(fullOutputPath))
    fs.writeFileSync(fullOutputPath, buf)
    return ok({ templatePath: fullTemplatePath, outputPath: fullOutputPath })
  } catch (error) {
    return fail(error, { templatePath, outputPath })
  }
}

/**
 * 合并多个 Word 文档为一个（以分页符分隔各文档内容）
 */
async function mergeDocx(inputPaths, outputPath) {
  try {
    const allSections = []
    for (let i = 0; i < inputPaths.length; i++) {
      const readResult = await readDocxText(inputPaths[i])
      if (!readResult.success) return readResult
      const paras = readResult.data.text
        .split('\n')
        .filter(Boolean)
        .map((line) => ({ type: 'paragraph', text: line }))
      allSections.push(...paras)
      if (i < inputPaths.length - 1) {
        allSections.push({ type: 'pageBreak' })
      }
    }
    return await createDocx(outputPath, allSections)
  } catch (error) {
    return fail(error, { outputPath })
  }
}

/**
 * 提取 Word 文档中的所有超链接
 */
async function extractDocxLinks(filePath) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) {
      return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    }
    const content = fs.readFileSync(fullPath, 'binary')
    const zip = new PizZip(content)
    const relsFile = zip.file('word/_rels/document.xml.rels')
    if (!relsFile) return ok({ filePath: fullPath, links: [] })
    const relsXml = relsFile.asText()
    const linkRegex = /Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/hyperlink"\s+Target="([^"]+)"/g
    const links = []
    let m
    while ((m = linkRegex.exec(relsXml)) !== null) {
      links.push(m[1])
    }
    return ok({ filePath: fullPath, links })
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 统计 Word 文档中各段落字数
 */
async function getDocxParagraphStats(filePath) {
  try {
    const readResult = await readDocxText(filePath)
    if (!readResult.success) return readResult
    const paragraphs = readResult.data.text.split('\n').filter(Boolean)
    const stats = paragraphs.map((para, idx) => ({
      index: idx + 1,
      text: para.substring(0, 60) + (para.length > 60 ? '...' : ''),
      wordCount: para.trim().split(/\s+/).filter(Boolean).length,
      charCount: para.length,
    }))
    return ok({
      filePath: resolvePath(filePath),
      paragraphCount: paragraphs.length,
      totalWordCount: stats.reduce((s, p) => s + p.wordCount, 0),
      paragraphs: stats,
    })
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 将 Word 文档的全部内容替换为新的 sections 内容
 */
async function overwriteDocx(filePath, sections = []) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) {
      return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    }
    return await createDocx(filePath, sections)
  } catch (error) {
    return fail(error, { filePath })
  }
}

// ─── 工具描述 ─────────────────────────────────────────────────────────────────

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'readDocxText',
      description:
        '读取 Word 文档（.docx）并提取纯文本内容。参数：filePath 为文档路径。返回值：对象，包含 success、data（含 filePath、text）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '要读取的 .docx 文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'readDocxHtml',
      description:
        '将 Word 文档（.docx）转换为 HTML 字符串，保留格式信息（粗体、斜体、表格等）。参数：filePath 为文档路径。返回值：对象，包含 success、data（含 filePath、html）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '要读取的 .docx 文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getDocxInfo',
      description:
        '获取 Word 文档的基础信息。参数：filePath 为文档路径。返回值：对象，包含 success、data（含 filePath、size、mtime、wordCount、charCount、lineCount、paragraphCount）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '要查询的 .docx 文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchDocxText',
      description:
        '在 Word 文档中搜索指定关键词，返回所有匹配行。参数：filePath 为文档路径；keyword 为搜索关键词。返回值：对象，包含 success、data（含 keyword、matchCount、matches 数组）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '要搜索的 .docx 文件路径。' },
          keyword: { type: 'string', description: '搜索关键词。' },
        },
        required: ['filePath', 'keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docxToText',
      description:
        '将 Word 文档导出为纯文本文件（.txt）。参数：inputPath 为源 .docx 路径；outputPath 为输出 .txt 路径。返回值：对象，包含 success、data（含 inputPath、outputPath）、error。',
      parameters: {
        type: 'object',
        properties: {
          inputPath: { type: 'string', description: '源 .docx 文件路径。' },
          outputPath: { type: 'string', description: '输出 .txt 文件路径。' },
        },
        required: ['inputPath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docxToHtml',
      description:
        '将 Word 文档导出为 HTML 文件。参数：inputPath 为源 .docx 路径；outputPath 为输出 .html 路径。返回值：对象，包含 success、data（含 inputPath、outputPath）、error。',
      parameters: {
        type: 'object',
        properties: {
          inputPath: { type: 'string', description: '源 .docx 文件路径。' },
          outputPath: { type: 'string', description: '输出 .html 文件路径。' },
        },
        required: ['inputPath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createDocx',
      description: `创建一个新的 Word 文档（.docx），支持添加多种内容块。
参数：filePath 为输出路径；sections 为内容数组，每项格式如下：
- 段落：{ type:'paragraph', text, bold, italic, alignment, color, fontSize, runs:[{text,bold,italic,underline,color,fontSize}] }
- 标题：{ type:'heading', text, level(1-6), alignment }
- 表格：{ type:'table', rows:[[cell,...]] }
- 无序列表：{ type:'list', items:[...], level(0-8) }
- 有序列表：{ type:'numberedList', items:[...] }
- 分页符：{ type:'pageBreak' }
- 分隔线：{ type:'horizontalRule' }
返回值：对象，包含 success、data（含 filePath、sectionCount）、error。`,
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '输出 .docx 文件路径。' },
          sections: {
            type: 'array',
            description: '内容块数组，支持 paragraph/heading/table/list/numberedList/pageBreak/horizontalRule 类型。',
            items: { type: 'object' },
          },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'appendToDocx',
      description:
        '向已有 Word 文档末尾追加新内容块。参数：filePath 为目标 .docx 路径；sections 为要追加的内容块数组（格式同 createDocx）。返回值：对象，包含 success、data（含 filePath）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '目标 .docx 文件路径。' },
          sections: { type: 'array', description: '要追加的内容块数组。', items: { type: 'object' } },
        },
        required: ['filePath', 'sections'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'overwriteDocx',
      description:
        '用新内容块完全替换已有 Word 文档的内容。参数：filePath 为目标 .docx 路径；sections 为新内容块数组（格式同 createDocx）。返回值：对象，包含 success、data（含 filePath）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '目标 .docx 文件路径。' },
          sections: { type: 'array', description: '新内容块数组。', items: { type: 'object' } },
        },
        required: ['filePath', 'sections'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replaceDocxText',
      description:
        '在 Word 文档中进行全局文本替换（包括正文、页眉、页脚）。参数：filePath 为目标 .docx 路径；searchText 为要查找的文本；replaceText 为替换后的文本。返回值：对象，包含 success、data（含 filePath、replaceCount）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '目标 .docx 文件路径。' },
          searchText: { type: 'string', description: '要查找的文本。' },
          replaceText: { type: 'string', description: '替换后的文本。' },
        },
        required: ['filePath', 'searchText', 'replaceText'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fillDocxTemplate',
      description: `用数据填充 Word 模板文档，生成新文档。模板中使用 {变量名} 作为占位符。
参数：templatePath 为模板 .docx 路径；outputPath 为输出路径；data 为键值对象（如 { name:'张三', date:'2026-01-01' }）。
返回值：对象，包含 success、data（含 templatePath、outputPath）、error。`,
      parameters: {
        type: 'object',
        properties: {
          templatePath: { type: 'string', description: '模板 .docx 文件路径。' },
          outputPath: { type: 'string', description: '输出 .docx 文件路径。' },
          data: { type: 'object', description: '模板变量键值对，如 { title: "标题" }。' },
        },
        required: ['templatePath', 'outputPath', 'data'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mergeDocx',
      description:
        '将多个 Word 文档合并为一个，各文档之间以分页符分隔。参数：inputPaths 为源文件路径数组；outputPath 为输出路径。返回值：对象，包含 success、data（含 outputPath）、error。',
      parameters: {
        type: 'object',
        properties: {
          inputPaths: { type: 'array', items: { type: 'string' }, description: '要合并的 .docx 文件路径数组。' },
          outputPath: { type: 'string', description: '合并后输出的 .docx 文件路径。' },
        },
        required: ['inputPaths', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extractDocxLinks',
      description:
        '提取 Word 文档中所有的超链接 URL。参数：filePath 为 .docx 文件路径。返回值：对象，包含 success、data（含 filePath、links 数组）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '要提取链接的 .docx 文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getDocxParagraphStats',
      description:
        '统计 Word 文档各段落的字数与字符数。参数：filePath 为 .docx 文件路径。返回值：对象，包含 success、data（含 paragraphCount、totalWordCount、paragraphs 数组）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '要统计的 .docx 文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
]

// ─── 导出 ──────────────────────────────────────────────────────────────────────

const functions = {
  readDocxText,
  readDocxHtml,
  getDocxInfo,
  searchDocxText,
  docxToText,
  docxToHtml,
  createDocx,
  appendToDocx,
  overwriteDocx,
  replaceDocxText,
  fillDocxTemplate,
  mergeDocx,
  extractDocxLinks,
  getDocxParagraphStats,
}

const DocxTool = {
  name: 'DocxTool',
  description: '提供 Word 文档（.docx）的创建、读取、搜索、替换、模板填充、格式转换、合并等全面处理能力',
  platform: 'all',
  descriptions,
  functions,
}

module.exports = DocxTool
