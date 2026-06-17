import type { Command } from 'commander';
import { handleToolsDir, handleToolsGenerate } from './cli-core/tools';

export function registerToolsCommands(program: Command) {
  const tools = program.command('tools');
  tools.command('dir').description('打开工具目录').action(handleToolsDir);
  tools.command('generate <target>').description('生成工具').action(handleToolsGenerate);
}
