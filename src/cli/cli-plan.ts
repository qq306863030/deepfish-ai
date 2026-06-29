import type { Command } from 'commander';
import { handlePlan } from './cli-core/plan';

export function registerPlanCommands(program: Command) {
  program
    .command('plan-do')
    .description('将复杂任务拆解为子任务并逐步执行完成')
    .argument('[input...]', '任务描述')
    .action((input: string[]) => handlePlan(input));
}
