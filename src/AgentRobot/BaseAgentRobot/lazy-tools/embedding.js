const path = require('path')
const fs = require('fs-extra')
const crypto = require('crypto')
const mammoth = require('mammoth')
const pdfParse = require('pdf-parse')
const XLSX = require('xlsx')
const aiInquirer = require('../utils/aiInquirer')

function ok(data = null) {
  return { success: true, data }
}

function fail(error, data = null) {
  return { success: false, error: error?.message || String(error), data }
}

function _getKbRootPath() {
  return path.resolve(process.cwd(), '.deepfish-rag')
}

function _getKbIndexPath(kbRootPath) {
  return path.join(kbRootPath, 'index.json')
}

function _sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

function _isSupportedFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const supportedExts = new Set([
    '.md', '.txt', '.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.htm', '.css', '.scss', '.less', '.xml', '.yaml', '.yml', '.csv', '.log', '.sql', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.h', '.docx', '.pdf', '.xlsx', '.xls',
  ])
  return supportedExts.has(ext)
}

function _collectSourceFiles(sourcePath) {
  const stat = fs.statSync(sourcePath)
  if (stat.isFile()) {
    return [sourcePath]
  }
  const files = []
  const walk = (current) => {
    const children = fs.readdirSync(current)
    for (const child of children) {
      const fullPath = path.join(current, child)
      const childStat = fs.statSync(fullPath)
      if (childStat.isDirectory()) {
        walk(fullPath)
      } else if (childStat.isFile()) {
        files.push(fullPath)
      }
    }
  }
  walk(sourcePath)
  return files
}

async function _readDocumentContent(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value || ''
  }
  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath)
    const result = await pdfParse(buffer)
    return result.text || ''
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath)
    return workbook.SheetNames.map((sheetName) => {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 })
      return [`# ${sheetName}`, ...rows.map((row) => row.join(' | '))].join('\n')
    }).join('\n\n')
  }
  return fs.readFileSync(filePath, 'utf8')
}

function _normalizeText(content = '') {
  return String(content || '').replace(/\s+/g, ' ').trim()
}

function _buildSummary(content = '', maxLen = 320) {
  const normalized = _normalizeText(content)
  if (!normalized) return ''
  if (normalized.length <= maxLen) return normalized
  return `${normalized.slice(0, maxLen)}...`
}

async function _extractSummary(content = '', maxLen = 320, absolutePath = '') {
  const fallbackSummary = _buildSummary(content, maxLen)
  if (!fallbackSummary) return ''

  if (!this?.Tools?.requestAI) {
    return fallbackSummary
  }

  const systemDescription = '你是文档摘要助手，只输出简洁摘要正文，不要解释。'
  const prompt = `请为下面文档提取摘要：\n\n文档路径：${absolutePath || '未知'}\n文档内容：\n${content}\n\n要求：\n1. 输出中文摘要，保留关键事实与结论。\n2. 摘要长度不超过${maxLen}个字符。\n3. 不要输出标题、前后缀或解释，只输出摘要正文。`

  try {
    const aiSummary = await this.Tools.requestAI(systemDescription, prompt, 0.2)
    if (typeof aiSummary !== 'string') {
      return fallbackSummary
    }
    const normalizedSummary = _normalizeText(aiSummary)
    if (!normalizedSummary) {
      return fallbackSummary
    }
    return normalizedSummary.length > maxLen
      ? `${normalizedSummary.slice(0, maxLen)}...`
      : normalizedSummary
  } catch {
    return fallbackSummary
  }
}

function _getEmptyKnowledgeBase(kbRootPath) {
  const now = new Date().toISOString()
  return {
    version: 2,
    name: 'deepfish-rag',
    kbRootPath,
    createdAt: now,
    updatedAt: now,
    sourceHistory: [],
    documents: [],
  }
}

function _loadKnowledgeBase(kbRootPath) {
  const indexPath = _getKbIndexPath(kbRootPath)
  fs.ensureDirSync(kbRootPath)
  if (!fs.existsSync(indexPath)) {
    const emptyKb = _getEmptyKnowledgeBase(kbRootPath)
    fs.writeFileSync(indexPath, JSON.stringify(emptyKb, null, 2), 'utf8')
    return emptyKb
  }

  const content = fs.readFileSync(indexPath, 'utf8')
  const parsed = JSON.parse(content)
  const base = {
    ..._getEmptyKnowledgeBase(kbRootPath),
    ...parsed,
    kbRootPath,
  }

  // 向后兼容旧结构：若旧数据里有content，则在加载时迁移为summary。
  base.documents = (base.documents || []).map((doc) => {
    const absolutePath = path.resolve(doc.absolutePath || doc.sourcePath || '')
    return {
      id: doc.id || _sha256(absolutePath).slice(0, 16),
      absolutePath,
      sourceHash: doc.sourceHash || '',
      size: doc.size || 0,
      summary: doc.summary || _buildSummary(doc.content || ''),
      createdAt: doc.createdAt || base.createdAt,
      updatedAt: doc.updatedAt || base.updatedAt,
    }
  })

  return base
}

function _saveKnowledgeBase(kbRootPath, knowledgeBase) {
  const indexPath = _getKbIndexPath(kbRootPath)
  knowledgeBase.updatedAt = new Date().toISOString()
  fs.writeFileSync(indexPath, JSON.stringify(knowledgeBase, null, 2), 'utf8')
}

async function _upsertKnowledgeBase(sourcePath = '', knowledgeBasePath = '', reset = false) {
  const inputSourcePath = sourcePath || (await aiInquirer.askInput('请输入源文件目录或文件路径', '', {}))
  if (!inputSourcePath) {
    return fail('未提供源文件目录或文件路径')
  }

  const resolvedSourcePath = path.resolve(process.cwd(), inputSourcePath)
  if (!fs.existsSync(resolvedSourcePath)) {
    return fail(`Source path does not exist: ${resolvedSourcePath}`, {
      sourcePath: resolvedSourcePath,
    })
  }

  const kbRootPath = _getKbRootPath(knowledgeBasePath)
  if (reset && fs.existsSync(kbRootPath)) {
    fs.removeSync(kbRootPath)
  }

  const knowledgeBase = _loadKnowledgeBase(kbRootPath)
  const sourceFiles = _collectSourceFiles(resolvedSourcePath)
  const supportedFiles = sourceFiles.filter((filePath) => _isSupportedFile(filePath))

  let addedCount = 0
  let updatedCount = 0
  let skippedCount = 0

  for (const filePath of supportedFiles) {
    try {
      const absolutePath = path.resolve(filePath)
      const content = await _readDocumentContent(absolutePath)
      if (!content || !content.trim()) {
        skippedCount += 1
        continue
      }

      const sourceHash = _sha256(content)
      const existingIndex = knowledgeBase.documents.findIndex((item) => item.absolutePath === absolutePath)

      if (existingIndex >= 0) {
        if (knowledgeBase.documents[existingIndex].sourceHash === sourceHash) {
          skippedCount += 1
          continue
        }

        const summary = await _extractSummary.call(this, content, 320, absolutePath)

        knowledgeBase.documents[existingIndex] = {
          ...knowledgeBase.documents[existingIndex],
          sourceHash,
          size: Buffer.byteLength(content, 'utf8'),
          summary,
          updatedAt: new Date().toISOString(),
        }
        _saveKnowledgeBase(kbRootPath, knowledgeBase)
        updatedCount += 1
        continue
      }

      const summary = await _extractSummary.call(this, content, 320, absolutePath)

      knowledgeBase.documents.push({
        id: _sha256(absolutePath).slice(0, 16),
        absolutePath,
        sourceHash,
        size: Buffer.byteLength(content, 'utf8'),
        summary,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      _saveKnowledgeBase(kbRootPath, knowledgeBase)
      addedCount += 1
    } catch {
      skippedCount += 1
    }
  }

  knowledgeBase.sourceHistory.push({
    sourcePath: resolvedSourcePath,
    loadedAt: new Date().toISOString(),
    scannedFiles: sourceFiles.length,
    supportedFiles: supportedFiles.length,
    addedCount,
    updatedCount,
    skippedCount,
    mode: reset ? 'create' : 'append',
  })

  _saveKnowledgeBase(kbRootPath, knowledgeBase)

  return ok({
    knowledgeBasePath: kbRootPath,
    sourcePath: resolvedSourcePath,
    scannedFiles: sourceFiles.length,
    supportedFiles: supportedFiles.length,
    addedCount,
    updatedCount,
    skippedCount,
    totalDocuments: knowledgeBase.documents.length,
  })
}

async function createKnowledgeBase(sourcePath = '', knowledgeBasePath = '') {
  try {
    return await _upsertKnowledgeBase.call(this, sourcePath, knowledgeBasePath, true)
  } catch (error) {
    return fail(error, { sourcePath, knowledgeBasePath })
  }
}

async function appendKnowledgeBase(sourcePath = '', knowledgeBasePath = '') {
  try {
    return await _upsertKnowledgeBase.call(this, sourcePath, knowledgeBasePath, false)
  } catch (error) {
    return fail(error, { sourcePath, knowledgeBasePath })
  }
}

function _matchSummary(knowledgeBase, normalizedKeyword = '', maxResult = 10) {
  const filtered = knowledgeBase.documents.filter((item) => {
    if (!normalizedKeyword) return true
    const haystack = `${item.absolutePath || ''} ${item.summary || ''}`.toLowerCase()
    return haystack.includes(normalizedKeyword)
  })

  return filtered.slice(0, maxResult).map((item) => ({
    id: item.id,
    absolutePath: item.absolutePath,
    size: item.size,
    updatedAt: item.updatedAt,
    summary: item.summary,
  }))
}

async function _queryBySubAgent(keyword, summaryMatches, includeFullDocument = false) {
  if (!this?.Tools?.createSubAgent) {
    return {
      success: false,
      skipped: true,
      reason: 'createSubAgent tool is unavailable in current context',
    }
  }

  const prompt = `你是知识库检索子agent，请完成文档检索。

用户关键词：${keyword}
是否允许读取全文：${includeFullDocument ? '是' : '否（仅在必要时）'}
候选文档（按摘要初筛后）如下：
${JSON.stringify(summaryMatches, null, 2)}

执行要求：
1. 先使用候选文档的summary进行关键词匹配和排序。
2. 当summary不足以回答问题时，再读取对应absolutePath的完整文档内容进行补充。
3. 输出结构化结果，必须包含：
   - 命中文档列表（id、absolutePath、匹配原因）
   - 最终结论
   - 若读取全文，列出已读取的absolutePath。
`

  return this.Tools.createSubAgent(prompt)
}

async function queryKnowledgeBase(keyword = '', knowledgeBasePath = '', limit = 10, includeFullDocument = false) {
  try {
    const normalizedKeyword = String(keyword || '').trim().toLowerCase()
    if (!normalizedKeyword) {
      return fail('keyword is required')
    }

    const kbRootPath = _getKbRootPath(knowledgeBasePath)
    const knowledgeBase = _loadKnowledgeBase(kbRootPath)
    const maxResult = Number(limit) > 0 ? Number(limit) : 10
    const summaryMatches = _matchSummary(knowledgeBase, normalizedKeyword, maxResult)

    let subAgentResult = null
    if (summaryMatches.length > 0) {
      subAgentResult = await _queryBySubAgent.call(this, keyword, summaryMatches, includeFullDocument)
    }

    return ok({
      knowledgeBasePath: kbRootPath,
      keyword,
      totalDocuments: knowledgeBase.documents.length,
      matchedDocuments: summaryMatches.length,
      items: summaryMatches,
      subAgentResult,
    })
  } catch (error) {
    return fail(error, { keyword, knowledgeBasePath, limit, includeFullDocument })
  }
}

function deleteKnowledgeBase(knowledgeBasePath = '') {
  try {
    const kbRootPath = _getKbRootPath(knowledgeBasePath)
    if (!fs.existsSync(kbRootPath)) {
      return ok({
        knowledgeBasePath: kbRootPath,
        deleted: false,
        message: 'knowledge base path not found',
      })
    }

    fs.removeSync(kbRootPath)
    return ok({
      knowledgeBasePath: kbRootPath,
      deleted: true,
    })
  } catch (error) {
    return fail(error, { knowledgeBasePath })
  }
}

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'createKnowledgeBase',
      description: '创建知识库（先删除旧库再重建），存储文档绝对路径和约300字摘要。',
      parameters: {
        type: 'object',
        properties: {
          sourcePath: { type: 'string', description: '源文件目录或文件路径。为空时会交互输入。' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'appendKnowledgeBase',
      description: '续加知识库（增量导入），存储文档绝对路径和约300字摘要。',
      parameters: {
        type: 'object',
        properties: {
          sourcePath: { type: 'string', description: '源文件目录或文件路径。为空时会交互输入。' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'queryKnowledgeBase',
      description: '查询知识库：先按摘要匹配关键词，再由子agent在必要时读取命中文档的完整内容。',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '检索关键词。' },
          limit: { type: 'number', description: '返回数量上限，默认 10。' },
          includeFullDocument: { type: 'boolean', description: '是否允许子agent读取全文，默认 false。' },
        },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteKnowledgeBase',
      description: '删除知识库目录（默认删除命令执行目录下的 .deepfish-rag）。',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
]

const functions = {
  createKnowledgeBase,
  appendKnowledgeBase,
  queryKnowledgeBase,
  deleteKnowledgeBase,
}

const EmbeddingTool = {
  name: 'EmbeddingTool',
  description: '提供本地知识库创建、续加、查询、删除能力（索引仅存摘要和绝对路径）',
  platform: 'all',
  descriptions,
  functions,
  isSystem: true
}

module.exports = EmbeddingTool
