import type { Command } from 'commander';
import { handleToolsAdd, handleToolsDel, handleToolsDir, handleToolsGenerate, handleToolsLs } from './cli-core/tools';

export function registerToolsCommands(program: Command) {
  const tools = program.command('tools');
  tools.command('ls').description('列出所有工具').action(handleToolsLs);
  tools.command('dir').description('打开工具目录').action(handleToolsDir);
  tools.command('add <name>').description('添加本地工具目录').action(handleToolsAdd);
  tools.command('del <index>').description('按索引删除工具').action(handleToolsDel);
  tools.command('generate <target>').description('生成工具').action(handleToolsGenerate);
}
