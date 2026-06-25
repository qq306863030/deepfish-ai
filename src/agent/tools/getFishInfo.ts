import { tool } from 'langchain';
import { z } from 'zod';
import { getCodePath } from '@/cli/cli-utils/getGlobalPath';
import { helpInformation } from '@/cli/cli-help';
import { safeTool } from './utils';
import path from 'path';
import fs from 'fs-extra';

/**
 * 获取 Deepfish CLI 系统代码路径
 */
const getFishCodePathTool = tool(
  async () =>
    safeTool(() => {
      const codePath = getCodePath();
      return { codePath };
    }),
  {
    name: 'get_fish_code_path',
    description: '获取 Deepfish CLI 系统的代码根目录路径',
    schema: z.object({}),
  },
);

/**
 * 获取 Deepfish CLI 系统的 README 内容，用于了解系统功能信息
 */
const getFishReadmeTool = tool(
  async ({ lang }) =>
    safeTool(() => {
      const codePath = getCodePath();
      // 优先读取中文 README，其次英文
      const readmePath = lang === 'en'
        ? path.join(codePath, 'README_EN.md')
        : path.join(codePath, 'README.md');
      const fallbackPath = lang === 'en'
        ? path.join(codePath, 'README.md')
        : path.join(codePath, 'README_EN.md');

      let targetPath = readmePath;
      if (!fs.existsSync(targetPath)) {
        targetPath = fallbackPath;
      }
      if (!fs.existsSync(targetPath)) {
        return { error: '未找到 README 文件', readmePath: targetPath };
      }
      const content = fs.readFileSync(targetPath, 'utf-8');
      return { readmePath: targetPath, content };
    }),
  {
    name: 'get_fish_readme',
    description: '获取 Deepfish CLI 系统的 README 文件内容，用于了解系统的功能、用法和特性。可选参数 lang 指定语言（zh 或 en），默认中文。',
    schema: z.object({
      lang: z.string().optional().default('zh').describe('语言，zh 为中文 README，en 为英文 README'),
    }),
  },
);

/**
 * 获取 Deepfish CLI 系统的命令帮助信息
 */
const getFishHelpTool = tool(
  async () =>
    safeTool(() => {
      const help = helpInformation();
      return { help };
    }),
  {
    name: 'get_fish_help',
    description: '获取 Deepfish CLI 系统的所有可用命令及使用说明，包括配置、模型、技能、工具、会话、任务、MCP、服务、缓存等子命令的详细用法',
    schema: z.object({}),
  },
);

export const fishInfoTools = [getFishCodePathTool, getFishReadmeTool, getFishHelpTool];
