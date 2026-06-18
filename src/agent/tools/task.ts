import TaskQueue from '@/cli/cli-utils/TaskQueue';
import { getAgentId } from '@/cli/cli-utils/init-agent';
import { tool } from 'langchain';
import { z } from 'zod';
import { formatJson } from './fileTools';
import { safeTool } from './utils';

function getCurrentTaskQueue(agentId: string): TaskQueue | null {
  return agentId ? new TaskQueue(agentId) : null;
}

export function manageTaskQueue(agentId: string, action: 'list' | 'add' | 'delete' | 'clear', task?: string, index?: number): string {
  const queue = getCurrentTaskQueue(agentId);
  if (!queue) {
    throw new Error('未找到当前会话，请先创建 agent 会话');
  }
  if (action === 'list') {
    return formatJson({ tasks: queue.loadTasks() });
  }
  if (action === 'add') {
    if (!task?.trim()) {
      throw new Error('添加任务时 task 不能为空');
    }
    queue.pushTask(task.trim());
    return `已添加任务: ${task.trim()}`;
  }
  if (action === 'delete') {
    const tasks = queue.loadTasks();
    const safeIndex = Number(index);
    if (!Number.isInteger(safeIndex) || safeIndex < 1 || safeIndex > tasks.length) {
      throw new Error(`任务序号无效，当前任务数 ${tasks.length}`);
    }
    const removed = tasks[safeIndex - 1];
    queue.delTask(safeIndex - 1);
    return `已删除任务: [${removed.createTime}] ${removed.taskStr}`;
  }
  queue.clearTasks();
  return '已清空任务队列';
}

export const taskTool = tool(
  async ({ action, task, index }, runtime) =>
    safeTool(() => {
      const agentId = runtime.context?.agentId || getAgentId();
      return manageTaskQueue(agentId, action, task, index);
    }),
  {
    name: 'manage_task_queue',
    description: '管理当前 agent 会话任务队列：查看、添加后续任务、删除指定任务或清空任务。添加的任务会在当前任务结束后继续执行。',
    schema: z.object({
      action: z.enum(['list', 'add', 'delete', 'clear']).describe('任务队列操作'),
      task: z.string().optional().describe('action=add 时要添加的任务内容'),
      index: z.number().optional().describe('action=delete 时要删除的任务序号，从 1 开始'),
    }),
  },
);
