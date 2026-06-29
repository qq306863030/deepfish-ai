import { tool } from 'langchain';
import { z } from 'zod';
import { safeTool } from './utils';

export async function subAgentExec(systemPrompt:string, prompt: string, runtime: any) {
  const curAgent = runtime.context?.curAgent;
  return curAgent && curAgent.subExecute(systemPrompt, prompt)
}

export const subAgentTool = tool(
  async ({ systemPrompt, prompt }, runtime) => safeTool(() => subAgentExec(systemPrompt, prompt, runtime)),
  {
    name: 'subAgent_exec',
    description: '创建一个通用子 agent 来执行独立任务，并返回子 agent 的执行结果。适合拆分复杂任务、并行调研或委派子任务。',
    schema: z.object({
      systemPrompt: z.string().min(1).describe('子 agent 的系统提示词，定义其角色和行为规范'),
      prompt: z.string().min(1).describe('交给通用子 agent 执行的完整任务描述'),
    }),
  },
);


