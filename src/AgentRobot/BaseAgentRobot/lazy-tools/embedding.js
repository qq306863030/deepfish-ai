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

// 知识库创建描述
function getKnowledgeBaseCreationDescription() {
  return `# Knowledge Base Creation Guide

## 目标
使用本工具在命令执行目录下创建或维护本地知识库（默认目录为 .deepfish-rag），并支持后续持续增量更新。

## 能完成的任务
1. 从用户给定的目录或文件加载文档内容，构建本地知识库。
2. 自动识别常见文本与文档格式（如 md、txt、json、js、pdf、docx、xlsx 等）。
3. 在重复导入时执行增量更新：
   - 内容未变化：跳过
   - 内容已变化：更新
   - 新文件：新增
4. 记录每次构建来源和统计信息（sourceHistory），方便审计和复盘。
5. 支持删除后重建，快速恢复知识库状态。

## 关键函数与协同关系

### 1) 构建层
- buildKnowledgeBase(sourcePath, knowledgeBasePath)
  - 创建或续加知识库的主入口。
  - sourcePath 为空时会交互式要求用户输入文件或目录。
  - 默认知识库路径为 process.cwd()/.deepfish-rag。

它在内部协同调用：
- _getKbRootPath：统一知识库目录解析。
- _loadKnowledgeBase：读取或初始化 index.json。
- _collectSourceFiles：展开目录得到文件集合。
- _isSupportedFile：过滤可处理文件类型。
- _readDocumentContent：按不同文件类型提取文本。
- _sha256：计算内容哈希，用于增量判断。
- _saveKnowledgeBase：保存最终索引。

### 2) 重建层
- deleteKnowledgeBase(knowledgeBasePath)
  - 删除现有知识库目录。
- rebuildKnowledgeBase(sourcePath, knowledgeBasePath)
  - 先删后建。
  - 典型用于“索引异常修复”或“结构升级后重建”。

## 推荐执行流程
1. 调用 buildKnowledgeBase 进行首次构建。
2. 后续补充文档时再次调用 buildKnowledgeBase（续加）。
3. 如需彻底刷新：调用 rebuildKnowledgeBase。
4. 构建完成后再进入检索阶段（read/search 系列函数）。

## 面向用户任务的协同策略
- 用户说“请把这个目录做成知识库”：
  - buildKnowledgeBase(目录路径)
- 用户说“继续把新资料加进去”：
  - buildKnowledgeBase(新目录路径)
- 用户说“从头重建”：
  - rebuildKnowledgeBase(目录路径)

## 结果校验建议
构建后建议检查：
1. getKnowledgeBaseInfo 的 totalDocuments 是否大于 0。
2. sourceHistory 是否新增一条构建记录。
3. addedCount / updatedCount / skippedCount 是否符合预期。
`
}

// 知识库检索描述
function getKnowledgeBaseRetrievalDescription() {
  return `# Knowledge Base Retrieval Guide

## 目标
从本地知识库中高效找到“相关文档”与“关键片段”，用于问答、总结、比对和后续 RAG 召回。

## 能完成的任务
1. 查看知识库总体状态与构建历史。
2. 按关键词筛选文档摘要，快速定位候选文档。
3. 按文档 ID 读取全文，进行精读分析。
4. 按分块检索返回命中片段，适合长文档场景。

## 关键函数与协同关系

### 1) 元信息确认
- getKnowledgeBaseInfo(knowledgeBasePath)
  - 获取总文档数、创建时间、更新时间、构建历史。
  - 作用：先判断库是否可用，再决定检索策略。

### 2) 粗粒度召回（文档级）
- readKnowledgeBase(keyword, knowledgeBasePath, limit)
  - 返回文档摘要（id、sourcePath、preview）。
  - 作用：先召回候选文档，缩小范围。

### 3) 细粒度阅读（全文级）
- readKnowledgeBaseDocument(documentId, knowledgeBasePath)
  - 读取指定文档全文。
  - 作用：对高价值候选文档做精读与引用。

### 4) 片段级召回（chunk级）
- searchKnowledgeBaseChunks(keyword, knowledgeBasePath, chunkSize, overlap, limit)
  - 将文档切块并按关键词命中分数排序。
  - 作用：在超长文档里快速找到最相关上下文。

它在内部协同调用：
- _chunkText：按 chunkSize + overlap 生成可检索片段。
- _calcKeywordScore：计算关键词命中次数并排序。

## 推荐检索流程
1. 调用 getKnowledgeBaseInfo，确认知识库可用。
2. 调用 readKnowledgeBase(keyword)，拿到候选文档列表。
3. 对重点文档调用 readKnowledgeBaseDocument 进行精读。
4. 若候选文档过大或命中不精确，调用 searchKnowledgeBaseChunks 做片段召回。
5. 将片段结果组织为回答证据，必要时回看全文补全上下文。

## 典型用户任务协同方案

### 场景 A：用户问“知识库里有没有某主题”
1. readKnowledgeBase(主题词)
2. 返回候选文档与预览

### 场景 B：用户问“请给出该主题的依据段落”
1. readKnowledgeBase(主题词)
2. searchKnowledgeBaseChunks(主题词)
3. 输出高分片段 + 源文件路径

### 场景 C：用户问“请基于某篇文档做总结”
1. readKnowledgeBase(文档名关键词)
2. readKnowledgeBaseDocument(documentId)
3. 对全文执行总结

## 检索参数建议
1. limit
   - 初筛推荐 5-20
2. chunkSize
   - 一般 600-1200
3. overlap
   - 一般 80-200
   - 过小可能断句，过大可能冗余

## 结果质量建议
1. 优先返回包含 sourcePath 与文档 ID 的证据。
2. 先文档级筛选，再 chunk 级定位，避免全库全文扫描输出过大。
3. 对高分片段做二次核对，防止关键词误命中。
`
}

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'getKnowledgeBaseCreationDescription',
      description: '知识库创建与续加的完整说明文档，包含可完成任务、函数协同关系与推荐执行流程。在执行知识库创建、续加或重建前，建议先阅读此文档以明确使用方法与注意事项。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getKnowledgeBaseRetrievalDescription',
      description: '知识库检索的完整说明文档，包含检索策略、函数协同关系与典型任务执行方案。在执行知识库检索前，建议先阅读此文档以明确使用方法与注意事项。',
      parameters: {
        type: 'object',
        properties: {},
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
  getKnowledgeBaseCreationDescription,
  getKnowledgeBaseRetrievalDescription,
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
  description: '提供本地知识库构建/读取能力，默认知识库路径为命令执行目录下的 .deepfish-rag',
  platform: 'all',
  descriptions,
  functions,
  isSystem: true
}

module.exports = EmbeddingTool



