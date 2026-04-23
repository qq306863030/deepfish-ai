/**
 * @Author: Roman 306863030@qq.com
 * @Description: 文档格式转换工具集（Markdown / HTML / PDF 互转）
 * 依赖：puppeteer / fs-extra
 * Word 相关转换（wordToPdf / wordToHtml / wordToMarkdown / markdownToWord / htmlToWord）已集成在 DocxTool 中
 */
const path = require('path')
const fs = require('fs-extra')

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
 * 使用 puppeteer 将 HTML 字符串渲染为 PDF 文件
 */
async function htmlStringToPdf(html, outputPath) {
  let puppeteer
  try {
    puppeteer = require('puppeteer')
  } catch {
    throw new Error('puppeteer 未安装，请先执行 npm install puppeteer')
  }
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    fs.ensureDirSync(path.dirname(outputPath))
    await page.pdf({ path: outputPath, format: 'A4', printBackground: true })
  } finally {
    await browser.close()
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * 将 Markdown 文本转换为 HTML 字符串（基础实现，无需额外依赖）
 */
function markdownToHtmlString(md) {
  let html = md
    // 代码块
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang}">${escapeHtml(code.trimEnd())}</code></pre>`)
    // 行内代码
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`)
    // 标题
    .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
    .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // 水平线
    .replace(/^[-*_]{3,}$/gm, '<hr>')
    // 粗斜体
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // 粗体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // 删除线
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // 图片
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // 无序列表
    .replace(/^[ \t]*[-*+] (.+)$/gm, '<li>$1</li>')
    // 有序列表
    .replace(/^[ \t]*\d+\. (.+)$/gm, '<li>$1</li>')
    // 引用
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

  // 将连续 <li> 包裹进 <ul>
  html = html.replace(/(<li>[\s\S]+?<\/li>)(\n(?!<li>)|$)/g, (_, items) => `<ul>${items}</ul>`)

  // 段落：连续非标签行
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p>$1</p>')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:sans-serif;line-height:1.7;max-width:900px;margin:40px auto;padding:0 20px;color:#333}
h1,h2,h3,h4,h5,h6{margin-top:1.2em}
pre{background:#f5f5f5;padding:12px;border-radius:4px;overflow:auto}
code{background:#f0f0f0;padding:2px 4px;border-radius:3px}
blockquote{border-left:4px solid #ddd;margin:0;padding-left:1em;color:#666}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 10px}
</style></head><body>${html}</body></html>`
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/**
 * Markdown 转 PDF
 */
async function markdownToPdf(inputPath, outputPath) {
  try {
    const fullInput = resolvePath(inputPath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) {
      return fail(`File does not exist: ${fullInput}`, { inputPath: fullInput })
    }
    const md = fs.readFileSync(fullInput, 'utf8')
    const html = markdownToHtmlString(md)
    await htmlStringToPdf(html, fullOutput)
    return ok({ inputPath: fullInput, outputPath: fullOutput })
  } catch (error) {
    return fail(error, { inputPath, outputPath })
  }
}

/**
 * Markdown 转 HTML
 */
async function markdownToHtml(inputPath, outputPath) {
  try {
    const fullInput = resolvePath(inputPath)
    const fullOutput = resolvePath(outputPath)
    if (!fs.existsSync(fullInput)) {
      return fail(`File does not exist: ${fullInput}`, { inputPath: fullInput })
    }
    const md = fs.readFileSync(fullInput, 'utf8')
    const html = markdownToHtmlString(md)
    fs.ensureDirSync(path.dirname(fullOutput))
    fs.writeFileSync(fullOutput, html, 'utf8')
    return ok({ inputPath: fullInput, outputPath: fullOutput })
  } catch (error) {
    return fail(error, { inputPath, outputPath })
  }
}

// ─── 工具描述 ─────────────────────────────────────────────────────────────────

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'markdownToPdf',
      description:
        '将 Markdown 文件（.md）转换为 PDF 文件。依赖 puppeteer，转换时应用默认样式。参数：inputPath 为源 .md 路径；outputPath 为输出 .pdf 路径。返回值：对象，包含 success、data（含 inputPath、outputPath）、error。',
      parameters: {
        type: 'object',
        properties: {
          inputPath: { type: 'string', description: '源 .md 文件路径。' },
          outputPath: { type: 'string', description: '输出 .pdf 文件路径。' },
        },
        required: ['inputPath', 'outputPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'markdownToHtml',
      description:
        '将 Markdown 文件（.md）转换为 HTML 文件，包含内联样式，可直接在浏览器中打开。参数：inputPath 为源 .md 路径；outputPath 为输出 .html 路径。返回值：对象，包含 success、data（含 inputPath、outputPath）、error。',
      parameters: {
        type: 'object',
        properties: {
          inputPath: { type: 'string', description: '源 .md 文件路径。' },
          outputPath: { type: 'string', description: '输出 .html 文件路径。' },
        },
        required: ['inputPath', 'outputPath'],
      },
    },
  },
]

// ─── 导出 ──────────────────────────────────────────────────────────────────────

const functions = {
  markdownToPdf,
  markdownToHtml,
}

const DocTransformTool = {
  name: 'DocTransformTool',
  description: '提供 Markdown 与 HTML/PDF 之间的格式互转能力，支持 markdown转pdf、markdown转html。Word 相关转换请使用 DocxTool。',
  platform: 'all',
  descriptions,
  functions,
  isSystem: true
}

module.exports = DocTransformTool
