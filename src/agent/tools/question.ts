import inquirer from 'inquirer';
import { tool } from 'langchain';
import { z } from 'zod';
import { safeTool } from './utils';

export async function askQuestion(question: string, type: 'input' | 'confirm' | 'select' = 'input', choices: string[] = []): Promise<string> {
  const promptType = type === 'select' ? 'list' : type;
  const answer = await inquirer.prompt([
    {
      name: 'value',
      type: promptType,
      message: question,
      choices: type === 'select' ? choices : undefined,
    },
  ]);
  const value = answer['value'];
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export const questionTool = tool(async ({ question, type, choices }) => safeTool(() => askQuestion(question, type, choices)), {
  name: 'ask_question',
  description: '当继续任务必须获取用户澄清、确认或选择时，向用户发起命令行提问并返回答案。不要询问密码、密钥等敏感信息。',
  schema: z.object({
    question: z.string().describe('要询问用户的问题'),
    type: z.enum(['input', 'confirm', 'select']).default('input').describe('问题类型：input 文本输入、confirm 确认、select 单选'),
    choices: z.array(z.string()).default([]).describe('select 单选项列表；非 select 类型可为空'),
  }),
});
