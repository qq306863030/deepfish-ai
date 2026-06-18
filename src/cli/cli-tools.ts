import type { Command } from 'commander';
import { handleToolsAdd, handleToolsDir, handleToolsGenerate } from './cli-core/tools';

export function registerToolsCommands(program: Command) {
  const tools = program.command('tools');
  tools.command('dir').description('打开工具目录').action(handleToolsDir);
  tools.command('add <name>').description('添加本地工具目录').action(handleToolsAdd);
  tools.command('generate <target>').description('生成工具').action(handleToolsGenerate);
}
