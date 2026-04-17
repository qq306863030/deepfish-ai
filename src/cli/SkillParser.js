const fs = require('fs-extra')
const path = require('path')
const yaml = require('js-yaml')

function extractFrontmatter(content, skillPath) {
  // Support UTF-8 BOM and both LF/CRLF line endings.
  const normalizedContent = content.replace(/^\uFEFF/, '');
  const frontmatterMatch = normalizedContent.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!frontmatterMatch) {
    throw new Error(`No frontmatter found in ${skillPath}`);
  }

  return frontmatterMatch[1];
}

function parseSkillMetadata(skillPath) {
  const content = fs.readFileSync(skillPath, 'utf-8');

  const frontmatter = extractFrontmatter(content, skillPath);
  const metadata = {};
  
  // 解析 key: value 或 key: "quoted value"
  const lines = frontmatter.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      // 去除引号
      metadata[key] = value.replace(/^["']|["']$/g, '');
    }
  }
  
  return {
    name: metadata.name,
    description: metadata.description,
    homepage: metadata.homepage,
    location: path.dirname(skillPath),
    skillFilePath: skillPath,
    metadata: metadata.metadata || {}
  };
}

function parseSkillMetadataYaml(skillPath) {
  const content = fs.readFileSync(skillPath, 'utf-8');
  const frontmatterContent = extractFrontmatter(content, skillPath);
  const frontmatter = yaml.load(frontmatterContent);
  
  return {
    name: frontmatter.name,
    description: frontmatter.description,
    homepage: frontmatter.homepage,
    location: path.dirname(skillPath),
    metadata: frontmatter.metadata || {},
    skillFilePath: skillPath,
  };
}

module.exports = { parseSkillMetadata, parseSkillMetadataYaml }
