import fs from 'fs-extra';
import path from 'path';
import { getTrueCwd } from '@/utils/normal';

const DEFAULT_MAX_OUTPUT = 60_000;
const TEXT_FILE_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.json5', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.css', '.less', '.scss', '.html', '.xml',
  '.yaml', '.yml', '.toml', '.ini', '.env', '.gitignore', '.sql', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go',
  '.rs', '.php', '.rb', '.sh', '.bat', '.ps1', '.vue', '.svelte', '.log', '.csv',
]);

export function resolveWorkspacePath(inputPath: string, cwd = getTrueCwd()): string {
  if (!inputPath?.trim()) {
    throw new Error('路径不能为空');
  }
  return path.resolve(cwd, inputPath);
}

export function normalizePathForMatch(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function truncateOutput(content: string, maxLength = DEFAULT_MAX_OUTPUT): string {
  if (content.length <= maxLength) {
    return content;
  }
  return `${content.slice(0, maxLength)}\n\n[内容已截断，仅显示前 ${maxLength} 个字符，总长度 ${content.length} 个字符]`;
}

export function isProbablyTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  return TEXT_FILE_EXTENSIONS.has(ext) || TEXT_FILE_EXTENSIONS.has(base) || base.startsWith('.env');
}

export function globToRegExp(pattern: string): RegExp {
  const normalized = normalizePathForMatch(pattern);
  let regex = '^';
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const next = normalized[i + 1];
    if (char === '*') {
      if (next === '*') {
        const after = normalized[i + 2];
        if (after === '/') {
          regex += '(?:.*/)?';
          i += 2;
        } else {
          regex += '.*';
          i += 1;
        }
      } else {
        regex += '[^/]*';
      }
    } else if (char === '?') {
      regex += '[^/]';
    } else {
      regex += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  regex += '$';
  return new RegExp(regex, 'i');
}

export function matchesGlob(relativePath: string, pattern: string): boolean {
  return globToRegExp(pattern).test(normalizePathForMatch(relativePath));
}

export async function walkFiles(rootDir: string, options: { includeHidden?: boolean; maxFiles?: number } = {}): Promise<string[]> {
  const files: string[] = [];
  const includeHidden = options.includeHidden ?? false;
  const maxFiles = options.maxFiles ?? 5000;

  async function walk(currentDir: string) {
    if (files.length >= maxFiles) {
      return;
    }
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= maxFiles) {
        return;
      }
      if (!includeHidden && entry.name.startsWith('.')) {
        continue;
      }
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
        continue;
      }
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return files;
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
