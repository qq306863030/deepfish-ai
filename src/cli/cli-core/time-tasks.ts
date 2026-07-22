import { logInfo, logError, logSuccess } from '../../utils/print';
import { getServePort } from '../cli-utils/getGlobalData';
import { readScheduledTasks, removeScheduledTaskById, clearScheduledTasks } from '@/utils/execScheduledTask';

/** 检测服务是否在运行 */
async function isServerRunning(): Promise<boolean> {
  const port = getServePort();
  try {
    const res = await fetch(`http://localhost:${port}/ping`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    const text = await res.text();
    return text === 'pong';
  } catch {
    return false;
  }
}

/** 调用 HTTP DELETE /api/scheduled-task/:id */
async function delViaApi(id: string): Promise<boolean> {
  const port = getServePort();
  try {
    const res = await fetch(`http://localhost:${port}/api/scheduled-task/${id}`, { method: 'DELETE' });
    const data = await res.json() as { ok: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}

/** 调用 HTTP DELETE /api/scheduled-task（清空所有） */
async function clearViaApi(): Promise<boolean> {
  const port = getServePort();
  try {
    const res = await fetch(`http://localhost:${port}/api/scheduled-task`, { method: 'DELETE' });
    const data = await res.json() as { ok: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}

// ─── 处理函数 ────────────────────────────────────────

export function handleTimeTasksLs() {
  const tasks = readScheduledTasks();
  if (tasks.length === 0) {
    logInfo('暂无定时任务');
    return;
  }
  logInfo('='.repeat(60));
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    logInfo(`  [${i + 1}] ${t.id}  ${t.cron}  ${t.workspace}  "${t.prompt}"`);
  }
  logInfo('='.repeat(60));
}

export async function handleTimeTasksDel(id: string) {
  if (!id?.trim()) {
    logError('请提供要删除的定时任务 id');
    return;
  }
  const trimmedId = id.trim();

  const running = await isServerRunning();
  if (running) {
    const ok = await delViaApi(trimmedId);
    if (ok) {
      logSuccess(`定时任务 ${trimmedId} 已删除`);
    } else {
      logError(`定时任务 ${trimmedId} 不存在`);
    }
  } else {
    const ok = removeScheduledTaskById(trimmedId);
    if (ok) {
      logSuccess(`定时任务 ${trimmedId} 已删除`);
    } else {
      logError(`定时任务 ${trimmedId} 不存在`);
    }
  }
}

export async function handleTimeTasksClear() {
  const running = await isServerRunning();
  if (running) {
    const ok = await clearViaApi();
    if (ok) {
      logSuccess('所有定时任务已清空');
    } else {
      logError('清空定时任务失败');
    }
  } else {
    clearScheduledTasks();
    logSuccess('所有定时任务已清空');
  }
}
