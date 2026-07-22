import fs from 'fs-extra';
import { Cron } from 'croner';
import { randomUUID } from 'crypto';
import { getScheduledTaskListFile } from '@/cli/cli-utils/getGlobalPath';
import { createSubAgent } from './createAgent';
import { logInfo, logWarning, logError } from '@/utils/print';
import type { ScheduledTask } from '@/@types/ConfigFile';

const TIMEZONE = 'Asia/Shanghai';

// ─── 已加载的定时任务调度 ────────────────────────────
const activeJobs = new Map<string, Cron>();

// ─── 时间工具 ────────────────────────────────────────

/** 获取中国时区 (Asia/Shanghai UTC+8) 的 ISO 时间字符串 */
function getChinaISOString(): string {
  const now = new Date();
  const diffMs = (8 * 60 + now.getTimezoneOffset()) * 60 * 1000;
  const d = new Date(now.getTime() + diffMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+08:00`;
}

// ─── 读取 ───────────────────────────────────────────

/** 读取定时任务列表，文件不存在或格式异常时返回空数组 */
export function readScheduledTasks(): ScheduledTask[] {
  const filePath = getScheduledTaskListFile();
  try {
    const data = fs.readJSONSync(filePath, { throws: false });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ─── 写入 ───────────────────────────────────────────

/** 写入定时任务列表到文件 */
export function writeScheduledTasks(tasks: ScheduledTask[]): void {
  const filePath = getScheduledTaskListFile();
  fs.writeJSONSync(filePath, tasks, { spaces: 2 });
}

// ─── 校验 ───────────────────────────────────────────

/** 校验 cron 表达式（使用 croner），返回 null 表示合法，否则返回错误信息 */
export function validateCron(cron: string): string | null {
  if (!cron || typeof cron !== 'string') {
    return 'cron 表达式不能为空';
  }
  try {
    new Cron(cron);
    return null;
  } catch {
    return 'cron 表达式格式无效';
  }
}

// ─── 添加 ───────────────────────────────────────────

/** 校验并添加定时任务，成功返回 null，失败返回错误信息 */
export function addScheduledTask(
  cron: string,
  workspace: string,
  prompt: string,
): string | null {
  const cronErr = validateCron(cron);
  if (cronErr) return cronErr;

  if (!workspace || typeof workspace !== 'string') {
    return 'workspace 不能为空';
  }

  if (!prompt || typeof prompt !== 'string') {
    return 'prompt 不能为空';
  }

  const tasks = readScheduledTasks();

  // 去重：相同 workspace + prompt 视为重复
  if (tasks.some((t) => t.workspace === workspace && t.prompt === prompt)) {
    return '相同 workspace 和 prompt 的定时任务已存在';
  }

  const now = getChinaISOString();
  tasks.push({
    id: randomUUID(),
    createTime: now,
    lastExecTime: '',
    cron,
    workspace,
    prompt,
  });
  writeScheduledTasks(tasks);
  loadScheduledTasks();
  return null;
}

// ─── 删除 ───────────────────────────────────────────

/** 按索引删除定时任务 */
export function removeScheduledTaskByIndex(index: number): boolean {
  const tasks = readScheduledTasks();
  if (index < 0 || index >= tasks.length) return false;
  tasks.splice(index, 1);
  writeScheduledTasks(tasks);
  return true;
}

/** 按 id 删除定时任务，删除后重新加载调度 */
export function removeScheduledTaskById(id: string): boolean {
  const tasks = readScheduledTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  tasks.splice(idx, 1);
  writeScheduledTasks(tasks);
  loadScheduledTasks();
  return true;
}

/** 清空所有定时任务 */
export function clearScheduledTasks(): void {
  writeScheduledTasks([]);
  loadScheduledTasks();
}

/** 按 id 更新定时任务（仅更新非空字段），更新后重新加载调度。成功返回 null，失败返回错误信息 */
export function updateScheduledTaskById(
  id: string,
  updates: { cron?: string; workspace?: string; prompt?: string },
): string | null {
  const tasks = readScheduledTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return '定时任务不存在';

  const task = tasks[idx];

  if (updates.cron !== undefined) {
    const cronErr = validateCron(updates.cron);
    if (cronErr) return cronErr;
    task.cron = updates.cron;
  }
  if (updates.workspace !== undefined) {
    if (!updates.workspace || typeof updates.workspace !== 'string') return 'workspace 不能为空';
    task.workspace = updates.workspace;
  }
  if (updates.prompt !== undefined) {
    if (!updates.prompt || typeof updates.prompt !== 'string') return 'prompt 不能为空';
    task.prompt = updates.prompt;
  }

  tasks[idx] = task;
  writeScheduledTasks(tasks);
  loadScheduledTasks();
  return null;
}

/** 按 workspace + prompt 删除定时任务 */
export function removeScheduledTaskByKey(workspace: string, prompt: string): boolean {
  const tasks = readScheduledTasks();
  const idx = tasks.findIndex((t) => t.workspace === workspace && t.prompt === prompt);
  if (idx === -1) return false;
  tasks.splice(idx, 1);
  writeScheduledTasks(tasks);
  return true;
}

// ─── 执行 ───────────────────────────────────────────

/** 执行单个定时任务：通过 createSubAgent 创建子 Agent 来执行 */
export async function execScheduledTask(task: ScheduledTask): Promise<string> {
  const agent = await createSubAgent(task.workspace);
  if (!agent) {
    throw new Error('创建子 Agent 失败，请检查 AI 配置');
  }
  try {
    const result = await agent.execute(task.prompt);
    logInfo(`[scheduled-task] 任务执行完成: ${task.prompt.slice(0, 50)}...`);

    // 更新 lastExecTime
    const tasks = readScheduledTasks();
    const idx = tasks.findIndex(
      (t) => t.workspace === task.workspace && t.prompt === task.prompt,
    );
    if (idx !== -1) {
      tasks[idx].lastExecTime = getChinaISOString();
      writeScheduledTasks(tasks);
    }

    return typeof result === 'string' ? result : JSON.stringify(result);
  } finally {
    // 释放 agent 资源
    try {
      (agent as any).destroy?.();
    } catch {
      /* ignore */
    }
  }
}

// ─── 调度 ────────────────────────────────────────────

/** 为单个任务创建 croner 调度（按中国时区触发回调） */
function scheduleTask(task: ScheduledTask): Cron | null {
  try {
    new Cron(task.cron);
  } catch {
    logWarning(`[scheduled-task] 跳过无效 cron 的任务: ${task.prompt.slice(0, 40)}...`);
    return null;
  }

  const key = `${task.workspace}|${task.prompt}`;
  const job = new Cron(
    task.cron,
    { timezone: TIMEZONE },
    async () => {
      logInfo(`[scheduled-task] 触发任务: ${task.prompt.slice(0, 50)}...`);
      try {
        await execScheduledTask(task);
      } catch (err) {
        logError(`[scheduled-task] 执行失败: ${(err as Error).message}`);
      }
    },
  );

  activeJobs.set(key, job);
  return job;
}

/** 加载定时任务文件
 *  - 清理 cron 无效的任务
 *  - 按 workspace+prompt 去重（保留最新的）
 *  - 停止已加载的调度
 *  - 重新加载并启动调度（由 croner 自动在正确时区触发）
 */
export function loadScheduledTasks(): void {
  // 1. 停止所有已加载的调度
  for (const [, job] of activeJobs.entries()) {
    job.stop();
  }
  activeJobs.clear();

  // 2. 读取文件
  let tasks = readScheduledTasks();
  if (tasks.length === 0) return;

  // 3. 清理无效 cron 的任务
  const validTasks: ScheduledTask[] = [];
  for (const task of tasks) {
    try {
      new Cron(task.cron);
    } catch {
      logWarning(`[scheduled-task] 移除无效 cron 的任务: ${task.prompt.slice(0, 40)}...`);
      continue;
    }
    validTasks.push(task);
  }

  // 4. 去重：相同 workspace+prompt 保留最后一条
  const seen = new Map<string, ScheduledTask>();
  for (let i = validTasks.length - 1; i >= 0; i--) {
    const t = validTasks[i];
    const key = `${t.workspace}|${t.prompt}`;
    if (!seen.has(key)) {
      seen.set(key, t);
    }
  }
  const deduped = Array.from(seen.values());

  // 如果有清理或去重变更，写回文件
  if (deduped.length !== tasks.length) {
    writeScheduledTasks(deduped);
  }

  if (deduped.length === 0) return;

  logInfo(`[scheduled-task] 已加载 ${deduped.length} 个定时任务，时区: ${TIMEZONE}`);

  // 5. 启动调度（croner 内部自动计算触发时间，无需轮询）
  for (const task of deduped) {
    scheduleTask(task);
  }
}

/** 停止所有已加载的定时调度 */
export function stopScheduledTasks(): void {
  for (const [, job] of activeJobs.entries()) {
    job.stop();
  }
  activeJobs.clear();
  logInfo('[scheduled-task] 所有定时调度已停止');
}