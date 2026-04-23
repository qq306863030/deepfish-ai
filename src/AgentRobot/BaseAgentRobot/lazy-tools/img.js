/**
 * @Author: Roman 306863030@qq.com
 * @Description: 图片处理工具集（sharp）
 */
const path = require('path')
const fs = require('fs-extra')
const sharp = require('sharp')
const PDFKit = require('pdfkit')

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

function ensureOutputDir(outputPath) {
  fs.ensureDirSync(path.dirname(outputPath))
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/**
 * 获取图片元数据（尺寸、格式、色彩空间等）
 */
async function getImageInfo(filePath) {
  try {
    const fullPath = resolvePath(filePath)
    if (!fs.existsSync(fullPath)) return fail(`File does not exist: ${fullPath}`, { filePath: fullPath })
    const meta = await sharp(fullPath).metadata()
    const stat = fs.statSync(fullPath)
    return ok({
      filePath: fullPath,
      format: meta.format,
      width: meta.width,
      height: meta.height,
      channels: meta.channels,
      space: meta.space,
      hasAlpha: meta.hasAlpha,
      density: meta.density,
      size: stat.size,
      mtime: stat.mtime,
      exif: meta.exif ? true : false,
      icc: meta.icc ? true : false,
    })
  } catch (error) {
    return fail(error, { filePath })
  }
}

/**
 * 调整图片尺寸
 */
async function resizeImage(filePath, outputPath, width, height, options = {}) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    ensureOutputDir(fullOutput)
    const fitMap = { contain: 'contain', cover: 'cover', fill: 'fill', inside: 'inside', outside: 'outside' }
    const fit = fitMap[options.fit] || 'cover'
    await sharp(fullInput)
      .resize(width || null, height || null, {
        fit,
        withoutEnlargement: options.withoutEnlargement !== false,
        background: options.background || { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .toFile(fullOutput)
    const meta = await sharp(fullOutput).metadata()
    return ok({ filePath: fullInput, outputPath: fullOutput, width: meta.width, height: meta.height })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 裁剪图片（从指定坐标裁出矩形区域）
 */
async function cropImage(filePath, outputPath, left, top, width, height) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    ensureOutputDir(fullOutput)
    await sharp(fullInput)
      .extract({ left: left || 0, top: top || 0, width, height })
      .toFile(fullOutput)
    return ok({ filePath: fullInput, outputPath: fullOutput, left, top, width, height })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 旋转图片
 */
async function rotateImage(filePath, outputPath, angle) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    ensureOutputDir(fullOutput)
    await sharp(fullInput)
      .rotate(angle || 90, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .toFile(fullOutput)
    return ok({ filePath: fullInput, outputPath: fullOutput, angle })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 翻转图片（水平或垂直）
 */
async function flipImage(filePath, outputPath, direction) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    ensureOutputDir(fullOutput)
    const inst = sharp(fullInput)
    if (direction === 'vertical') {
      inst.flip()
    } else {
      inst.flop()
    }
    await inst.toFile(fullOutput)
    return ok({ filePath: fullInput, outputPath: fullOutput, direction: direction || 'horizontal' })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 转换图片格式（jpeg/png/webp/avif/gif/tiff）
 */
async function convertImage(filePath, outputPath, format, options = {}) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    ensureOutputDir(fullOutput)
    const fmt = (format || path.extname(outputPath).slice(1) || 'jpeg').toLowerCase()
    const formatOptions = {}
    if (options.quality) formatOptions.quality = options.quality
    await sharp(fullInput).toFormat(fmt, formatOptions).toFile(fullOutput)
    return ok({ filePath: fullInput, outputPath: fullOutput, format: fmt })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 压缩图片质量
 */
async function compressImage(filePath, outputPath, quality) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    ensureOutputDir(fullOutput)
    const meta = await sharp(fullInput).metadata()
    const q = Math.max(1, Math.min(100, quality || 75))
    const fmt = meta.format || 'jpeg'
    await sharp(fullInput).toFormat(fmt, { quality: q }).toFile(fullOutput)
    const sizeBefore = fs.statSync(fullInput).size
    const sizeAfter = fs.statSync(fullOutput).size
    return ok({
      filePath: fullInput,
      outputPath: fullOutput,
      quality: q,
      sizeBefore,
      sizeAfter,
      ratio: Math.round((1 - sizeAfter / sizeBefore) * 100) + '%',
    })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 转换为灰度图
 */
async function grayscaleImage(filePath, outputPath) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    ensureOutputDir(fullOutput)
    await sharp(fullInput).grayscale().toFile(fullOutput)
    return ok({ filePath: fullInput, outputPath: fullOutput })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 对图片进行高斯模糊
 */
async function blurImage(filePath, outputPath, sigma) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    ensureOutputDir(fullOutput)
    await sharp(fullInput).blur(sigma || 3).toFile(fullOutput)
    return ok({ filePath: fullInput, outputPath: fullOutput, sigma: sigma || 3 })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 对图片进行锐化
 */
async function sharpenImage(filePath, outputPath, sigma) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    ensureOutputDir(fullOutput)
    await sharp(fullInput).sharpen({ sigma: sigma || 1 }).toFile(fullOutput)
    return ok({ filePath: fullInput, outputPath: fullOutput, sigma: sigma || 1 })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 生成缩略图（限制最长边）
 */
async function thumbnailImage(filePath, outputPath, size) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    ensureOutputDir(fullOutput)
    const s = size || 200
    await sharp(fullInput)
      .resize(s, s, { fit: 'inside', withoutEnlargement: true })
      .toFile(fullOutput)
    const meta = await sharp(fullOutput).metadata()
    return ok({ filePath: fullInput, outputPath: fullOutput, width: meta.width, height: meta.height })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 叠加图片水印（将 overlayPath 图片合成到底图上）
 */
async function overlayImage(filePath, overlayPath, outputPath, options = {}) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOverlay = resolvePath(overlayPath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    if (!fs.existsSync(fullOverlay)) return fail(`Overlay file does not exist: ${fullOverlay}`, { overlayPath: fullOverlay })
    ensureOutputDir(fullOutput)
    const gravity = options.gravity || 'southeast'
    await sharp(fullInput)
      .composite([{ input: fullOverlay, gravity, blend: options.blend || 'over' }])
      .toFile(fullOutput)
    return ok({ filePath: fullInput, overlayPath: fullOverlay, outputPath: fullOutput, gravity })
  } catch (error) {
    return fail(error, { filePath, overlayPath, outputPath })
  }
}

/**
 * 调整图片亮度、饱和度、色相
 */
async function adjustImage(filePath, outputPath, options = {}) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    ensureOutputDir(fullOutput)
    let inst = sharp(fullInput)
    if (options.brightness !== undefined || options.saturation !== undefined || options.hue !== undefined) {
      inst = inst.modulate({
        brightness: options.brightness !== undefined ? options.brightness : 1,
        saturation: options.saturation !== undefined ? options.saturation : 1,
        hue: options.hue !== undefined ? options.hue : 0,
      })
    }
    if (options.gamma !== undefined) inst = inst.gamma(options.gamma)
    if (options.negate) inst = inst.negate()
    await inst.toFile(fullOutput)
    return ok({ filePath: fullInput, outputPath: fullOutput, options })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 为图片添加 padding（边框/背景延伸）
 */
async function padImage(filePath, outputPath, padding, background) {
  try {
    const fullInput = resolvePath(filePath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) return fail(`File does not exist: ${fullInput}`, { filePath: fullInput })
    ensureOutputDir(fullOutput)
    const p = typeof padding === 'number' ? padding : 20
    const bg = background || { r: 255, g: 255, b: 255, alpha: 1 }
    await sharp(fullInput).extend({ top: p, bottom: p, left: p, right: p, background: bg }).toFile(fullOutput)
    const meta = await sharp(fullOutput).metadata()
    return ok({ filePath: fullInput, outputPath: fullOutput, padding: p, width: meta.width, height: meta.height })
  } catch (error) {
    return fail(error, { filePath, outputPath })
  }
}

/**
 * 批量调整目录中的图片尺寸
 */
async function batchResizeImages(inputDir, outputDir, width, height, options = {}) {
  try {
    const fullInput = resolvePath(inputDir)
    const fullOutput = resolvePath(outputDir)
    if (!fs.existsSync(fullInput)) return fail(`Directory does not exist: ${fullInput}`, { inputDir: fullInput })
    fs.ensureDirSync(fullOutput)
    const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.avif'])
    const files = fs.readdirSync(fullInput).filter((f) => exts.has(path.extname(f).toLowerCase()))
    const results = []
    for (const file of files) {
      const res = await resizeImage(
        path.join(fullInput, file),
        path.join(fullOutput, file),
        width,
        height,
        options,
      )
      results.push({ file, success: res.success, error: res.error || null })
    }
    const succeeded = results.filter((r) => r.success).length
    return ok({ inputDir: fullInput, outputDir: fullOutput, total: results.length, succeeded, results })
  } catch (error) {
    return fail(error, { inputDir, outputDir })
  }
}

/**
 * 批量转换目录中图片的格式
 */
async function batchConvertImages(inputDir, outputDir, format, options = {}) {
  try {
    const fullInput = resolvePath(inputDir)
    const fullOutput = resolvePath(outputDir)
    if (!fs.existsSync(fullInput)) return fail(`Directory does not exist: ${fullInput}`, { inputDir: fullInput })
    fs.ensureDirSync(fullOutput)
    const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.avif'])
    const files = fs.readdirSync(fullInput).filter((f) => exts.has(path.extname(f).toLowerCase()))
    const results = []
    for (const file of files) {
      const outFile = path.basename(file, path.extname(file)) + '.' + format
      const res = await convertImage(
        path.join(fullInput, file),
        path.join(fullOutput, outFile),
        format,
        options,
      )
      results.push({ file, output: outFile, success: res.success, error: res.error || null })
    }
    const succeeded = results.filter((r) => r.success).length
    return ok({ inputDir: fullInput, outputDir: fullOutput, format, total: results.length, succeeded, results })
  } catch (error) {
    return fail(error, { inputDir, outputDir })
  }
}

/**
 * 将多张图片按页合并为一个 PDF 文件
 */
async function imagesToPdf(imagePaths, outputPath, options = {}) {
  try {
    const fullOutput = path.resolve(process.cwd(), outputPath)
    fs.ensureDirSync(path.dirname(fullOutput))
    if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
      return fail('imagePaths must be a non-empty array', { outputPath })
    }
    return await new Promise((resolve, reject) => {
      const doc = new PDFKit({ autoFirstPage: false, margin: 0 })
      const stream = fs.createWriteStream(fullOutput)
      doc.pipe(stream)
      const addPages = async () => {
        for (const imgPath of imagePaths) {
          const fullImg = path.resolve(process.cwd(), imgPath)
          if (!fs.existsSync(fullImg)) {
            return resolve(fail(`Image file does not exist: ${fullImg}`, { imagePath: fullImg }))
          }
          const meta = await sharp(fullImg).metadata()
          const imgW = meta.width || 595
          const imgH = meta.height || 842
          const pageW = options.pageWidth || imgW
          const pageH = options.pageHeight || imgH
          doc.addPage({ size: [pageW, pageH], margin: 0 })
          doc.image(fullImg, 0, 0, { width: pageW, height: pageH, fit: [pageW, pageH], align: 'center', valign: 'center' })
        }
        doc.end()
      }
      addPages().catch(reject)
      stream.on('finish', () =>
        resolve(ok({ outputPath: fullOutput, pageCount: imagePaths.length, imagePaths }))
      )
      stream.on('error', reject)
    })
  } catch (error) {
    return fail(error, { outputPath })
  }
}

// ─── 工具描述 ─────────────────────────────────────────────────────────────────

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'getImageInfo',
      description: '获取图片的元数据信息。参数：filePath 为图片路径。返回值：对象，包含 success、data（含 filePath、format、width、height、channels、space、hasAlpha、density、size、mtime）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '图片文件路径（支持 jpg/png/webp/gif/tiff/avif 等）。' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resizeImage',
      description: '调整图片尺寸。参数：filePath 为源图路径；outputPath 为输出路径；width 为目标宽度（像素）；height 为目标高度（像素）；options 为可选项（fit: contain/cover/fill/inside/outside，withoutEnlargement: boolean，background: {r,g,b,alpha}）。返回值：对象，包含 success、data（含 outputPath、width、height）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源图片文件路径。' },
          outputPath: { type: 'string', description: '输出图片文件路径。' },
          width: { type: 'number', description: '目标宽度（像素），可省略（仅按高度缩放）。' },
          height: { type: 'number', description: '目标高度（像素），可省略（仅按宽度缩放）。' },
          options: { type: 'object', description: '可选：{ fit, withoutEnlargement, background }。' },
        },
        required: ['filePath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cropImage',
      description: '裁剪图片，从指定坐标截取矩形区域。参数：filePath 为源图路径；outputPath 为输出路径；left/top 为起点坐标；width/height 为裁剪区域尺寸。返回值：对象，包含 success、data（含 outputPath、left、top、width、height）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源图片文件路径。' },
          outputPath: { type: 'string', description: '输出图片文件路径。' },
          left: { type: 'number', description: '裁剪起点 X 坐标（像素）。' },
          top: { type: 'number', description: '裁剪起点 Y 坐标（像素）。' },
          width: { type: 'number', description: '裁剪区域宽度（像素）。' },
          height: { type: 'number', description: '裁剪区域高度（像素）。' },
        },
        required: ['filePath', 'outputPath', 'left', 'top', 'width', 'height'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rotateImage',
      description: '旋转图片。参数：filePath 为源图路径；outputPath 为输出路径；angle 为旋转角度（度，正值顺时针）。返回值：对象，包含 success、data（含 outputPath、angle）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源图片文件路径。' },
          outputPath: { type: 'string', description: '输出图片文件路径。' },
          angle: { type: 'number', description: '旋转角度（度），如 90、180、270，正值顺时针。' },
        },
        required: ['filePath', 'outputPath', 'angle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'flipImage',
      description: '翻转图片（水平镜像或垂直翻转）。参数：filePath 为源图路径；outputPath 为输出路径；direction 为翻转方向（horizontal 或 vertical）。返回值：对象，包含 success、data（含 outputPath、direction）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源图片文件路径。' },
          outputPath: { type: 'string', description: '输出图片文件路径。' },
          direction: { type: 'string', description: '翻转方向：horizontal（水平镜像）或 vertical（垂直翻转）。' },
        },
        required: ['filePath', 'outputPath', 'direction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'convertImage',
      description: '转换图片格式。参数：filePath 为源图路径；outputPath 为输出路径；format 为目标格式（jpeg/png/webp/avif/gif/tiff）；options 为可选（{ quality }）。返回值：对象，包含 success、data（含 outputPath、format）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源图片文件路径。' },
          outputPath: { type: 'string', description: '输出图片文件路径。' },
          format: { type: 'string', description: '目标格式，如 jpeg、png、webp、avif、gif、tiff。' },
          options: { type: 'object', description: '可选：{ quality: 1-100 }。' },
        },
        required: ['filePath', 'outputPath', 'format'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compressImage',
      description: '压缩图片文件大小。参数：filePath 为源图路径；outputPath 为输出路径；quality 为质量（1-100，默认 75）。返回值：对象，包含 success、data（含 outputPath、quality、sizeBefore、sizeAfter、ratio）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源图片文件路径。' },
          outputPath: { type: 'string', description: '输出图片文件路径。' },
          quality: { type: 'number', description: '压缩质量 1-100，默认 75。' },
        },
        required: ['filePath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grayscaleImage',
      description: '将图片转换为灰度图。参数：filePath 为源图路径；outputPath 为输出路径。返回值：对象，包含 success、data（含 outputPath）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源图片文件路径。' },
          outputPath: { type: 'string', description: '输出图片文件路径。' },
        },
        required: ['filePath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'blurImage',
      description: '对图片进行高斯模糊。参数：filePath 为源图路径；outputPath 为输出路径；sigma 为模糊半径（默认 3，值越大越模糊）。返回值：对象，包含 success、data（含 outputPath、sigma）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源图片文件路径。' },
          outputPath: { type: 'string', description: '输出图片文件路径。' },
          sigma: { type: 'number', description: '模糊强度（0.3-1000，默认 3）。' },
        },
        required: ['filePath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sharpenImage',
      description: '对图片进行锐化处理。参数：filePath 为源图路径；outputPath 为输出路径；sigma 为锐化强度（默认 1）。返回值：对象，包含 success、data（含 outputPath、sigma）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源图片文件路径。' },
          outputPath: { type: 'string', description: '输出图片文件路径。' },
          sigma: { type: 'number', description: '锐化强度，默认 1。' },
        },
        required: ['filePath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'thumbnailImage',
      description: '生成图片缩略图（等比缩放，最长边不超过 size 像素）。参数：filePath 为源图路径；outputPath 为输出路径；size 为最长边限制（默认 200）。返回值：对象，包含 success、data（含 outputPath、width、height）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源图片文件路径。' },
          outputPath: { type: 'string', description: '输出缩略图文件路径。' },
          size: { type: 'number', description: '缩略图最长边最大像素数，默认 200。' },
        },
        required: ['filePath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'overlayImage',
      description: '将水印图片叠加到底图上。参数：filePath 为底图路径；overlayPath 为水印图路径；outputPath 为输出路径；options 为可选项（gravity: northwest/north/northeast/west/center/east/southwest/south/southeast，blend: over/multiply 等）。返回值：对象，包含 success、data（含 outputPath、gravity）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '底图文件路径。' },
          overlayPath: { type: 'string', description: '水印/叠加图片文件路径。' },
          outputPath: { type: 'string', description: '输出图片文件路径。' },
          options: { type: 'object', description: '可选：{ gravity, blend }，gravity 默认 southeast。' },
        },
        required: ['filePath', 'overlayPath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'adjustImage',
      description: '调整图片亮度、饱和度、色相及特效。参数：filePath 为源图路径；outputPath 为输出路径；options 为调整参数（brightness: 倍数，1 为原始；saturation: 倍数；hue: 角度 0-360；gamma: 1-3；negate: 布尔）。返回值：对象，包含 success、data（含 outputPath）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源图片文件路径。' },
          outputPath: { type: 'string', description: '输出图片文件路径。' },
          options: {
            type: 'object',
            description: '调整参数：{ brightness, saturation, hue, gamma, negate }。',
          },
        },
        required: ['filePath', 'outputPath', 'options'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'padImage',
      description: '为图片四周添加等宽 padding（背景延伸）。参数：filePath 为源图路径；outputPath 为输出路径；padding 为边距像素数（默认 20）；background 为背景色（{ r, g, b, alpha }，默认白色）。返回值：对象，包含 success、data（含 outputPath、padding、width、height）、error。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '源图片文件路径。' },
          outputPath: { type: 'string', description: '输出图片文件路径。' },
          padding: { type: 'number', description: '四周边距像素数，默认 20。' },
          background: { type: 'object', description: '背景色对象 { r, g, b, alpha }，默认白色。' },
        },
        required: ['filePath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'batchResizeImages',
      description: '批量调整目录中所有图片的尺寸。参数：inputDir 为源目录；outputDir 为输出目录；width 为目标宽度；height 为目标高度；options 同 resizeImage。返回值：对象，包含 success、data（含 total、succeeded、results 数组）、error。',
      parameters: {
        type: 'object',
        properties: {
          inputDir: { type: 'string', description: '源图片目录路径。' },
          outputDir: { type: 'string', description: '输出目录路径。' },
          width: { type: 'number', description: '目标宽度（像素）。' },
          height: { type: 'number', description: '目标高度（像素）。' },
          options: { type: 'object', description: '可选：{ fit, withoutEnlargement }。' },
        },
        required: ['inputDir', 'outputDir'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'batchConvertImages',
      description: '批量转换目录中所有图片的格式。参数：inputDir 为源目录；outputDir 为输出目录；format 为目标格式（jpeg/png/webp/avif/gif/tiff）；options 为可选（{ quality }）。返回值：对象，包含 success、data（含 format、total、succeeded、results 数组）、error。',
      parameters: {
        type: 'object',
        properties: {
          inputDir: { type: 'string', description: '源图片目录路径。' },
          outputDir: { type: 'string', description: '输出目录路径。' },
          format: { type: 'string', description: '目标格式，如 jpeg、png、webp、avif。' },
          options: { type: 'object', description: '可选：{ quality: 1-100 }。' },
        },
        required: ['inputDir', 'outputDir', 'format'],
      },
    },
  },  {
    type: 'function',
    function: {
      name: 'imagesToPdf',
      description: '将多张图片按顺序合并为一个 PDF 文件，每张图片占一页。参数：imagePaths 为图片路径数组（支持 jpg/png/webp 等）；outputPath 为输出 PDF 路径；options 可选（{ pageWidth, pageHeight }，省略则自动适配图片尺寸）。返回值：对象，包含 success、data（含 outputPath、pageCount、imagePaths）、error。',
      parameters: {
        type: 'object',
        properties: {
          imagePaths: { type: 'array', items: { type: 'string' }, description: '图片路径数组，按顺序排列。' },
          outputPath: { type: 'string', description: '输出 PDF 文件路径。' },
          options: { type: 'object', description: '可选：{ pageWidth, pageHeight }，单位像素。' },
        },
        required: ['imagePaths', 'outputPath'],
      },
    },
  },]

// ─── 导出 ──────────────────────────────────────────────────────────────────────

const functions = {
  getImageInfo,
  resizeImage,
  cropImage,
  rotateImage,
  flipImage,
  convertImage,
  compressImage,
  grayscaleImage,
  blurImage,
  sharpenImage,
  thumbnailImage,
  overlayImage,
  adjustImage,
  padImage,
  batchResizeImages,
  batchConvertImages,
  imagesToPdf,
}

const ImgTool = {
  name: 'ImgTool',
  description: '提供图片的元数据读取、缩放、裁剪、旋转、翻转、格式转换、压缩、灰度、模糊、锐化、缩略图、水印叠加、图片转 PDF、批量处理等全面图像处理能力',
  platform: 'all',
  descriptions,
  functions,
  isSystem: true
}

module.exports = ImgTool
