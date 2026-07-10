import inquirer from 'inquirer';
import { tool } from 'langchain';
import { z } from 'zod';
import { safeTool } from './utils';

/**
 * 向用户发起交互式提问。
 * - 远程模式（agent 在 serve 中运行）：通过 agent-room WS 向 CLI 客户端提问
 * - 本地模式（agent 在 CLI 中运行）：直接使用 inquirer
 */
export async function askQuestion(
  question: string,
  type: 'input' | 'confirm' | 'select' | 'password' = 'input',
  choices: string[] = [],
  runtime?: any,
): Promise<string> {
  // 远程模式：agent 在 serve 中运行，通过 WS 向 CLI 客户端提问
  const curAgent = runtime?.context?.curAgent;
  if (curAgent?.roomClient?.connected) {
    const { askUserViaWebSocket, getOnlineWebClientIds } = await import('../../service/agent-room/server');
    const webClientIds = getOnlineWebClientIds();
    if (webClientIds.length > 0) {
      return askUserViaWebSocket(webClientIds[0], question, type, choices);
    }
  }

  // 本地模式：直接 inquirer
  const promptType = type === 'select' ? 'list' : type;
  const answer = await inquirer.prompt([
    {
      name: 'value',
      type: promptType as any,
      message: question,
      choices: type === 'select' ? choices : undefined,
    },
  ]);
  const value = answer['value'];
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * 替代 inquirer.prompt 的远程交互函数。
 * 参数与 inquirer.prompt 一致，内部优先通过 agent-room WS 向 CLI 客户端发起交互，
 * 无远程客户端时回退到本地 inquirer.prompt。
 *
 * @param questions - inquirer 问题配置（单个或数组）
 * @param initialAnswers - 初始答案（可选）
 * @param runtime - LangChain 运行时上下文，用于获取 agent 实例
 * @returns 与 inquirer.prompt 一致的 answers 对象
 */
export async function remotePrompt(questions: any): Promise<any> {
  const { askUserViaWebSocket, getOnlineWebClientIds } = await import('../../service/agent-room/server');
  const webClientIds = getOnlineWebClientIds();

  const list = Array.isArray(questions) ? questions : [questions];
  const answers: any = {};
  const useRemote = webClientIds.length > 0;

  for (const q of list) {
    // when: 条件判断，返回 false 则跳过
    if (typeof q.when === 'function') {
      if (!q.when(answers)) continue;
    } else if (q.when === false) {
      continue;
    }

    const qType = q.type === 'list' ? 'select' : q.type || 'input';
    let value: any;
    let lastError = '';

    if (useRemote) {
      // 远程模式：通过 WS 发送，循环直到 validate 通过
      while (true) {
        const raw = await askUserViaWebSocket(webClientIds[0], q.message || '', qType, q.choices || [], lastError || undefined);
        value = raw;
        // validate: 验证输入，返回 true 表示通过，返回字符串表示错误
        if (typeof q.validate === 'function') {
          const result = await q.validate(value, answers);
          if (result === true) break;
          lastError = String(result);
          continue;
        }
        break;
      }
    } else {
      // 本地回退：使用 inquirer.prompt（它自带 when/validate/filter）
      const localAnswers = await inquirer.prompt([q]);
      Object.assign(answers, localAnswers);
      continue;
    }

    // filter: 转换输入值
    if (typeof q.filter === 'function') {
      value = q.filter(value, answers);
    }

    answers[q.name || 'value'] = value;
  }

  return answers;
}

export const questionTool = tool(async ({ question, type, choices }, runtime) => safeTool(() => askQuestion(question, type, choices, runtime)), {
  name: 'ask_question',
  description:
    '当继续任务必须获取用户澄清、确认或选择时，向用户发起命令行提问并返回答案。支持以下输入类型：input（自由文本输入）、confirm（是/否确认）、select（单选列表）、password（密码输入，内容被隐藏）。',
  schema: z.object({
    question: z.string().describe('要询问用户的问题'),
    type: z
      .enum(['input', 'confirm', 'select', 'password'])
      .default('input')
      .describe('问题类型：input 文本输入、confirm 确认、select 单选、password 密码输入（内容隐藏）'),
    choices: z.array(z.string()).default([]).describe('select 单选项列表；非 select 类型可为空'),
  }),
});
