import { tool } from 'langchain';
import { z } from 'zod';
import { safeTool } from './utils';

export async function subAgentExec(prompt: string, runtime: any) {
  const curAgent = runtime.context?.curAgent;
  if (!curAgent || typeof curAgent.createSubAgent !== 'function') {
    throw new Error('当前运行上下文不支持创建子 agent');
  }

  const subAgent = await curAgent.createSubAgent();
  return subAgent.execute(prompt);
}

export const subAgentTool = tool(
  async ({ prompt }, runtime) => safeTool(() => subAgentExec(prompt, runtime)),
  {
    name: 'subAgent_exec',
    description: '创建一个通用子 agent 来执行独立任务，并返回子 agent 的执行结果。适合拆分复杂任务、并行调研或委派子任务。',
    schema: z.object({
      prompt: z.string().min(1).describe('交给通用子 agent 执行的完整任务描述'),
    }),
  },
);


