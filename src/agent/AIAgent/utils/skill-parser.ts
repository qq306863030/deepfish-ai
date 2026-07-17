import fs from 'fs-extra';
import path from 'path';
import { parse as parseYaml } from 'yaml';

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
  // 如果路径是目录，自动拼接 SKILL.md
  const resolvedPath = fs.statSync(skillPath).isDirectory()
    ? path.join(skillPath, 'SKILL.md')
    : skillPath;
  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const frontmatterContent = extractFrontmatter(content, resolvedPath);
  const frontmatter = parseYaml(frontmatterContent) as {
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
