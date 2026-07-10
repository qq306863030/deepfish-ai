import type { Command } from 'commander';
import { handleTaskLs, handleTaskAdd, handleTaskDel, handleTaskClear } from './cli-core/task';

export function registerTaskCommands(program: Command) {
  const task = program.command('tasks');
  task.command('ls').description('列出所有任务').action(handleTaskLs);
  task.command('add <task>').description('添加任务').action(handleTaskAdd);
  task.command('del <index>').description('删除指定序号的任务').action(handleTaskDel);
  task.command('clear').description('清除所有任务').action(handleTaskClear);
}
