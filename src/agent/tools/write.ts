import fs from 'fs-extra';
import path from 'path';
import { tool } from 'langchain';
import { z } from 'zod';
import { resolveWorkspacePath } from './fileTools';

export async function writeFile(filePath: string, content: string, mode: 'overwrite' | 'append' | 'create' = 'overwrite'): Promise<string> {
  const absPath = resolveWorkspacePath(filePath);
  const exists = await fs.pathExists(absPath);
  if (mode === 'create' && exists) {
    return `Write error: 文件已存在，create 模式不会覆盖 ${absPath}`;
  }
  await fs.ensureDir(path.dirname(absPath));
  if (mode === 'append') {
    await fs.appendFile(absPath, content, 'utf-8');
    return `已追加写入文件: ${absPath}`;
  }
  await fs.writeFile(absPath, content, 'utf-8');
  return `${exists ? '已覆盖写入文件' : '已创建文件'}: ${absPath}`;
}

export const writeFileTool = tool(
  async ({ filePath, content, mode }) => writeFile(filePath, content, mode),
  {
    name: 'write_file',
    description: '向本地文件写入文本内容。可创建新文件、覆盖已有文件或追加内容，会自动创建父目录。',
    schema: z.object({
      filePath: z.string().describe('目标文件路径，支持绝对路径或相对当前工作目录的路径'),
      content: z.string().describe('要写入的完整文本内容'),
      mode: z.enum(['overwrite', 'append', 'create']).default('overwrite').describe('写入模式：overwrite 覆盖、append 追加、create 仅新建'),
    }),
  },
);
