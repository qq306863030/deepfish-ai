/**
 * @Author: Roman 306863030@qq.com
 * @Description: PDF 文档处理工具集（pdf-parse / pdf-lib / pdfkit）
 */
const path = require('path')
const fs = require('fs-extra')
const pdfParse = require('pdf-parse')
const { PDFDocument, degrees, rgb, StandardFonts } = require('pdf-lib')
const PDFKit = require('pdfkit')
const { pdf } = require('pdf-to-img')
const sharp = require('sharp')

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

/**
 * 读取 PDF 中的全部文本内容
 */
async function readPdfText(filePath) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const dataBuffer = fs.readFileSync(fullPath)
    const data = await pdfParse(dataBuffer)
    return ok({
      filePath: fullPath,
      text: data.text,
      pageCount: data.numpages,
      wordCount: data.text.trim().split(/\s+/).filter(Boolean).length,
      charCount: data.text.length,
    })
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 获取 PDF 文档元信息（页数、作者、标题、创建时间等）
 */
async function getPdfInfo(filePath) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const dataBuffer = fs.readFileSync(fullPath)
    const parseData = await pdfParse(dataBuffer)
    const pdfDoc = await PDFDocument.load(dataBuffer)
    const stat = fs.statSync(fullPath)
    return ok({
      filePath: fullPath,
      pageCount: parseData.numpages,
      size: stat.size,
      mtime: stat.mtime,
      title: pdfDoc.getTitle() || null,
      author: pdfDoc.getAuthor() || null,
      subject: pdfDoc.getSubject() || null,
      keywords: pdfDoc.getKeywords() || null,
      creator: pdfDoc.getCreator() || null,
      producer: pdfDoc.getProducer() || null,
      creationDate: pdfDoc.getCreationDate() || null,
      modificationDate: pdfDoc.getModificationDate() || null,
      pdfVersion: parseData.info?.PDFFormatVersion || null,
    })
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 仅获取 PDF 总页数（轻量调用）
 */
async function getPdfPageCount(filePath) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const pdfDoc = await PDFDocument.load(fs.readFileSync(fullPath))
    return ok({ filePath: fullPath, pageCount: pdfDoc.getPageCount() })
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 在 PDF 中搜索关键词，返回包含该词的行
 */
async function searchPdfText(filePath, keyword) {
  try {
    const readResult = await readPdfText(filePath)
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
 * 合并多个 PDF 文件为一个
 */
async function mergePdfs(inputPaths, outputPath) {
  try {
    const fullOutput = resolvePath(outputPath)
    fs.ensureDirSync(path.dirname(fullOutput))
    const mergedDoc = await PDFDocument.create()
    for (const inputPath of inputPaths) {
      const fullInput = resolvePath(inputPath)
      if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
      const srcDoc = await PDFDocument.load(fs.readFileSync(fullInput))
      const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices())
      pages.forEach((p) => mergedDoc.addPage(p))
    }
    fs.writeFileSync(fullOutput, await mergedDoc.save())
    return ok({ outputPath: fullOutput, pageCount: mergedDoc.getPageCount(), inputCount: inputPaths.length })
  } catch (error) {
    return fail(error, { outputPath })
  }
}

/**
 * 将 PDF 按每页拆分为独立文件，保存到输出目录
 */
async function splitPdf(filePath, outputDir) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutputDir = resolvePath(outputDir)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    fs.ensureDirSync(fullOutputDir)
    const srcDoc = await PDFDocument.load(fs.readFileSync(fullInput))
    const pageCount = srcDoc.getPageCount()
    const baseName = path.basename(fullInput, path.extname(fullInput))
    const results = []
    for (let i = 0; i < pageCount; i++) {
      const newDoc = await PDFDocument.create()
      const [page] = await newDoc.copyPages(srcDoc, [i])
      newDoc.addPage(page)
      const outFile = path.join(fullOutputDir, `${baseName}_page${i + 1}.pdf`)
      fs.writeFileSync(outFile, await newDoc.save())
      results.push(outFile)
    }
    return ok({ filePath: fullInput, outputDir: fullOutputDir, pageCount, files: results })
  } catch (error) {
    return fail(error, { filePath, outputDir })
  }
}

/**
 * 从 PDF 中提取指定页码（1-based）生成新文件
 */
async function extractPdfPages(filePath, outputPath, pages) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    fs.ensureDirSync(path.dirname(fullOutput))
    const srcDoc = await PDFDocument.load(fs.readFileSync(fullInput))
    const total = srcDoc.getPageCount()
    const indices = (pages || []).map((p) => p - 1).filter((i) => i >= 0 && i < total)
    if (indices.length === 0) return fail('No valid page numbers provided', { filePath: fullInput, pages })
    const newDoc = await PDFDocument.create()
    const copied = await newDoc.copyPages(srcDoc, indices)
    copied.forEach((p) => newDoc.addPage(p))
    fs.writeFileSync(fullOutput, await newDoc.save())
    return ok({ filePath: fullInput, outputPath: fullOutput, extractedPages: indices.map((i) => i + 1) })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 旋转 PDF 页面（可指定特定页或全部页）
 */
async function rotatePdfPages(filePath, outputPath, rotateDegrees, pageNumbers) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    fs.ensureDirSync(path.dirname(fullOutput))
    const pdfDoc = await PDFDocument.load(fs.readFileSync(fullInput))
    const deg = rotateDegrees || 90
    const total = pdfDoc.getPageCount()
    const targets = Array.isArray(pageNumbers) && pageNumbers.length > 0
      ? pageNumbers.map((p) => p - 1).filter((i) => i >= 0 && i < total)
      : Array.from({ length: total }, (_, i) => i)
    for (const idx of targets) {
      const page = pdfDoc.getPage(idx)
      page.setRotation(degrees((page.getRotation().angle + deg) % 360))
    }
    fs.writeFileSync(fullOutput, await pdfDoc.save())
    return ok({ filePath: fullInput, outputPath: fullOutput, degrees: deg, rotatedPages: targets.map((i) => i + 1) })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 向 PDF 全部页面添加文字水印
 */
async function addWatermarkText(filePath, outputPath, text, options = {}) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    fs.ensureDirSync(path.dirname(fullOutput))
    const pdfDoc = await PDFDocument.load(fs.readFileSync(fullInput))
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontSize = options.fontSize || 48
    const opacity = options.opacity !== undefined ? options.opacity : 0.2
    const color = options.color
      ? rgb(options.color.r / 255, options.color.g / 255, options.color.b / 255)
      : rgb(0.5, 0.5, 0.5)
    const rotateAngle = options.angle !== undefined ? options.angle : 45
    const pages = pdfDoc.getPages()
    for (const page of pages) {
      const { width, height } = page.getSize()
      page.drawText(text, {
        x: width / 2 - (font.widthOfTextAtSize(text, fontSize) / 2),
        y: height / 2,
        size: fontSize,
        font,
        color,
        opacity,
        rotate: degrees(rotateAngle),
      })
    }
    fs.writeFileSync(fullOutput, await pdfDoc.save())
    return ok({ filePath: fullInput, outputPath: fullOutput, text, pageCount: pages.length })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 创建新 PDF（支持文本段落、标题、分页）
 * content 为数组，每项：{ type: 'text'|'heading'|'pageBreak', text, fontSize, bold, color, align }
 */
async function createPdf(outputPath, content = [], options = {}) {
  try {
    const fullOutput = resolvePath(outputPath)
    fs.ensureDirSync(path.dirname(fullOutput))
    return await new Promise((resolve, reject) => {
      const doc = new PDFKit({
        size: options.pageSize || 'A4',
        margin: options.margin || 50,
        info: {
          Title: options.title || '',
          Author: options.author || '',
          Subject: options.subject || '',
        },
      })
      const stream = fs.createWriteStream(fullOutput)
      doc.pipe(stream)

      for (const sec of content) {
        switch (sec.type) {
          case 'heading':
            doc.font('Helvetica-Bold').fontSize(sec.fontSize || 18)
            if (sec.color) doc.fillColor(sec.color)
            doc.text(sec.text || '', { align: sec.align || 'left' })
            doc.fillColor('#000000').font('Helvetica')
            doc.moveDown(0.5)
            break
          case 'pageBreak':
            doc.addPage()
            break
          case 'text':
          default:
            doc.font(sec.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(sec.fontSize || 12)
            if (sec.color) doc.fillColor(sec.color)
            doc.text(sec.text || '', { align: sec.align || 'left' })
            doc.fillColor('#000000').font('Helvetica')
            doc.moveDown(0.3)
            break
        }
      }

      doc.end()
      stream.on('finish', () => resolve(ok({ outputPath: fullOutput, itemCount: content.length })))
      stream.on('error', (err) => reject(err))
    })
  } catch (error) {
    return fail(error, { outputPath })
  }
}

/**
 * 将纯文本文件转换为 PDF
 */
async function textToPdf(inputPath, outputPath, options = {}) {
  try {
    const fullInput = resolvePath(inputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    const text = fs.readFileSync(fullInput, 'utf8')
    const content = [{ type: 'text', text }]
    return await createPdf(outputPath, content, options)
  } catch (error) {
    return fail(error, { inputPath, outputPath })
  }
}

/**
 * 在 PDF 末尾追加空白页
 */
async function appendBlankPages(filePath, outputPath, count) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    fs.ensureDirSync(path.dirname(fullOutput))
    const pdfDoc = await PDFDocument.load(fs.readFileSync(fullInput))
    const n = count || 1
    for (let i = 0; i < n; i++) pdfDoc.addPage()
    fs.writeFileSync(fullOutput, await pdfDoc.save())
    return ok({ filePath: fullInput, outputPath: fullOutput, addedPages: n, totalPages: pdfDoc.getPageCount() })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 设置 PDF 文档元信息（标题、作者、主题、关键词）
 */
async function setPdfMetadata(filePath, outputPath, metadata) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    fs.ensureDirSync(path.dirname(fullOutput))
    const pdfDoc = await PDFDocument.load(fs.readFileSync(fullInput))
    if (metadata.title !== undefined) pdfDoc.setTitle(metadata.title)
    if (metadata.author !== undefined) pdfDoc.setAuthor(metadata.author)
    if (metadata.subject !== undefined) pdfDoc.setSubject(metadata.subject)
    if (metadata.keywords !== undefined) pdfDoc.setKeywords(Array.isArray(metadata.keywords) ? metadata.keywords : [metadata.keywords])
    if (metadata.creator !== undefined) pdfDoc.setCreator(metadata.creator)
    fs.writeFileSync(fullOutput, await pdfDoc.save())
    return ok({ filePath: fullInput, outputPath: fullOutput, metadata })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 统计 PDF 各页文字字符数（基于整体文本按页估算）
 */
async function getPdfTextStats(filePath) {
  try {
    const readResult = await readPdfText(filePath)
    if (!readResult.success) return readResult
    const { text, pageCount } = readResult.data
    const totalChars = text.length
    const totalWords = text.trim().split(/\s+/).filter(Boolean).length
    const lines = text.split('\n').filter(Boolean)
    return ok({
      filePath: resolvePath(filePath),
      pageCount,
      totalChars,
      totalWords,
      totalLines: lines.length,
      avgCharsPerPage: pageCount > 0 ? Math.round(totalChars / pageCount) : 0,
      avgWordsPerPage: pageCount > 0 ? Math.round(totalWords / pageCount) : 0,
    })
  } catch (error) {
    return fail(error, { filePath })
  }
}


async function pdfToLongImage(pdfPath, outputImagePath) {
  try {
    pdfPath = resolvePath(pdfPath)
    outputImagePath = resolvePath(outputImagePath)
    if (!fs.existsSync(pdfPath)) return fail(`File does not exist: ${pdfPath}`, { pdfPath })
    // 0. 确保输出目录存在
    fs.ensureDirSync(path.dirname(outputImagePath));
    // 1. 读取 PDF 文档，设置 scale 参数可提高图片清晰度
    const document = await pdf(pdfPath, { scale: 2 });
    const pages = [];

    // 2. 遍历每一页，将图片 Buffer 收集起来
    for await (const pageBuffer of document) {
      pages.push(pageBuffer);
    }

    if (pages.length === 0) {
      return fail(`PDF has no pages`, { pdfPath })
    }

    // 3. 获取所有页面的尺寸，计算最大宽度和总高度
    let maxWidth = 0;
    let totalHeight = 0;
    const pageHeights = [];
    
    for (const pageBuffer of pages) {
      const metadata = await sharp(pageBuffer).metadata();
      maxWidth = Math.max(maxWidth, metadata.width);
      totalHeight += metadata.height;
      pageHeights.push(metadata.height);
    }

    // 4. 构建 sharp 的输入：将图片 Buffer 数组叠加，并设置垂直偏移
    const sharpInput = [];
    let currentHeight = 0;
    
    for (let i = 0; i < pages.length; i++) {
      const pageBuffer = pages[i];
      const pageHeight = pageHeights[i];
      
      // 获取当前页面的实际宽度
      const pageMetadata = await sharp(pageBuffer).metadata();
      const pageWidth = pageMetadata.width;
      
      // 计算水平居中的偏移量
      const leftOffset = Math.floor((maxWidth - pageWidth) / 2);
      
      sharpInput.push({
        input: pageBuffer,
        top: currentHeight, // 每页依次向下排列
        left: leftOffset, // 水平居中
      });
      
      currentHeight += pageHeight;
    }

    // 5. 使用 sharp 合成长图
    await sharp({
      create: {
        width: maxWidth,
        height: totalHeight, // 总高度 = 所有页面高度之和
        channels: 4, // RGBA
        background: { r: 255, g: 255, b: 255, alpha: 1 }, // 白色背景
      },
    })
      .composite(sharpInput)
      .png() // 输出为 PNG 格式
      .toFile(outputImagePath)

    return ok({ pdfPath, outputImagePath, pageCount: pages.length, width: maxWidth, height: totalHeight })
  } catch (error) {
    return fail(error, { pdfPath, outputImagePath })
  }
}

// ─── 工具描述 ─────────────────────────────────────────────────────────────────

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'readPdfText',
      description: '读取 PDF 文件并提取全部文本内容。参数：filePath 为 PDF 路径。返回值：对象，包含 success、data（含 filePath、text、pageCount、wordCount、charCount）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'PDF 文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPdfInfo',
      description: '获取 PDF 文档元信息（页数、标题、作者、创建时间、文件大小等）。参数：filePath 为 PDF 路径。返回值：对象，包含 success、data（含 pageCount、size、title、author、subject、keywords、creator、producer、creationDate、modificationDate）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'PDF 文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPdfPageCount',
      description: '快速获取 PDF 总页数。参数：filePath 为 PDF 路径。返回值：对象，包含 success、data（含 filePath、pageCount）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'PDF 文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchPdfText',
      description: '在 PDF 内容中搜索关键词，返回所有包含该词的行。参数：filePath 为 PDF 路径；keyword 为搜索关键词。返回值：对象，包含 success、data（含 keyword、matchCount、matches 数组）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'PDF 文件路径。' },
          keyword: { type: 'string', description: '搜索关键词。' },
        },
        required: ['filePath', 'keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mergePdfs',
      description: '将多个 PDF 文件合并为一个。参数：inputPaths 为 PDF 路径数组（按顺序合并）；outputPath 为输出路径。返回值：对象，包含 success、data（含 outputPath、pageCount、inputCount）、error。',
      parameters: {
        type: 'object',
        properties: {
          inputPaths: { type: 'array', items: { type: 'string' }, description: '要合并的 PDF 文件路径数组。' },
          outputPath: { type: 'string', description: '合并后输出的 PDF 文件路径。' },
        },
        required: ['inputPaths', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'splitPdf',
      description: '将 PDF 按页拆分，每页生成独立 PDF 文件。参数：filePath 为源 PDF 路径；outputDir 为输出目录。返回值：对象，包含 success、data（含 outputDir、pageCount、files 数组）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '要拆分的 PDF 文件路径。' },
          outputDir: { type: 'string', description: '拆分后各页 PDF 的输出目录。' },
        },
        required: ['filePath', 'outputDir'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extractPdfPages',
      description: '从 PDF 中提取指定页码（1-based）生成新 PDF。参数：filePath 为源 PDF 路径；outputPath 为输出路径；pages 为页码数组（如 [1, 3, 5]）。返回值：对象，包含 success、data（含 outputPath、extractedPages）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源 PDF 文件路径。' },
          outputPath: { type: 'string', description: '输出 PDF 文件路径。' },
          pages: { type: 'array', items: { type: 'number' }, description: '要提取的页码数组（从 1 开始），如 [1, 2, 5]。' },
        },
        required: ['filePath', 'outputPath', 'pages'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rotatePdfPages',
      description: '旋转 PDF 页面。参数：filePath 为源 PDF 路径；outputPath 为输出路径；rotateDegrees 为旋转角度（90/180/270，默认 90）；pageNumbers 为要旋转的页码数组（1-based，省略则旋转全部页）。返回值：对象，包含 success、data（含 outputPath、degrees、rotatedPages）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源 PDF 文件路径。' },
          outputPath: { type: 'string', description: '输出 PDF 文件路径。' },
          rotateDegrees: { type: 'number', description: '旋转角度（90/180/270），默认 90。' },
          pageNumbers: { type: 'array', items: { type: 'number' }, description: '要旋转的页码数组（从 1 开始），省略则旋转全部页。' },
        },
        required: ['filePath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addWatermarkText',
      description: '向 PDF 全部页面添加文字水印。参数：filePath 为源 PDF 路径；outputPath 为输出路径；text 为水印文字；options 可选（fontSize 默认 48，opacity 默认 0.2，angle 默认 45，color: {r,g,b}）。返回值：对象，包含 success、data（含 outputPath、text、pageCount）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源 PDF 文件路径。' },
          outputPath: { type: 'string', description: '输出 PDF 文件路径。' },
          text: { type: 'string', description: '水印文字内容。' },
          options: { type: 'object', description: '可选：{ fontSize, opacity, angle, color: {r,g,b} }。' },
        },
        required: ['filePath', 'outputPath', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createPdf',
      description: `创建新的 PDF 文档，支持多种内容类型。
参数：outputPath 为输出路径；content 为内容数组，每项格式：
- 文本：{ type:'text', text, fontSize, bold, color, align }
- 标题：{ type:'heading', text, fontSize, color, align }
- 分页：{ type:'pageBreak' }
options 可选：{ pageSize: A4/A3/Letter, margin, title, author, subject }。
返回值：对象，包含 success、data（含 outputPath、itemCount）、error。`,
      parameters: {
        type: 'object',
        properties: {
          outputPath: { type: 'string', description: '输出 PDF 文件路径。' },
          content: { type: 'array', description: '内容块数组，支持 text/heading/pageBreak 类型。', items: { type: 'object' } },
          options: { type: 'object', description: '可选：{ pageSize, margin, title, author, subject }。' },
        },
        required: ['outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'textToPdf',
      description: '将纯文本文件（.txt）转换为 PDF 文档。参数：inputPath 为 .txt 文件路径；outputPath 为输出 PDF 路径；options 可选（同 createPdf options）。返回值：对象，包含 success、data（含 outputPath）、error。',
      parameters: {
        type: 'object',
        properties: {
          inputPath: { type: 'string', description: '源 .txt 文件路径。' },
          outputPath: { type: 'string', description: '输出 PDF 文件路径。' },
          options: { type: 'object', description: '可选：{ pageSize, margin, title, author }。' },
        },
        required: ['inputPath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'appendBlankPages',
      description: '在 PDF 末尾追加指定数量的空白页。参数：filePath 为源 PDF 路径；outputPath 为输出路径；count 为追加页数（默认 1）。返回值：对象，包含 success、data（含 outputPath、addedPages、totalPages）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源 PDF 文件路径。' },
          outputPath: { type: 'string', description: '输出 PDF 文件路径。' },
          count: { type: 'number', description: '要追加的空白页数量，默认 1。' },
        },
        required: ['filePath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setPdfMetadata',
      description: '设置 PDF 文档的元信息（标题、作者、主题、关键词）。参数：filePath 为源 PDF 路径；outputPath 为输出路径；metadata 为元信息对象（含 title/author/subject/keywords/creator 字段）。返回值：对象，包含 success、data（含 outputPath、metadata）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源 PDF 文件路径。' },
          outputPath: { type: 'string', description: '输出 PDF 文件路径。' },
          metadata: {
            type: 'object',
            description: '元信息对象，如 { title, author, subject, keywords, creator }。',
          },
        },
        required: ['filePath', 'outputPath', 'metadata'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPdfTextStats',
      description: '统计 PDF 文档的文字数量（总字数、总字符数、总行数及每页平均值）。参数：filePath 为 PDF 路径。返回值：对象，包含 success、data（含 pageCount、totalChars、totalWords、totalLines、avgCharsPerPage、avgWordsPerPage）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'PDF 文件路径。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pdfToLongImage',
      description: '将 PDF 所有页面依次拼接为一张竖向长图（PNG 格式）。参数：pdfPath 为 PDF 文件路径；outputImagePath 为输出 PNG 图片路径。返回值：对象，包含 success、data（含 pdfPath、outputImagePath、pageCount、width、height）、error。',
      parameters: {
        type: 'object',
        properties: {
          pdfPath: { type: 'string', description: '源 PDF 文件路径。' },
          outputImagePath: { type: 'string', description: '输出长图的 PNG 文件路径。' },
        },
        required: ['pdfPath', 'outputImagePath'],
      },
    },
  },
]

// ─── 导出 ──────────────────────────────────────────────────────────────────────

const functions = {
  readPdfText,
  getPdfInfo,
  getPdfPageCount,
  searchPdfText,
  mergePdfs,
  splitPdf,
  extractPdfPages,
  rotatePdfPages,
  addWatermarkText,
  createPdf,
  textToPdf,
  appendBlankPages,
  setPdfMetadata,
  getPdfTextStats,
  pdfToLongImage,
}

const PdfTool = {
  name: 'PdfTool',
  description: '提供 PDF 文档的文本提取、搜索、元信息读写、合并、拆分、提取页面、旋转、添加水印、创建、文本转 PDF、PDF 转长图等全面处理能力',
  platform: 'all',
  descriptions,
  functions,
}

module.exports = PdfTool
