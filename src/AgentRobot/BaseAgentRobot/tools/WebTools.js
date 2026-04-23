const axios = require('axios')
const cheerio = require('cheerio')
const puppeteer = require('puppeteer')

function ok(data = null) {
  return { success: true, data }
}

function fail(error, data = null) {
  return { success: false, error: error?.message || String(error), data }
}

function normalizeWhitespace(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function absoluteUrl(baseUrl, href = '') {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return href
  }
}

function extractByCheerio(html = '', url = '') {
  const $ = cheerio.load(html)
  $('script, style, noscript').remove()

  const title = normalizeWhitespace($('title').first().text())
  const bodyText = normalizeWhitespace($('body').text())
  const metaDescription = normalizeWhitespace(
    $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '',
  )

  const links = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const text = normalizeWhitespace($(el).text())
    if (!href) return
    links.push({
      href: absoluteUrl(url, href),
      text,
    })
  })

  return {
    title,
    description: metaDescription,
    content: bodyText,
    links,
  }
}

async function fetchStatic(url, timeout = 15000) {
  const response = await axios.get(url, {
    timeout,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 DeepFish-MCP-Web/1.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })
  return response.data
}

async function fetchDynamic(url, waitUntil = 'networkidle2', timeout = 30000) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil, timeout })
    return await page.content()
  } finally {
    await browser.close()
  }
}

async function mcpBrowseWebpage(url, mode = 'auto', maxChars = 4000) {
  try {
    if (!url) {
      return fail('url is required')
    }

    let html = ''
    let resolvedMode = mode

    if (mode === 'dynamic') {
      html = await fetchDynamic(url)
    } else if (mode === 'static') {
      html = await fetchStatic(url)
    } else {
      try {
        html = await fetchStatic(url)
        resolvedMode = 'static'
      } catch {
        html = await fetchDynamic(url)
        resolvedMode = 'dynamic'
      }
    }

    const parsed = extractByCheerio(html, url)
    const content = parsed.content.slice(0, Number(maxChars) > 0 ? Number(maxChars) : 4000)
    const links = parsed.links.slice(0, 50)

    return ok({
      url,
      mode: resolvedMode,
      title: parsed.title,
      description: parsed.description,
      content,
      contentLength: parsed.content.length,
      links,
      linkCount: parsed.links.length,
    })
  } catch (error) {
    return fail(error, { url, mode, maxChars })
  }
}

async function mcpFetchWebpageByQuery(url, query, mode = 'auto', limit = 20) {
  try {
    if (!url) {
      return fail('url is required')
    }
    if (!query) {
      return fail('query is required')
    }

    const browseResult = await mcpBrowseWebpage(url, mode, 200000)
    if (!browseResult.success) {
      return browseResult
    }

    const keyword = String(query).toLowerCase().trim()
    const rawContent = browseResult.data.content || ''
    const sentences = rawContent
      .split(/[。！？.!?\n]/)
      .map((item) => normalizeWhitespace(item))
      .filter(Boolean)

    const matchedSentences = sentences
      .map((text) => {
        const lower = text.toLowerCase()
        let score = 0
        let fromIndex = 0
        while (true) {
          const idx = lower.indexOf(keyword, fromIndex)
          if (idx < 0) break
          score += 1
          fromIndex = idx + keyword.length
        }
        return { text, score }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Number(limit) > 0 ? Number(limit) : 20)

    const matchedLinks = (browseResult.data.links || [])
      .filter((item) => {
        const href = String(item.href || '').toLowerCase()
        const text = String(item.text || '').toLowerCase()
        return href.includes(keyword) || text.includes(keyword)
      })
      .slice(0, Number(limit) > 0 ? Number(limit) : 20)

    return ok({
      url,
      query,
      mode: browseResult.data.mode,
      title: browseResult.data.title,
      matchedSentenceCount: matchedSentences.length,
      matchedLinkCount: matchedLinks.length,
      matchedSentences,
      matchedLinks,
    })
  } catch (error) {
    return fail(error, { url, query, mode, limit })
  }
}

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'mcpBrowseWebpage',
      description:
        'MCP网页浏览: 打开并抓取任意网页的标题、摘要正文与链接列表。适合快速浏览网页内容。',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: '要浏览的网页地址（http或https）。',
          },
          mode: {
            type: 'string',
            description: '抓取模式：auto|static|dynamic。默认auto。',
          },
          maxChars: {
            type: 'number',
            description: '返回正文最大字符数，默认4000。',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mcpFetchWebpageByQuery',
      description:
        'MCP网页抓取: 按关键词从网页正文和链接中提取匹配内容，返回高相关片段。',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: '目标网页地址（http或https）。',
          },
          query: {
            type: 'string',
            description: '要匹配的关键词。',
          },
          mode: {
            type: 'string',
            description: '抓取模式：auto|static|dynamic。默认auto。',
          },
          limit: {
            type: 'number',
            description: '返回匹配结果上限，默认20。',
          },
        },
        required: ['url', 'query'],
      },
    },
  },
]

const functions = {
  mcpBrowseWebpage,
  mcpFetchWebpageByQuery,
}

const MCPWebTool = {
  name: 'MCPWebTool',
  description: '提供网页浏览与内容抓取能力，支持任意网页的读取与关键词提取。',
  platform: 'all',
  descriptions,
  functions,
  isSystem: true
}

module.exports = MCPWebTool
