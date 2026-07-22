import axios from 'axios';
import { tool } from 'langchain';
import { z } from 'zod';
import { getServeUrl } from '@/cli/cli-utils/getGlobalData';
import { readScheduledTasks } from '@/utils/execScheduledTask';
import { safeTool } from './utils';

/** 添加定时任务（通过 Server API） */
const addScheduledTaskTool = tool(
  async ({ cron, workspace, prompt }, _runtime) =>
    safeTool(async () => {
      const res = await axios.post(`${getServeUrl()}/api/scheduled-task`, {
        cron,
        workspace,
        prompt,
      });
      const data = res.data as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error || '添加失败');
      return data;
    }),
  {
    name: 'scheduled_task_add',
    description: '添加一个定时任务（通过 Server API），需要服务已启动（ai serve start）。cron表达式按中国时区计算。',
    schema: z.object({
      cron: z.string().min(1).describe('cron 表达式（5段，如 "0 9 * * 1-5" 表示工作日9点）'),
      workspace: z.string().min(1).describe('执行任务时的工作目录路径'),
      prompt: z.string().min(1).describe('定时执行的提示词任务内容'),
    }),
  },
);

/** 按 id 删除定时任务（通过 Server API） */
const deleteScheduledTaskTool = tool(
  async ({ id }, _runtime) =>
    safeTool(async () => {
      const res = await axios.delete(`${getServeUrl()}/api/scheduled-task/${encodeURIComponent(id)}`);
      const data = res.data as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error || '删除失败');
      return data;
    }),
  {
    name: 'scheduled_task_delete',
    description: '按 id 删除一个定时任务（通过 Server API），需要服务已启动。',
    schema: z.object({
      id: z.string().min(1).describe('要删除的定时任务 id'),
    }),
  },
);

/** 修改定时任务（通过 Server API） */
const updateScheduledTaskTool = tool(
  async ({ id, cron, workspace, prompt }, _runtime) =>
    safeTool(async () => {
      const res = await axios.put(`${getServeUrl()}/api/scheduled-task/${encodeURIComponent(id)}`, {
        cron,
        workspace,
        prompt,
      });
      const data = res.data as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error || '修改失败');
      return data;
    }),
  {
    name: 'scheduled_task_update',
    description: '修改一个已有的定时任务（通过 Server API），需要服务已启动。只需传入需要修改的字段（id 必填），其余字段不传则不修改。',
    schema: z.object({
      id: z.string().min(1).describe('要修改的定时任务 id'),
      cron: z.string().optional().describe('新的 cron 表达式（5段，如 "0 9 * * 1-5" 表示工作日9点）'),
      workspace: z.string().optional().describe('新的工作目录路径'),
      prompt: z.string().optional().describe('新的提示词任务内容'),
    }),
  },
);

/** 查询所有定时任务（从文件直接读取） */
const listScheduledTaskTool = tool(
  async () =>
    safeTool(() => {
      const tasks = readScheduledTasks();
      return { count: tasks.length, tasks };
    }),
  {
    name: 'scheduled_task_list',
    description: '列出所有定时任务及其详细信息（直接从配置文件读取，不依赖服务状态）。',
    schema: z.object({}),
  },
);

export const scheduledTaskTools = [addScheduledTaskTool, deleteScheduledTaskTool, updateScheduledTaskTool, listScheduledTaskTool];