const fs = require('fs-extra')
const path = require('path')
const yaml = require('js-yaml')

function parseSkillMetadata(skillPath) {
  const content = fs.readFileSync(skillPath, 'utf-8');
  
  // 提取 frontmatter (--- 之间的内容)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error(`No frontmatter found in ${skillPath}`);
  }
  
  const frontmatter = frontmatterMatch[1];
  const metadata = {};
  
  // 解析 key: value 或 key: "quoted value"
  const lines = frontmatter.split('\n');
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
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  
  if (!frontmatterMatch) {
    throw new Error(`No frontmatter found in ${skillPath}`);
  }
  
  const frontmatter = yaml.load(frontmatterMatch[1]);
  
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
