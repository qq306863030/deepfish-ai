import UserCache from '@/cli/cli-utils/UserCache';
import { tool } from 'langchain';
import { z } from 'zod';
import { safeTool } from './utils';

const userCache = new UserCache();

/**
 * 自我学习工具：解决复杂问题后，将解决方案缓存到本地知识库。
 */
export const learnSelfTool = tool(
  ({ description, content }) =>
    safeTool(() => {
      userCache.add(description, content);
      return `已缓存解决方案: ${description}`;
    }),
  {
    name: 'learn_self',
    description:
      '将解决复杂问题的方案缓存到本地知识库。当你成功解决了一个复杂问题后，调用此工具保存解决方案，以便将来遇到类似问题时可以复用。description 必须简洁，不超过50字；content 必须使用 Markdown 格式编写，包含完整的解决步骤和关键信息。',
    schema: z.object({
      description: z.string().describe('解决方案的简要描述，不超过50字，简洁概括问题及方案'),
      content: z.string().describe('解决方案的完整内容，使用 Markdown 格式，包含详细步骤、关键代码和注意事项'),
    }),
  },
);

/**
 * 读取指定缓存方案详细信息的工具。
 * 支持按索引（数字）或 id（uuid 字符串）查找。
 */
export const getLearnedDetailTool = tool(
  ({ indexOrId }) =>
    safeTool(() => {
      const index = Number(indexOrId);
      let item;
      if (!isNaN(index) && Number.isInteger(index)) {
        item = userCache.getByIndex(index);
        if (!item) {
          throw new Error(`无效的索引: ${indexOrId}，请读取 catalog.json 查看有效索引。`);
        }
      } else {
        const catalog = userCache.list();
        item = catalog.find((c) => c.id === indexOrId);
        if (!item) {
          throw new Error(`未找到 id 为 "${indexOrId}" 的缓存项，请读取 catalog.json 查看所有缓存。`);
        }
      }

      const detail = userCache.getContentById(item.id);
      return `## ${detail.description}\n\n${detail.content}`;
    }),
  {
    name: 'get_learned_detail',
    description: '读取指定缓存方案的完整详细信息。传入索引号（数字）或 id（uuid 字符串）来获取方案的完整内容。',
    schema: z.object({
      indexOrId: z.string().describe('缓存项的索引（数字）或 id（uuid 字符串）'),
    }),
  },
);

/**
 * 更新已有缓存方案内容的工具。
 * 传入 id 和新内容，覆盖原有的 markdown 文件。
 */
export const updateLearnContentTool = tool(
  ({ id, content }) =>
    safeTool(() => {
      const success = userCache.update(id, content);
      if (!success) {
        throw new Error(`更新失败: 未找到 id 为 "${id}" 的缓存项，请读取 catalog.json 查看所有缓存。`);
      }
      return `已更新缓存方案: ${id}`;
    }),
  {
    name: 'update_learned_content',
    description: '更新已有缓存方案的内容。传入缓存项的 id（uuid 字符串）和新的 Markdown 内容，覆盖原有文件。适用于补充更多细节或修正之前的方案。',
    schema: z.object({
      id: z.string().describe('要更新的缓存项 id（uuid 字符串），可通过读取 catalog.json 获取'),
      content: z.string().describe('更新后的完整内容，使用 Markdown 格式'),
    }),
  },
);

/**
 * 获取 catalog.json 文件路径的工具。
 * agent 可通过此工具获取缓存索引文件的路径，然后用 read_file 读取所有缓存项列表。
 */
export const getCatalogFilePathTool = tool(() => safeTool(() => userCache.getCatalogFilePath()), {
  name: 'get_catalog_file_path',
  description:
    '获取缓存索引文件 catalog.json 的绝对路径。该文件包含所有已缓存方案的 id 和 description 列表。获取路径后，使用 read_file 工具读取该文件即可查看所有缓存项。',
  schema: z.object({}),
});

export const learnTools = [learnSelfTool, getLearnedDetailTool, updateLearnContentTool, getCatalogFilePathTool];
