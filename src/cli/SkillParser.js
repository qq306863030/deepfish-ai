const JSON5 = require('json5')

function parseFrontmatter(mdContent) {
  const normalized = String(mdContent || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  const result = {
    frontmatter: {},
    body: normalized,
  }
  if (!normalized.startsWith('---\n')) {
    return result
  }

  const endIndex = normalized.indexOf('\n---', 4)
  if (endIndex === -1) {
    return result
  }

  const block = normalized.slice(4, endIndex)
  const bodyStart = endIndex + 4
  const body = normalized.slice(bodyStart).replace(/^\n/, '')
  const lines = block.split('\n')
  const frontmatter = {}
  let currentKey = ''

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (keyMatch) {
      const key = keyMatch[1].trim()
      const inlineValue = this._stripQuotes(keyMatch[2].trim())
      frontmatter[key] = inlineValue
      currentKey = key
      continue
    }

    const isIndented = line.startsWith(' ') || line.startsWith('\t')
    if (isIndented && currentKey) {
      const appendValue = line.trim()
      frontmatter[currentKey] = frontmatter[currentKey]
        ? `${frontmatter[currentKey]}\n${appendValue}`
        : appendValue
    }
  }

  result.frontmatter = frontmatter
  result.body = body
  return result
}

function parseMetadata(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined
  }

  try {
    const parsed = JSON5.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : undefined
  } catch (error) {
    return undefined
  }
}

module.exports = {
  parseFrontmatter,
  parseMetadata
}
