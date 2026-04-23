/**
 * @Author: Roman 306863030@qq.com
 * @Description: PowerPoint 文档处理工具集（pptxgenjs）
 */
const path = require('path')
const fs = require('fs-extra')
const PptxGenJS = require('pptxgenjs')
const AdmZip = require('adm-zip')

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

// ─── 内部辅助 ─────────────────────────────────────────────────────────────────

/**
 * 从 PPTX ZIP 中提取所有幻灯片 XML 内的纯文本
 */
function extractTextFromPptx(fullPath) {
  const zip = new AdmZip(fullPath)
  const entries = zip.getEntries()
  const slideEntries = entries
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => {
      const numA = parseInt(a.entryName.match(/\d+/)[0])
      const numB = parseInt(b.entryName.match(/\d+/)[0])
      return numA - numB
    })
  const slides = []
  for (const entry of slideEntries) {
    const xml = entry.getData().toString('utf8')
    const texts = []
    const regex = /<a:t>([\s\S]*?)<\/a:t>/g
    let m
    while ((m = regex.exec(xml)) !== null) {
      const t = m[1].trim()
      if (t) texts.push(t)
    }
    slides.push(texts.join(' '))
  }
  return slides
}

/**
 * 解析颜色：支持 hex 字符串（不含 #）或 { r, g, b } 对象
 */
function parseColor(color, defaultColor = '000000') {
  if (!color) return defaultColor
  if (typeof color === 'string') return color.replace('#', '')
  if (typeof color === 'object' && color.r !== undefined) {
    return (
      color.r.toString(16).padStart(2, '0') +
      color.g.toString(16).padStart(2, '0') +
      color.b.toString(16).padStart(2, '0')
    ).toUpperCase()
  }
  return defaultColor
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/**
 * 获取 PPTX 文件基本信息（幻灯片数、文件大小等）
 */
async function getPptxInfo(filePath) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const zip = new AdmZip(fullPath)
    const slideCount = zip.getEntries().filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName)).length
    const stat = fs.statSync(fullPath)
    // 读取 core.xml 获取元信息
    const coreEntry = zip.getEntry('docProps/core.xml')
    let title = '', creator = '', lastModifiedBy = '', created = '', modified = ''
    if (coreEntry) {
      const coreXml = coreEntry.getData().toString('utf8')
      const match = (tag) => { const m = coreXml.match(new RegExp(`<[^>]*:?${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${tag}>`)); return m ? m[1] : '' }
      title = match('title')
      creator = match('creator')
      lastModifiedBy = match('lastModifiedBy')
      created = match('created')
      modified = match('modified')
    }
    return ok({ filePath: fullPath, slideCount, size: stat.size, mtime: stat.mtime, title, creator, lastModifiedBy, created, modified })
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 提取 PPTX 中所有幻灯片的纯文本（按页返回数组）
 */
async function readPptxText(filePath) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const slides = extractTextFromPptx(fullPath)
    const allText = slides.join('\n')
    return ok({
      filePath: fullPath,
      slideCount: slides.length,
      slides,
      text: allText,
      wordCount: allText.trim().split(/\s+/).filter(Boolean).length,
    })
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 在 PPTX 中搜索关键词，返回匹配的幻灯片页码与摘要
 */
async function searchPptxText(filePath, keyword) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const slides = extractTextFromPptx(fullPath)
    const matches = slides
      .map((text, idx) => ({ slide: idx + 1, text }))
      .filter(({ text }) => text.includes(keyword))
    return ok({ filePath: fullPath, keyword, matchCount: matches.length, matches })
  } catch (error) {
    return fail(error, { filePath, keyword })
  }
}

/**
 * 创建新的 PPTX 演示文稿
 * slides 数组每项：{ title, content, notes, layout, background, items[] }
 * items 每项：{ type:'text'|'image'|'table'|'shape', ... }
 */
async function createPptx(outputPath, slides = [], options = {}) {
  try {
    const fullOutput = resolvePath(outputPath)
    fs.ensureDirSync(path.dirname(fullOutput))
    const pptx = new PptxGenJS()

    // 设置全局属性
    if (options.title) pptx.title = options.title
    if (options.subject) pptx.subject = options.subject
    if (options.author) pptx.author = options.author
    if (options.company) pptx.company = options.company
    pptx.layout = options.layout || 'LAYOUT_16x9'

    for (const slideDef of slides) {
      const slide = pptx.addSlide({ sectionTitle: slideDef.sectionTitle })

      // 背景颜色
      if (slideDef.background) {
        slide.background = { color: parseColor(slideDef.background) }
      }

      // 标题
      if (slideDef.title !== undefined) {
        slide.addText(String(slideDef.title), {
          x: 0.5, y: 0.25, w: '90%', h: 1.0,
          fontSize: slideDef.titleFontSize || 28,
          bold: true,
          color: parseColor(slideDef.titleColor, '363636'),
          align: slideDef.titleAlign || 'left',
        })
      }

      // 正文内容
      if (slideDef.content !== undefined) {
        slide.addText(String(slideDef.content), {
          x: 0.5, y: 1.5, w: '90%', h: 4.0,
          fontSize: slideDef.contentFontSize || 18,
          color: parseColor(slideDef.contentColor, '444444'),
          align: slideDef.contentAlign || 'left',
          valign: 'top',
          wrap: true,
        })
      }

      // 备注
      if (slideDef.notes) {
        slide.addNotes(String(slideDef.notes))
      }

      // 自定义 items
      for (const item of (slideDef.items || [])) {
        const x = item.x !== undefined ? item.x : 0.5
        const y = item.y !== undefined ? item.y : 1.5
        const w = item.w || '90%'
        const h = item.h || 1.5

        switch (item.type) {
          case 'text':
            slide.addText(String(item.text || ''), {
              x, y, w, h,
              fontSize: item.fontSize || 16,
              bold: item.bold || false,
              italic: item.italic || false,
              underline: item.underline ? { style: 'sng' } : undefined,
              color: parseColor(item.color, '000000'),
              align: item.align || 'left',
              valign: item.valign || 'top',
              wrap: true,
            })
            break

          case 'image':
            if (item.path && fs.existsSync(resolvePath(item.path))) {
              slide.addImage({ path: resolvePath(item.path), x, y, w, h })
            } else if (item.url) {
              slide.addImage({ hyperlink: { url: item.url }, x, y, w, h })
            }
            break

          case 'table': {
            if (!Array.isArray(item.rows) || item.rows.length === 0) break
            const tableData = item.rows.map((row) =>
              (row || []).map((cell) => ({
                text: String(cell ?? ''),
                options: { fontSize: item.fontSize || 14, align: item.cellAlign || 'left' },
              })),
            )
            slide.addTable(tableData, {
              x, y, w,
              colW: item.colWidths,
              border: { pt: 0.5, color: 'CFCFCF' },
              fill: { color: 'FFFFFF' },
              fontFace: 'Arial',
              fontSize: item.fontSize || 14,
            })
            break
          }

          case 'shape': {
            const shapeType = item.shapeType || pptx.ShapeType?.rect || 'rect'
            slide.addShape(shapeType, {
              x, y, w, h,
              fill: { color: parseColor(item.fillColor, 'E8E8E8') },
              line: { color: parseColor(item.lineColor, 'AAAAAA'), pt: item.lineWidth || 1 },
            })
            break
          }

          default:
            break
        }
      }
    }

    await pptx.writeFile({ fileName: fullOutput })
    return ok({ outputPath: fullOutput, slideCount: slides.length })
  } catch (error) {
    return fail(error, { outputPath })
  }
}

/**
 * 向已有 PPTX 末尾追加幻灯片（读取现有文本页 + 新增页后重建）
 */
async function appendSlidesToPptx(filePath, newSlides = []) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const existingSlides = extractTextFromPptx(fullPath).map((text) => ({ content: text }))
    return await createPptx(filePath, [...existingSlides, ...newSlides])
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 替换 PPTX 中所有幻灯片的文本（XML 直接替换）
 */
async function replacePptxText(filePath, searchText, replaceText) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const zip = new AdmZip(fullPath)
    const entries = zip.getEntries().filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    let replaceCount = 0
    for (const entry of entries) {
      let xml = entry.getData().toString('utf8')
      const before = xml.split(searchText).length - 1
      if (before > 0) {
        xml = xml.split(searchText).join(replaceText)
        replaceCount += before
        zip.updateFile(entry.entryName, Buffer.from(xml, 'utf8'))
      }
    }
    zip.writeZip(fullPath)
    return ok({ filePath: fullPath, searchText, replaceText, replaceCount })
  } catch (error) {
    return fail(error, { filePath, searchText, replaceText })
  }
}

/**
 * 合并多个 PPTX 文件（将所有幻灯片的文本提取后重建为新 PPTX）
 */
async function mergePptx(inputPaths, outputPath) {
  try {
    const allSlides = []
    for (const inputPath of inputPaths) {
      const fullInput = resolvePath(inputPath)
      if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
      const slides = extractTextFromPptx(fullInput).map((text) => ({ content: text }))
      allSlides.push(...slides)
    }
    return await createPptx(outputPath, allSlides)
  } catch (error) {
    return fail(error, { outputPath })
  }
}

/**
 * 提取 PPTX 中嵌入的图片到指定目录
 */
async function extractPptxImages(filePath, outputDir) {
  try {
    const fullPath = resolvePath(filePath)
    const fullOutputDir = resolvePath(outputDir)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    fs.ensureDirSync(fullOutputDir)
    const zip = new AdmZip(fullPath)
    const imageEntries = zip.getEntries().filter((e) =>
      /^ppt\/media\//.test(e.entryName) && !e.isDirectory,
    )
    const files = []
    for (const entry of imageEntries) {
      const outFile = path.join(fullOutputDir, path.basename(entry.entryName))
      fs.writeFileSync(outFile, entry.getData())
      files.push(outFile)
    }
    return ok({ filePath: fullPath, outputDir: fullOutputDir, count: files.length, files })
  } catch (error) {
    return fail(error, { filePath, outputDir })
  }
}

/**
 * 统计 PPTX 各幻灯片字数
 */
async function getPptxTextStats(filePath) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const slides = extractTextFromPptx(fullPath)
    const stats = slides.map((text, idx) => ({
      slide: idx + 1,
      wordCount: text.trim().split(/\s+/).filter(Boolean).length,
      charCount: text.length,
      preview: text.substring(0, 60) + (text.length > 60 ? '...' : ''),
    }))
    return ok({
      filePath: fullPath,
      slideCount: slides.length,
      totalWordCount: stats.reduce((s, p) => s + p.wordCount, 0),
      totalCharCount: stats.reduce((s, p) => s + p.charCount, 0),
      slides: stats,
    })
  } catch (error) {
    return fail(error, { filePath })
  }
}

// ─── 工具描述 ─────────────────────────────────────────────────────────────────


// ─── 使用说明 ─────────────────────────────────────────────────────────────────

function pptxReadme() {
  return `【PPTX 工具使用说明】
1. 优先使用本工具内置函数完成任务（信息读取、文本提取、搜索、创建演示文稿、追加幻灯片、文本替换、合并、图片提取等）。
2. 如果内置函数无法满足需求（如复杂动画保真、特殊版式处理、跨格式高级转换），再尝试使用 LibreOffice 命令行。
3. 在调用 LibreOffice 前，先检测系统是否已安装 LibreOffice：
   - 已安装：直接使用 LibreOffice 命令行继续处理。
   - 未安装：询问用户是否允许安装。
4. 若用户同意安装：引导完成安装后继续执行原任务。
5. 若用户拒绝安装：明确告知当前能力限制，并终止该操作。

建议：
- 常规演示文稿处理优先使用内置函数，速度更快且依赖更少。
- 仅在确实需要高保真格式转换或复杂版式时才启用 LibreOffice 路径。`
}

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'pptxReadme',
      description: '获取 PPTX 工具集的使用说明, 调用函数前必须先查看本说明。',
      parameters: {},
    }
  },
  {
    type: 'function',
    function: {
      name: 'getPptxInfo',
      description: '获取 PPTX 文件的基本信息（幻灯片数、文件大小、标题、创建者等）。参数：filePath 为 .pptx 文件路径。返回值：对象，包含 success、data（含 slideCount、size、mtime、title、creator）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'PPTX 文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'readPptxText',
      description: '提取 PPTX 演示文稿中所有幻灯片的纯文本内容。参数：filePath 为 .pptx 文件路径。返回值：对象，包含 success、data（含 slideCount、slides 数组、text 全文、wordCount）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'PPTX 文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchPptxText',
      description: '在 PPTX 中搜索关键词，返回包含该词的幻灯片页码。参数：filePath 为 .pptx 路径；keyword 为搜索关键词。返回值：对象，包含 success、data（含 keyword、matchCount、matches 数组）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'PPTX 文件路径。' },
          keyword: { type: 'string', description: '搜索关键词。' },
        },
        required: ['filePath', 'keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createPptx',
      description: `创建新的 PPTX 演示文稿，支持多种内容类型。
参数：outputPath 为输出路径；slides 为幻灯片数组，每项可含：
  title（标题文字）、content（正文文字）、notes（备注）、background（背景色）、
  items（自定义元素数组，每项 type: 'text'|'image'|'table'|'shape'，含 x/y/w/h 坐标）；
options 可选：{ title, subject, author, company, layout }。
返回值：对象，包含 success、data（含 outputPath、slideCount）、error。`,
      parameters: {
        type: 'object',
        properties: {
          outputPath: { type: 'string', description: '输出 .pptx 文件路径。' },
          slides: { type: 'array', description: '幻灯片定义数组。', items: { type: 'object' } },
          options: { type: 'object', description: '可选：{ title, subject, author, company, layout }。' },
        },
        required: ['outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'appendSlidesToPptx',
      description: '向已有 PPTX 末尾追加新幻灯片。参数：filePath 为目标 .pptx 路径；newSlides 为要追加的幻灯片数组（格式同 createPptx 的 slides）。返回值：对象，包含 success、data（含 outputPath、slideCount）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '目标 PPTX 文件路径。' },
          newSlides: { type: 'array', description: '要追加的幻灯片数组。', items: { type: 'object' } },
        },
        required: ['filePath', 'newSlides'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replacePptxText',
      description: '替换 PPTX 所有幻灯片中的指定文本。参数：filePath 为 .pptx 路径；searchText 为查找文本；replaceText 为替换文本。返回值：对象，包含 success、data（含 filePath、replaceCount）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '目标 PPTX 文件路径。' },
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
      name: 'mergePptx',
      description: '将多个 PPTX 文件合并为一个（按顺序合并所有幻灯片）。参数：inputPaths 为源文件路径数组；outputPath 为输出路径。返回值：对象，包含 success、data（含 outputPath、slideCount）、error。',
      parameters: {
        type: 'object',
        properties: {
          inputPaths: { type: 'array', items: { type: 'string' }, description: '要合并的 PPTX 文件路径数组。' },
          outputPath: { type: 'string', description: '合并后输出的 PPTX 文件路径。' },
        },
        required: ['inputPaths', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extractPptxImages',
      description: '提取 PPTX 中所有嵌入的图片到指定目录。参数：filePath 为 .pptx 路径；outputDir 为输出目录。返回值：对象，包含 success、data（含 outputDir、count、files 数组）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'PPTX 文件路径。' },
          outputDir: { type: 'string', description: '图片输出目录。' },
        },
        required: ['filePath', 'outputDir'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPptxTextStats',
      description: '统计 PPTX 各幻灯片的字数与字符数。参数：filePath 为 .pptx 路径。返回值：对象，包含 success、data（含 slideCount、totalWordCount、totalCharCount、slides 统计数组）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'PPTX 文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
]

// ─── 导出 ──────────────────────────────────────────────────────────────────────

const functions = {
  pptxReadme,
  getPptxInfo,
  readPptxText,
  searchPptxText,
  createPptx,
  appendSlidesToPptx,
  replacePptxText,
  mergePptx,
  extractPptxImages,
  getPptxTextStats,
}

const PptxTool = {
  name: 'PptxTool',
  description: '提供 PowerPoint（.pptx）文件的信息读取、文本提取、搜索、创建演示文稿（含文本/图片/表格/形状）、追加幻灯片、文本替换、合并、图片提取等全面处理能力',
  platform: 'all',
  descriptions,
  functions,
  isSystem: true
}

module.exports = PptxTool
