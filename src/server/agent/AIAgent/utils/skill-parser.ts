const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');

export type SkillMetadata = {
  name: string;
  description: string;
  homepage: string;
  location: string;
  metadata: Record<string, any>;
  skillFilePath: string;
};

function extractFrontmatter(content: string, skillPath: string) {
  // Support UTF-8 BOM and both LF/CRLF line endings.
  const normalizedContent = content.replace(/^\uFEFF/, '');
  const frontmatterMatch = normalizedContent.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!frontmatterMatch) {
    throw new Error(`No frontmatter found in ${skillPath}`);
  }

  return frontmatterMatch[1];
}

export function parseSkillMetadataYaml(skillPath: string): SkillMetadata {
  const content = fs.readFileSync(skillPath, 'utf-8');
  const frontmatterContent = extractFrontmatter(content, skillPath);
  const frontmatter = yaml.load(frontmatterContent) as {
    name: string;
    description: string;
    homepage: string;
    metadata?: Record<string, any>;
  };

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    homepage: frontmatter.homepage,
    location: path.dirname(skillPath),
    metadata: frontmatter.metadata || {},
    skillFilePath: skillPath,
  };
}
