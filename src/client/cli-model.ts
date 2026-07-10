import type { Command } from 'commander';
import { handleModelAdd, handleModelLs, handleModelUse, handleModelDel } from './cli-core/models';

export function registerModelsCommands(program: Command) {
  const model = program.command('models');
  model.command('add').description('添加新的 AI 配置').action(handleModelAdd);
  model.command('ls').description('列出所有 AI 配置').action(handleModelLs);
  model.command('use <name>').description('切换到指定 AI 配置').action(handleModelUse);
  model.command('del <name>').description('删除指定 AI 配置').action(handleModelDel);
}
