import type { Command } from 'commander';
import { handleMcpEdit } from './cli-core/mcp';

export function registerMcpCommands(program: Command) {
  const mcp = program.command('mcp');
  mcp.command('edit').description('编辑 MCP 配置文件').action(handleMcpEdit);
}
