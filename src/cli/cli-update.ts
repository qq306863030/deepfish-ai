import type { Command } from 'commander';
import { handleUpdate } from './cli-core/update';

export function registerUpdateCommand(program: Command) {
  program
    .command('update')
    .description('检查 npm 并更新 deepfish-ai 到最新版本')
    .action(handleUpdate);
}
