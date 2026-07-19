import fs from 'fs-extra';
import { tool } from 'langchain';
import { z } from 'zod';
import { resolveWorkspacePath } from './fileTools';
import { safeTool } from './utils';

export async function editFileByReplace(filePath: string, oldString: string, newString: string, replaceAll = false): Promise<string> {
  // 参数验证
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath 参数必须是非空字符串');
  }
  if (!oldString || typeof oldString !== 'string') {
    throw new Error('oldString 参数必须是非空字符串');
  }
  if (newString === undefined || newString === null) {
    throw new Error('newString 参数必须提供');
  }
  
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
    throw new Error(`未找到 oldString。请先用 read_file 读取文件确认完整内容，再从读取结果中精确复制 oldString，注意核对 filePath 是否正确（如 README.md 和 README_EN.md 是不同文件）。`);
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
    description: `编辑已有文本文件：使用精确 oldString 替换为 newString。

【重要 workflow - 必须遵守】
第1步：先用 read_file 读取文件，获取完整内容。
第2步：从读取结果中，把要替换的那段原文精确复制出来，作为 oldString 参数。
第3步：确定 newString 替换后的新文本。

【警告】
- oldString 必须与文件内容完全一致（包含换行和缩进），不能自己凭记忆拼写。
- filePath 必须在第1步 read_file 时确认是正确的路径，注意区分同名文件（如 README.md vs README_EN.md）。
- 如果 oldString 匹配不到，先重新 read_file 确认文件内容。

必须提供 filePath、oldString、newString 三个必填参数。默认要求 oldString 在文件中唯一，以避免误改。`,
    schema: z.object({
      filePath: z.string().min(1).describe('要编辑的文件路径，支持绝对路径或相对当前工作目录的路径。必须提供非空字符串。'),
      oldString: z.string().min(1).describe('要替换的原始文本，必须与文件内容完全一致；建议包含足够上下文保证唯一。必须提供非空字符串。'),
      newString: z.string().describe('替换后的新文本。必须提供。'),
      replaceAll: z.boolean().default(false).describe('是否替换全部匹配项；默认 false，仅允许唯一匹配'),
    }),
  },
);
