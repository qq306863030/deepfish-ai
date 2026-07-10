import { logInfo } from '@/client/cli-utils/print';
import { Command } from 'commander';

export function helpInformation(): string {
  return `Usage: ai [options] [command]

Commands:
  ai "xxx"                         直接向 AI 发起一次任务或对话

  # Configuration commands
  ai config edit                    打开全局配置文件进行编辑
  ai config view                    查看当前全局配置内容
  ai config reset                   重置全局配置为默认值
  ai config dir                     打开或输出全局配置目录

  # Model commands
  ai models add                     添加一个新的模型配置
  ai models ls                      查看已配置的模型列表
  ai models use <name>              切换当前默认使用的模型
  ai models del <name>              删除指定名称的模型配置

  # Skill commands
  ai skills ls                      查看已安装或已配置的技能列表
  ai skills add <name>              添加指定名称的技能
  ai skills del <index>             删除指定序号的技能
  ai skills enable <name|index>     启用指定名称或序号的技能
  ai skills disable <name|index>    禁用指定名称或序号的技能
  ai skills dir                     打开或输出技能目录
  ai skills generate xxx            根据描述生成一个新的技能模板

  # Tools commands
  ai tools ls                       查看已安装或已配置的工具列表
  ai tools dir                      打开或输出用户自定义工具目录
  ai tools add <name>               添加指定名称的工具
  ai tools del <index>              删除指定序号的自定义工具
  ai tools generate xxx             根据描述生成一个新的工具模板

  # Session commands
  ai session clear                  清空当前会话记录
  ai session dir                    打开或输出会话数据目录
  
  # Task commands
  ai task ls                        查看当前任务队列
  ai task add <task>                向任务队列添加一个后续任务
  ai task del <index>               删除指定序号的任务
  ai task clear                     清空当前任务队列

  # Plan commands
  ai plan-do <任务描述>              将复杂任务拆解为子任务并逐步执行完成
  ai plan-continue                   继续执行被中断的 plan-do 任务
  
  # MCP commands
  ai mcp edit                       打开 MCP 配置文件进行编辑
  ai mcp ls                         查看已配置的 MCP 服务器列表
  ai mcp enable <name|index>        启用指定名称或序号的 MCP 服务器
  ai mcp disable <name|index>       禁用指定名称或序号的 MCP 服务器
  
  # Server commands
  ai server                          启动服务（前台运行）
  ai server open                     前台直接运行服务（日志实时输出，Ctrl+C 停止）
  ai server start                    启动后台服务
  ai server stop                     停止后台服务
  ai server restart                  重启后台服务
  
  # Cache commands
  ai cache ls                       查看已缓存的学习内容列表
  ai cache edit <index|id>          编辑指定序号或 ID 的缓存内容
  ai cache del <index|id>           删除指定序号或 ID 的缓存内容
`;
}

export function registerHelpCommand(program: Command) {
  program.helpInformation = helpInformation;
  program
    .command('help')
    .description('Displaying help information')
    .action(() => {
      logInfo(helpInformation());
    });
}

export default helpInformation;
