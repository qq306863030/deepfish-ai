import type { Command } from 'commander';
import {
  handleDynamicToolsLs,
  handleDynamicToolsEnable,
  handleDynamicToolsDisable,
  handleDynamicToolsDir,
  handleDynamicToolsGenerate,
} from './cli-core/dynamicTools';

export function registerDynamicToolsCommands(program: Command) {
  const dynamicTools = program.command('dynamicTools');
  dynamicTools.command('ls').description('List all dynamic tools').action(handleDynamicToolsLs);
  dynamicTools.command('enable <nameOrIndex>').description('Enable dynamic tool by name or index').action(handleDynamicToolsEnable);
  dynamicTools.command('disable <nameOrIndex>').description('Disable dynamic tool by name or index').action(handleDynamicToolsDisable);
  dynamicTools.command('dir').description('Open dynamic tools directory').action(handleDynamicToolsDir);
  dynamicTools.command('generate <target>').description('Generate dynamic tool').action(handleDynamicToolsGenerate);
}
