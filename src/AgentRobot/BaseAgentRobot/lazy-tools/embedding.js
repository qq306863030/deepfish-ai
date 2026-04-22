const path = require('path')
const os = require('os')
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

// 获取配置地址
function _getConfigFilePath() {
  const configDir = path.join(os.homedir(), './.deepfish-ai')
  const configPath = path.join(configDir, './config.js')
  return configPath
}

function _loadConfig(configPath) {
  fs.ensureDirSync(path.dirname(configPath))
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, 'module.exports = {}')
  }
  const resolved = require.resolve(configPath)
  delete require.cache[resolved]
  return require(configPath)
}

function _getKbRootPath(knowledgeBasePath = '') {
  return path.resolve(process.cwd(), knowledgeBasePath || '.deepfish-rag')
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

function _getEmptyKnowledgeBase(kbRootPath) {
  const now = new Date().toISOString()
  return {
    version: 1,
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
  return {
    ..._getEmptyKnowledgeBase(kbRootPath),
    ...parsed,
    kbRootPath,
  }
}

function _saveKnowledgeBase(kbRootPath, knowledgeBase) {
  const indexPath = _getKbIndexPath(kbRootPath)
  knowledgeBase.updatedAt = new Date().toISOString()
  fs.writeFileSync(indexPath, JSON.stringify(knowledgeBase, null, 2), 'utf8')
}

function _chunkText(content = '', chunkSize = 800, overlap = 120) {
  const text = String(content || '')
  const size = Math.max(200, Number(chunkSize) || 800)
  const overlapSize = Math.max(0, Math.min(size - 1, Number(overlap) || 120))
  const step = Math.max(1, size - overlapSize)
  const chunks = []
  for (let i = 0; i < text.length; i += step) {
    const chunk = text.slice(i, i + size)
    if (!chunk.trim()) continue
    chunks.push({
      offsetStart: i,
      offsetEnd: i + chunk.length,
      content: chunk,
    })
    if (i + size >= text.length) {
      break
    }
  }
  return chunks
}

function _calcKeywordScore(content = '', keyword = '') {
  if (!keyword) return 0
  const src = String(content || '').toLowerCase()
  const kw = String(keyword || '').toLowerCase()
  let count = 0
  let fromIndex = 0
  while (true) {
    const idx = src.indexOf(kw, fromIndex)
    if (idx < 0) break
    count += 1
    fromIndex = idx + kw.length
  }
  return count
}

// 获取向量化配置
async function getEmbeddingConfig() {
  const configPath = _getConfigFilePath()
  const config = _loadConfig(configPath)
  if (!config.EMBEDDING_API) {
    // 提示用户输入
    const res = await aiInquirer.askInput('请输入向量化接口地址', '', {})
    if (res) {
        config.EMBEDDING_API = res
        setEmbeddingConfig(config.EMBEDDING_API, config.EMBEDDING_API_KEY)
    }
  }
  if (!config.EMBEDDING_API_KEY) {
    // 提示用户输入
    const res = await aiInquirer.askInput('请输入向量化接口密钥', '', {})
    if (res) {
        config.EMBEDDING_API_KEY = res
        setEmbeddingConfig(config.EMBEDDING_API, config.EMBEDDING_API_KEY)
    }
  }
  return {
    EMBEDDING_API: config.EMBEDDING_API || '',
    EMBEDDING_API_KEY: config.EMBEDDING_API_KEY || '',
  }
}

// 写入向量化配置
function setEmbeddingConfig(embeddingApi, embeddingApiKey) {
  const configPath = _getConfigFilePath()
  const config = _loadConfig(configPath)
  const newConfig = {
    ...config,
    EMBEDDING_API: embeddingApi,
    EMBEDDING_API_KEY: embeddingApiKey,
  }
  fs.writeFileSync(configPath, `module.exports = ${JSON.stringify(newConfig, null, 2)}`)
  return ok({
    configPath,
    EMBEDDING_API: embeddingApi || '',
    EMBEDDING_API_KEY: embeddingApiKey || '',
  })
}

// 创建/续加知识库，默认路径为命令执行目录下 .deepfish-rag
async function buildKnowledgeBase(sourcePath = '', knowledgeBasePath = '') {
  try {
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
    const knowledgeBase = _loadKnowledgeBase(kbRootPath)
    const sourceFiles = _collectSourceFiles(resolvedSourcePath)

    const supportedFiles = sourceFiles.filter((filePath) => _isSupportedFile(filePath))
    let addedCount = 0
    let updatedCount = 0
    let skippedCount = 0

    for (const filePath of supportedFiles) {
      try {
        const content = await _readDocumentContent(filePath)
        if (!content || !content.trim()) {
          skippedCount += 1
          continue
        }

        const sourceHash = _sha256(content)
        const existingIndex = knowledgeBase.documents.findIndex((item) => item.sourcePath === filePath)
        if (existingIndex >= 0) {
          if (knowledgeBase.documents[existingIndex].sourceHash === sourceHash) {
            skippedCount += 1
            continue
          }
          knowledgeBase.documents[existingIndex] = {
            ...knowledgeBase.documents[existingIndex],
            sourceHash,
            size: Buffer.byteLength(content, 'utf8'),
            content,
            updatedAt: new Date().toISOString(),
          }
          updatedCount += 1
          continue
        }

        knowledgeBase.documents.push({
          id: _sha256(filePath).slice(0, 16),
          sourcePath: filePath,
          sourceHash,
          size: Buffer.byteLength(content, 'utf8'),
          content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
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
  } catch (error) {
    return fail(error, { sourcePath, knowledgeBasePath })
  }
}

// 读取知识库文档摘要，支持关键词检索
function readKnowledgeBase(keyword = '', knowledgeBasePath = '', limit = 10) {
  try {
    const kbRootPath = _getKbRootPath(knowledgeBasePath)
    const knowledgeBase = _loadKnowledgeBase(kbRootPath)
    const normalizedKeyword = (keyword || '').trim().toLowerCase()
    const maxResult = Number(limit) > 0 ? Number(limit) : 10

    const filtered = knowledgeBase.documents.filter((item) => {
      if (!normalizedKeyword) return true
      return (
        item.sourcePath.toLowerCase().includes(normalizedKeyword) ||
        item.content.toLowerCase().includes(normalizedKeyword)
      )
    })

    const result = filtered.slice(0, maxResult).map((item) => ({
      id: item.id,
      sourcePath: item.sourcePath,
      size: item.size,
      updatedAt: item.updatedAt,
      preview: (item.content || '').slice(0, 240),
    }))

    return ok({
      knowledgeBasePath: kbRootPath,
      totalDocuments: knowledgeBase.documents.length,
      matchedDocuments: filtered.length,
      items: result,
    })
  } catch (error) {
    return fail(error, { keyword, knowledgeBasePath, limit })
  }
}

// 按文档ID读取完整内容
function readKnowledgeBaseDocument(documentId, knowledgeBasePath = '') {
  try {
    if (!documentId) {
      return fail('documentId is required')
    }
    const kbRootPath = _getKbRootPath(knowledgeBasePath)
    const knowledgeBase = _loadKnowledgeBase(kbRootPath)
    const doc = knowledgeBase.documents.find((item) => item.id === documentId)
    if (!doc) {
      return fail(`Document not found: ${documentId}`, {
        documentId,
        knowledgeBasePath: kbRootPath,
      })
    }
    return ok({
      id: doc.id,
      sourcePath: doc.sourcePath,
      size: doc.size,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      content: doc.content,
    })
  } catch (error) {
    return fail(error, { documentId, knowledgeBasePath })
  }
}

// 按分块检索知识库内容，适用于后续RAG召回
function searchKnowledgeBaseChunks(keyword = '', knowledgeBasePath = '', chunkSize = 800, overlap = 120, limit = 10) {
  try {
    const normalizedKeyword = (keyword || '').trim()
    if (!normalizedKeyword) {
      return fail('keyword is required')
    }

    const kbRootPath = _getKbRootPath(knowledgeBasePath)
    const knowledgeBase = _loadKnowledgeBase(kbRootPath)
    const maxResult = Number(limit) > 0 ? Number(limit) : 10
    const allChunks = []

    for (const doc of knowledgeBase.documents) {
      const chunks = _chunkText(doc.content || '', chunkSize, overlap)
      chunks.forEach((chunk, index) => {
        const score = _calcKeywordScore(chunk.content, normalizedKeyword)
        if (score > 0) {
          allChunks.push({
            documentId: doc.id,
            sourcePath: doc.sourcePath,
            chunkIndex: index,
            offsetStart: chunk.offsetStart,
            offsetEnd: chunk.offsetEnd,
            score,
            content: chunk.content,
          })
        }
      })
    }

    const items = allChunks
      .sort((a, b) => b.score - a.score || a.sourcePath.localeCompare(b.sourcePath) || a.chunkIndex - b.chunkIndex)
      .slice(0, maxResult)

    return ok({
      knowledgeBasePath: kbRootPath,
      keyword: normalizedKeyword,
      totalMatchedChunks: allChunks.length,
      items,
    })
  } catch (error) {
    return fail(error, { keyword, knowledgeBasePath, chunkSize, overlap, limit })
  }
}

// 读取知识库统计信息
function getKnowledgeBaseInfo(knowledgeBasePath = '') {
  try {
    const kbRootPath = _getKbRootPath(knowledgeBasePath)
    const knowledgeBase = _loadKnowledgeBase(kbRootPath)
    return ok({
      knowledgeBasePath: kbRootPath,
      version: knowledgeBase.version,
      name: knowledgeBase.name,
      createdAt: knowledgeBase.createdAt,
      updatedAt: knowledgeBase.updatedAt,
      totalDocuments: knowledgeBase.documents.length,
      sourceHistory: knowledgeBase.sourceHistory,
    })
  } catch (error) {
    return fail(error, { knowledgeBasePath })
  }
}

// 删除知识库目录
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

// 先删除再重建知识库
async function rebuildKnowledgeBase(sourcePath = '', knowledgeBasePath = '') {
  try {
    const deleteResult = deleteKnowledgeBase(knowledgeBasePath)
    if (!deleteResult.success) {
      return deleteResult
    }
    return await buildKnowledgeBase(sourcePath, knowledgeBasePath)
  } catch (error) {
    return fail(error, { sourcePath, knowledgeBasePath })
  }
}

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'getEmbeddingConfig',
      description: '读取向量化接口配置（EMBEDDING_API 与 EMBEDDING_API_KEY）。如未配置，会提示用户输入并写入配置文件。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setEmbeddingConfig',
      description: '写入向量化接口配置，保存 EMBEDDING_API 与 EMBEDDING_API_KEY 到配置文件。',
      parameters: {
        type: 'object',
        properties: {
          embeddingApi: { type: 'string', description: '向量化接口地址' },
          embeddingApiKey: { type: 'string', description: '向量化接口密钥' },
        },
        required: ['embeddingApi', 'embeddingApiKey'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buildKnowledgeBase',
      description: '创建或续加知识库。默认知识库路径为命令执行目录下的 .deepfish-rag。sourcePath 为空时会提示用户输入源文件目录或文件路径。',
      parameters: {
        type: 'object',
        properties: {
          sourcePath: { type: 'string', description: '源文件目录或文件路径。为空时会交互输入。' },
          knowledgeBasePath: { type: 'string', description: '知识库目录路径，默认 .deepfish-rag（相对命令执行目录）。' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'readKnowledgeBase',
      description: '读取知识库中的文档摘要，支持关键词过滤。可用于快速检索知识库内容。',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '关键词，不传表示返回全部文档摘要。' },
          knowledgeBasePath: { type: 'string', description: '知识库目录路径，默认 .deepfish-rag。' },
          limit: { type: 'number', description: '返回条数上限，默认 10。' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'readKnowledgeBaseDocument',
      description: '按文档ID读取知识库中的完整文档内容。',
      parameters: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: '文档ID（由 buildKnowledgeBase 生成）。' },
          knowledgeBasePath: { type: 'string', description: '知识库目录路径，默认 .deepfish-rag。' },
        },
        required: ['documentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getKnowledgeBaseInfo',
      description: '读取知识库元信息与历史加载记录（sourceHistory）。',
      parameters: {
        type: 'object',
        properties: {
          knowledgeBasePath: { type: 'string', description: '知识库目录路径，默认 .deepfish-rag。' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchKnowledgeBaseChunks',
      description: '对知识库进行分块检索，返回命中关键词的文本块（chunk），用于RAG召回。',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '检索关键词。' },
          knowledgeBasePath: { type: 'string', description: '知识库目录路径，默认 .deepfish-rag。' },
          chunkSize: { type: 'number', description: '分块长度，默认 800。' },
          overlap: { type: 'number', description: '分块重叠长度，默认 120。' },
          limit: { type: 'number', description: '返回数量上限，默认 10。' },
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
        properties: {
          knowledgeBasePath: { type: 'string', description: '知识库目录路径，默认 .deepfish-rag。' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rebuildKnowledgeBase',
      description: '重建知识库：先删除原知识库，再从源目录/文件重新构建。',
      parameters: {
        type: 'object',
        properties: {
          sourcePath: { type: 'string', description: '源文件目录或文件路径。为空时会交互输入。' },
          knowledgeBasePath: { type: 'string', description: '知识库目录路径，默认 .deepfish-rag。' },
        },
        required: [],
      },
    },
  },
]

const functions = {
  getEmbeddingConfig,
  setEmbeddingConfig,
  buildKnowledgeBase,
  readKnowledgeBase,
  readKnowledgeBaseDocument,
  getKnowledgeBaseInfo,
  searchKnowledgeBaseChunks,
  deleteKnowledgeBase,
  rebuildKnowledgeBase,
}

const EmbeddingTool = {
  name: 'EmbeddingTool',
  description: '提供向量化配置管理与本地知识库构建/读取能力，默认知识库路径为命令执行目录下的 .deepfish-rag',
  platform: 'all',
  descriptions,
  functions,
}

module.exports = EmbeddingTool



