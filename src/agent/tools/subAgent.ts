import { tool } from 'langchain';
import { z } from 'zod';
import { safeTool } from './utils';

export async function subAgentExec(systemPrompt:string, prompt: string, runtime: any) {
  const curAgent = runtime.context?.curAgent;
  return curAgent && curAgent.subExecute(systemPrompt, prompt)
}

export async function subAgentImageExec(systemPrompt: string, prompt: string, fileUrl: string, runtime: any) {
  const curAgent = runtime.context?.curAgent;
  const subAgent = await curAgent?.createSubAgent(systemPrompt);
  return subAgent && subAgent.imageRecognition(prompt, fileUrl);
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

export const subAgentImageTool = tool(
  async ({ systemPrompt, prompt, fileUrl }, runtime) => safeTool(() => subAgentImageExec(systemPrompt, prompt, fileUrl, runtime)),
  {
    name: 'subAgent_image',
    description: '创建一个专门用于图片识别的子 agent，支持网络图片 URL 和本地图片文件路径，自动将本地图片转为 Base64 后进行分析。适合识别图片内容、提取图片文字、分析图表等任务。',
    schema: z.object({
      systemPrompt: z.string().min(1).describe('图片识别子 agent 的系统提示词，定义其角色和行为规范'),
      prompt: z.string().min(1).describe('交给图片识别子 agent 执行的完整任务描述'),
      fileUrl: z.string().min(1).describe('图片地址，可以是网络 URL 或本地图片文件绝对路径'),
    }),
  },
);

/** 带并发限制的异步队列：同时最多执行 limit 个任务，返回结果数组（索引与输入一致） */
async function asyncPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.min(limit, items.length);
  if (workerCount === 0) return results;
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function subAgentBatchExec(
  prompts: { systemPrompt: string; prompt: string }[],
  parallelCount: number,
  runtime: any,
) {
  const curAgent = runtime.context?.curAgent;
  if (!curAgent) throw new Error('当前没有可用的 agent');

  return asyncPool(prompts, parallelCount, async ({ systemPrompt, prompt }) => {
    return curAgent.subExecute(systemPrompt, prompt);
  });
}

export const subAgentBatchTool = tool(
  async ({ prompts, parallelCount }, runtime) =>
    safeTool(() => subAgentBatchExec(prompts, parallelCount, runtime)),
  {
    name: 'subAgent_batch',
    description:
      '批量创建多个子 agent 并通过异步队列并行执行任务，返回所有子 agent 的结果数组（索引与输入数组一一对应）。' +
      '适合需要同时调研多个独立问题、并行处理多项独立任务的场景。',
    schema: z.object({
      prompts: z
        .array(
          z.object({
            systemPrompt: z.string().min(1).describe('子 agent 的系统提示词，定义其角色和行为规范'),
            prompt: z.string().min(1).describe('交给子 agent 执行的完整任务描述'),
          }),
        )
        .min(1)
        .describe('子 agent 提示词对象数组，每个对象包含 systemPrompt 和 prompt'),
      parallelCount: z
        .number()
        .int()
        .min(1)
        .max(5)
        .default(1)
        .describe('并行执行数量，最小 1，最大 5，默认 1'),
    }),
  },
);


