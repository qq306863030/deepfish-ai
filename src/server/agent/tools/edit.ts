import fs from 'fs-extra';
import { tool } from 'langchain';
import { z } from 'zod';
import { resolveWorkspacePath } from './fileTools';
import { safeTool } from './utils';

export async function editFileByReplace(filePath: string, oldString: string, newString: string, replaceAll = false): Promise<string> {
  const absPath = resolveWorkspacePath(filePath);
  if (!(await fs.pathExists(absPath))) {
    throw new Error(`文件不存在 ${absPath}`);
  }
  const content = await fs.readFile(absPath, 'utf-8');
  const matches = content.split(oldString).length - 1;
  if (!oldString) {
    throw new Error('oldString 不能为空');
  }
  if (matches === 0) {
    throw new Error('未找到 oldString，请先读取文件确认精确内容');
  }
  if (!replaceAll && matches > 1) {
    throw new Error(`oldString 匹配到 ${matches} 处。请提供更多上下文使其唯一，或设置 replaceAll=true`);
  }
  const nextContent = replaceAll ? content.split(oldString).join(newString) : content.replace(oldString, newString);
  await fs.writeFile(absPath, nextContent, 'utf-8');
  return `已编辑文件: ${absPath}，替换 ${replaceAll ? matches : 1} 处`;
}

export const editFileTool = tool(
  async ({ filePath, oldString, newString, replaceAll }) => safeTool(() => editFileByReplace(filePath, oldString, newString, replaceAll)),
  {
    name: 'edit_file',
    description: '编辑已有文本文件：使用精确 oldString 替换为 newString。默认要求 oldString 在文件中唯一，以避免误改。',
    schema: z.object({
      filePath: z.string().describe('要编辑的文件路径，支持绝对路径或相对当前工作目录的路径'),
      oldString: z.string().describe('要替换的原始文本，必须与文件内容完全一致；建议包含足够上下文保证唯一'),
      newString: z.string().describe('替换后的新文本'),
      replaceAll: z.boolean().default(false).describe('是否替换全部匹配项；默认 false，仅允许唯一匹配'),
    }),
  },
);
