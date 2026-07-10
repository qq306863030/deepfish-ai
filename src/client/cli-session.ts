import type { Command } from 'commander';
import { handleSessionClear, handleSessionDir } from './cli-core/session';

export function registerSessionCommands(program: Command) {
  const session = program.command('session');
  session.command('clear').description('清除当前目录的历史消息').action(handleSessionClear);
  session.command('dir').description('打开记忆目录').action(handleSessionDir);
}
