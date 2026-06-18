import fs from 'fs-extra';
import path from 'path';
import { tool } from 'langchain';
import { z } from 'zod';

const DEFAULT_MEMORY_MARKDOWN = `# 用户语义记忆

> 该文件由语义记忆工具维护。仅记录可长期复用的用户信息、习惯和偏好；不要记录密码、密钥、令牌等敏感信息。

## 用户称呼

## 操作习惯

## 编码习惯

## 个人偏好

## 其他长期记忆
`;

function getMemoryFilePath(runtimeMemoryFilePath: unknown): string | undefined {
  return typeof runtimeMemoryFilePath === 'string' && runtimeMemoryFilePath.trim() ? runtimeMemoryFilePath : undefined;
}

export async function readSemanticMemory(memoryFilePath: string | undefined): Promise<string> {
  if (!memoryFilePath) {
    return 'Semantic memory error: 当前运行上下文未提供 memoryFilePath，无法读取用户语义记忆';
  }

  if (!(await fs.pathExists(memoryFilePath))) {
    return DEFAULT_MEMORY_MARKDOWN;
  }

  return fs.readFile(memoryFilePath, 'utf-8');
}

export async function updateSemanticMemory(memoryFilePath: string | undefined, content: string): Promise<string> {
  if (!memoryFilePath) {
    return 'Semantic memory error: 当前运行上下文未提供 memoryFilePath，无法更新用户语义记忆';
  }

  await fs.ensureDir(path.dirname(memoryFilePath));
  await fs.writeFile(memoryFilePath, `${content.trim()}\n`, 'utf-8');

  return `已更新用户语义记忆: ${memoryFilePath}`;
}

export const readSemanticMemoryTool = tool(
  async (_input, runtime) => {
    return readSemanticMemory(getMemoryFilePath(runtime.context?.memoryFilePath));
  },
  {
    name: 'read_user_semantic_memory',
    description:
      '读取当前用户语义记忆 Markdown 文件。准备新增、修正或合并用户长期偏好前，应先调用本工具读取现有内容，避免重复和覆盖已有信息。若文件不存在，会返回推荐的 Markdown 模板。',
    schema: z.object({}),
  },
);

export const updateSemanticMemoryTool = tool(
  async ({ content }, runtime) => {
    return updateSemanticMemory(getMemoryFilePath(runtime.context?.memoryFilePath), content);
  },
  {
    name: 'update_user_semantic_memory',
    description:
      '覆盖更新当前用户语义记忆 Markdown 文件。content 必须是完整的 Markdown 文件内容，而不是片段。仅记录明确、稳定、可长期复用的信息，例如用户称呼、操作习惯、编码习惯、个人偏好等；不要记录一次性任务信息、临时上下文、推测内容、密码、密钥、令牌、隐私敏感信息。更新前应先调用 read_user_semantic_memory 读取现有内容，然后在保留已有有效记忆的基础上合并新信息，按 Markdown 标题和列表整理，并自行去重。',
    schema: z.object({
      content: z.string().describe('完整的用户语义记忆 Markdown 内容，需保留并合并已有有效记忆，按分类标题和列表项组织'),
    }),
  },
);

export const semanticMemoryTools = [readSemanticMemoryTool, updateSemanticMemoryTool];
