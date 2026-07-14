import fs from 'fs-extra';
import iconv from 'iconv-lite';
import { tool } from 'langchain';
import { z } from 'zod';
import { getEncoding } from '@/cli/cli-utils/getGlobalData';
import { formatJson, resolveWorkspacePath, truncateOutput } from './fileTools';
import { safeTool } from './utils';

export async function readFile(filePath: string, startLine = 1, endLine = -1, encoding?: string): Promise<string> {
  // 参数验证
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath 参数必须是非空字符串');
  }
  
  const absPath = resolveWorkspacePath(filePath);
  if (!(await fs.pathExists(absPath))) {
    throw new Error(`文件不存在 ${absPath}`);
  }
  const stat = await fs.stat(absPath);
  if (!stat.isFile()) {
    throw new Error(`路径不是文件 ${absPath}`);
  }

  const buffer = await fs.readFile(absPath);
  const targetEncoding = encoding || getEncoding() || 'utf-8';
  const content = iconv.decode(buffer, targetEncoding === 'auto' ? 'utf-8' : targetEncoding);
  const lines = content.split(/\r?\n/);
  const safeStart = Math.max(1, startLine || 1);
  const safeEnd = endLine && endLine > 0 ? Math.min(endLine, lines.length) : lines.length;
  if (safeStart > safeEnd) {
    throw new Error(`行号范围无效，文件共 ${lines.length} 行`);
  }

  const selected = lines
    .slice(safeStart - 1, safeEnd)
    .map((line, index) => `${safeStart + index}: ${line}`)
    .join('\n');
  return truncateOutput(formatJson({ filePath: absPath, totalLines: lines.length, startLine: safeStart, endLine: safeEnd, content: selected }));
}

export const readFileTool = tool(
  async ({ filePath, startLine, endLine, encoding }) => safeTool(() => readFile(filePath, startLine, endLine, encoding)),
  {
    name: 'read_file',
    description: '读取本地文本文件内容。必须提供 filePath 参数。支持绝对路径或相对当前工作目录的路径，可指定起止行号；返回带行号的内容。',
    schema: z.object({
      filePath: z.string().min(1).describe('要读取的文件路径，支持绝对路径或相对当前工作目录的路径。必须提供非空字符串。'),
      startLine: z.number().default(1).describe('起始行号，默认 1'),
      endLine: z.number().default(-1).describe('结束行号，-1 表示读取到文件末尾'),
      encoding: z.string().optional().describe('文件编码，例如 utf-8、gbk；不填则使用全局编码配置'),
    }),
  },
);
