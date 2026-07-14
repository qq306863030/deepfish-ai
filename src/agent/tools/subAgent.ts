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


