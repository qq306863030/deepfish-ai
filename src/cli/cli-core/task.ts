import TaskQueue from '../cli-utils/TaskQueue';
import { getAgentId } from '../cli-utils/init-agent';
import { logInfo, logWarning, logError, logSuccess } from '../../utils/print';

function getTaskQueue(): TaskQueue | null {
  const agentId = getAgentId();
  if (!agentId) {
    logWarning('No current session found, please run ai <input> to create one');
    return null;
  }
  return new TaskQueue(agentId);
}

export function handleTaskLs() {
  const queue = getTaskQueue();
  if (!queue) return;

  const tasks = queue.loadTasks();
  if (tasks.length === 0) {
    logInfo('Task queue is empty');
    return;
  }
  logInfo("=".repeat(50));
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const displayStr = t.taskStr.length > 50 ? `${t.taskStr.slice(0, 50)}...` : t.taskStr;
    logInfo(`   [${i + 1}] ${displayStr} [${t.createTime}]`);
  }
  logInfo("=".repeat(50));
}

export function handleTaskAdd(taskStr: string) {
  if (!taskStr?.trim()) {
    logError('Please enter task content');
    return;
  }

  const queue = getTaskQueue();
  if (!queue) return;

  queue.pushTask(taskStr.trim());
  logSuccess(`任务已 added: ${taskStr.trim()}`);
}

export function handleTaskDel(indexStr: string) {
  const index = parseInt(indexStr, 10);
  if (isNaN(index) || index < 1) {
    logError('Please enter a valid task index（positive integer）');
    return;
  }

  const queue = getTaskQueue();
  if (!queue) return;

  const tasks = queue.loadTasks();
  if (index > tasks.length) {
    logError(`Task index out of range, current task count: ${tasks.length} `);
    return;
  }

  const removed = tasks[index - 1];
  queue.delTask(index - 1);
  logSuccess(`Task deleted: [${removed.createTime}] ${removed.taskStr}`);
}

export function handleTaskClear() {
  const queue = getTaskQueue();
  if (!queue) return;

  queue.clearTasks();
  logSuccess('All tasks cleared');
}
