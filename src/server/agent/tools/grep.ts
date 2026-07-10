import fs from 'fs-extra';
import path from 'path';
import { tool } from 'langchain';
import { z } from 'zod';
import { formatJson, isProbablyTextFile, matchesGlob, normalizePathForMatch, resolveWorkspacePath, truncateOutput, walkFiles } from './fileTools';
import { safeTool } from './utils';

type GrepMatch = { filePath: string; line: number; text: string };

export async function grepFiles(
  query: string,
  cwd?: string,
  includePattern = '**/*',
  isRegexp = false,
  maxResults = 100,
  includeHidden = false,
): Promise<string> {
  const rootDir = resolveWorkspacePath(cwd || '.');
  const matcher = isRegexp ? new RegExp(query, 'i') : null;
  const files = await walkFiles(rootDir, { includeHidden, maxFiles: Math.max(maxResults * 50, 1000) });
  const matches: GrepMatch[] = [];

  for (const file of files) {
    if (matches.length >= maxResults) break;
    const relativePath = normalizePathForMatch(path.relative(rootDir, file));
    if (!matchesGlob(relativePath, includePattern) || !isProbablyTextFile(file)) {
      continue;
    }
    const content = await fs.readFile(file, 'utf-8').catch(() => '');
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const ok = matcher ? matcher.test(line) : line.toLowerCase().includes(query.toLowerCase());
      if (ok) {
        matches.push({ filePath: relativePath, line: index + 1, text: line.trim() });
        if (matches.length >= maxResults) break;
      }
    }
  }

  return truncateOutput(formatJson({ cwd: rootDir, query, includePattern, count: matches.length, matches }));
}

export const grepTool = tool(
  async ({ query, pattern, cwd, includePattern, isRegexp, maxResults, includeHidden }) =>
    safeTool(() => {
      const searchQuery = (query ?? pattern ?? '').trim();
      if (!searchQuery) {
        return '请提供 query 或 pattern 之一；例如 query: "foo" 或 pattern: "foo"';
      }
      return grepFiles(searchQuery, cwd, includePattern, isRegexp, maxResults, includeHidden);
    }),
  {
    name: 'grep_files',
    description:
      '在文本文件中搜索内容，支持普通字符串或正则表达式，可用 includePattern 限定文件范围。query 为搜索内容；兼容 pattern 作为 query 的别名；如果未提供搜索词，会返回提示。',
    schema: z.object({
      query: z.string().optional().describe('要搜索的字符串或正则表达式'),
      pattern: z.string().optional().describe('query 的兼容别名，要搜索的字符串或正则表达式'),
      cwd: z.string().optional().describe('搜索根目录，默认当前工作目录'),
      includePattern: z.string().default('**/*').describe('限定搜索文件的 glob 模式，例如 src/**/*.ts'),
      isRegexp: z.boolean().default(false).describe('query/pattern 是否为正则表达式'),
      maxResults: z.number().default(100).describe('最大返回匹配数量'),
      includeHidden: z.boolean().default(false).describe('是否包含隐藏文件或隐藏目录'),
    }),
  },
);
