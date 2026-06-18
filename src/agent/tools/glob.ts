import path from 'path';
import { tool } from 'langchain';
import { z } from 'zod';
import { formatJson, matchesGlob, normalizePathForMatch, resolveWorkspacePath, truncateOutput, walkFiles } from './fileTools';

export async function globFiles(pattern: string, cwd?: string, maxResults = 200, includeHidden = false): Promise<string> {
  const rootDir = resolveWorkspacePath(cwd || '.');
  const allFiles = await walkFiles(rootDir, { includeHidden, maxFiles: Math.max(maxResults * 20, 1000) });
  const normalizedPattern = normalizePathForMatch(pattern);
  const matches = allFiles
    .map((file) => normalizePathForMatch(path.relative(rootDir, file)))
    .filter((relativePath) => matchesGlob(relativePath, normalizedPattern))
    .slice(0, maxResults);

  return truncateOutput(formatJson({ cwd: rootDir, pattern, count: matches.length, files: matches }));
}

export const globTool = tool(
  async ({ pattern, cwd, maxResults, includeHidden }) => globFiles(pattern, cwd, maxResults, includeHidden),
  {
    name: 'glob_files',
    description: '按 glob 模式查找当前工作目录下的文件，例如 **/*.ts、src/**/*.tsx。默认忽略隐藏目录、node_modules、dist、.git。',
    schema: z.object({
      pattern: z.string().describe('glob 文件匹配模式，例如 **/*.ts 或 src/**/*.tsx'),
      cwd: z.string().optional().describe('搜索根目录，默认当前工作目录'),
      maxResults: z.number().default(200).describe('最大返回数量'),
      includeHidden: z.boolean().default(false).describe('是否包含隐藏文件或隐藏目录'),
    }),
  },
);
