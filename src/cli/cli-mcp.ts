import type { Command } from 'commander';
import {
  handleMcpEdit,
  handleMcpLs,
  handleMcpEnable,
  handleMcpDisable,
} from './cli-core/mcp';

export function registerMcpCommands(program: Command) {
  const mcp = program.command('mcp');
  mcp.command('edit').description('编辑 MCP 配置文件').action(handleMcpEdit);
  mcp.command('ls').description('列出所有 MCP 服务器').action(handleMcpLs);
  mcp
    .command('enable <nameOrIndex>')
    .description('启用 MCP 服务器')
    .action(handleMcpEnable);
  mcp
    .command('use <nameOrIndex>')
    .description('启用 MCP 服务器（同 enable）')
    .action(handleMcpEnable);
  mcp
    .command('disable <nameOrIndex>')
    .description('禁用 MCP 服务器')
    .action(handleMcpDisable);
}
