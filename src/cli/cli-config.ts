import type { Command } from 'commander';
import { handleConfigEdit, handleConfigView, handleConfigReset, handleConfigDir } from './cli-core/config';

export function registerConfigCommands(program: Command) {
  const config = program.command('config');
  config.command('edit').description('Edit config file').action(handleConfigEdit);
  config.command('view').description('View current config').action(handleConfigView);
  config.command('reset').description('Reset config').action(handleConfigReset);
  config.command('dir').description('Open config directory').action(handleConfigDir);
}
