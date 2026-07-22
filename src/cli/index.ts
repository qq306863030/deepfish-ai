import { Command } from 'commander';
import { registerConfigCommands } from './cli-config';
import { registerModelsCommands } from './cli-model';
import { registerSkillsCommands } from './cli-skills';
import { registerToolsCommands } from './cli-tools';
import { registerSessionCommands } from './cli-session';
import { registerServeCommands } from './cli-serve';
import { registerTaskCommands } from './cli-task';
import { registerMcpCommands } from './cli-mcp';
import { registerPlanCommands } from './cli-plan';
import { registerInputCommand } from './cli-input';
import { registerCacheCommands } from './cli-cache';
import { registerTimeTasksCommands } from './cli-time-tasks';
import { registerCommonFlags } from './cli-common';
import { initConfig } from './cli-utils/init-config';
import { registerHelpCommand } from './cli-help';

export default function main() {
  initConfig();
  const program = new Command('ai');
  
  registerConfigCommands(program);
  registerModelsCommands(program);
  registerSkillsCommands(program);
  registerToolsCommands(program);
  registerSessionCommands(program);
  registerServeCommands(program);
  registerTaskCommands(program);
  registerCommonFlags(program);
  registerMcpCommands(program);
  registerPlanCommands(program);
  registerCacheCommands(program);
  registerTimeTasksCommands(program);
  registerHelpCommand(program);
  registerInputCommand(program);
  
  program.parse(process.argv);
}
