import type { Command } from 'commander';
import { handleTimeTasksLs, handleTimeTasksDel, handleTimeTasksClear } from './cli-core/time-tasks';

export function registerTimeTasksCommands(program: Command) {
  const timeTasks = program.command('time-tasks');
  timeTasks.command('ls').description('列出所有定时任务').action(handleTimeTasksLs);
  timeTasks.command('del <id>').description('按 id 删除定时任务').action(handleTimeTasksDel);
  timeTasks.command('clear').description('清空所有定时任务').action(handleTimeTasksClear);
}
