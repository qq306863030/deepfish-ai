import fs from 'fs-extra';
import WebSocket from 'ws';
import inquirer from 'inquirer';
import { getConfig } from '../cli-utils/init-config';
import { getConfigPath } from '../cli-utils/getGlobalPath';
import { testServer, getAgentId } from '../cli-utils/init-agent';
import { getServePort } from '../cli-utils/getGlobalData';
import { logError, logErrorMsg, logInfo, logSuccess, logWarning, streamOutput } from '../../utils/print';
import Thinking from '../cli-utils/Thinking';
import chalk from 'chalk';
import * as readline from 'readline';

// ─── WebSocket 客户端 ────────────────────────────────

/**
 * 连接 agent-room，注册为 web 客户端，返回 WebSocket 实例。
 */
function connectAsWebClient(agentId: string): Promise<WebSocket> {
  const port = getServePort();
  const wsUrl = `ws://localhost:${port}/agent-room`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket connection timeout'));
    }, 10_000);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'register', clientType: 'web', id: agentId }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'registered') {
        clearTimeout(timeout);
        resolve(ws);
      } else if (msg.type === 'error') {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(msg.message || 'Registration failed'));
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * 处理远程 ask-question 消息：在本地终端展示问题，收集用户输入后回传。
 */
function handleRemoteQuestion(
  ws: WebSocket,
  payload: { questionId: string; question: string; type: string; choices: string[] },
) {
  const { questionId, question, type, choices } = payload;

  const showPrompt = async () => {
    if (type === 'confirm') {
      const { confirm } = await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: question }]);
      ws.send(JSON.stringify({ type: 'question-answer', payload: { questionId, answer: confirm ? 'yes' : 'no' } }));
      return;
    }
    if (type === 'select') {
      const { value } = await inquirer.prompt([{ type: 'list', name: 'value', message: question, choices }]);
      ws.send(JSON.stringify({ type: 'question-answer', payload: { questionId, answer: value } }));
      return;
    }
    // input / password
    const { value } = await inquirer.prompt([
      { type: type as any, name: 'value', message: question, mask: type === 'password' ? '*' : undefined },
    ]);
    ws.send(JSON.stringify({ type: 'question-answer', payload: { questionId, answer: value } }));
  };

  showPrompt().catch((err) => {
    logError(`Question handling error: ${err.message}`);
    ws.send(JSON.stringify({ type: 'question-answer', payload: { questionId, answer: '' } }));
  });
}

/** 处理服务端转发的日志消息，使用客户端 print 函数渲染 */
function handleLogMessage(msg: { payload: { level: string; message: string; color?: string } }) {
  const { level, message, color } = msg.payload;
  // 优先使用服务端传来的颜色，否则按 level 使用默认颜色
  if (color) {
    process.stdout.write(chalk.hex(color)(message) + '\n');
    return;
  }
  switch (level) {
    case 'info': logInfo(message); break;
    case 'success': logSuccess(message); break;
    case 'error': logError(message); break;
    case 'warning': logWarning(message); break;
    case 'stream': streamOutput(message); break;
    case 'tool-call': logInfo(message); break;
    case 'tool-return': logInfo(message); break;
    case 'tool-error': logError(message); break;
    default: logInfo(message);
  }
}

// ─── 单次执行 ────────────────────────────────────────

export async function handleInput(args: string[], skills?: string[]) {
  const input = args.join(' ');
  if (!input.trim()) {
    logError('Please enter content');
    return;
  }

  try {
    const configPath = getConfigPath();
    if (!fs.pathExistsSync(configPath)) {
      logError('Config file not found, please run init first');
      return;
    }

    const config = getConfig();
    if (!config?.currentModel) {
      logError('No AI model configured, please run ai model use <name>');
      return;
    }

    const isServerRunning = await testServer();
    if (!isServerRunning) {
      logError('Failed to start service, please check config or port availability');
      return;
    }

    // 以 web 客户端身份连接 agent-room，使用 session id 匹配 serve 端的 agent
    const agentId = getAgentId() || `cli-${process.pid}`;
    const ws = await connectAsWebClient(agentId);
    const thinking = new Thinking();
    return new Promise<void>((resolve, reject) => {
      let finished = false;
      const cleanup = () => {
        finished = true;
        ws.removeAllListeners();
        try { ws.close(); } catch { /* ignore */ }
      };

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'stream') {
          if (msg.color) {
            process.stdout.write(chalk.hex(msg.color)(msg.payload));
          } else {
            process.stdout.write(msg.payload);
          }
          return;
        }

        if (msg.type === 'thinking') {
          if (msg.payload === 'start') thinking.start();
          else thinking.stop();
          return;
        }

        if (msg.type === 'log') {
          handleLogMessage(msg);
          return;
        }

        if (msg.type === 'execute-done') {
          thinking.stop();
          cleanup();
          resolve();
          return;
        }

        if (msg.type === 'execute-error') {
          thinking.stop();
          cleanup();
          reject(new Error(msg.payload));
          return;
        }

        if (msg.type === 'ask-question') {
          handleRemoteQuestion(ws, msg.payload);
          return;
        }
      });

      ws.on('error', (err) => {
        if (!finished) {
          thinking.stop();
          cleanup();
          reject(err);
        }
      });

      ws.on('close', () => {
        if (!finished) {
          thinking.stop();
          cleanup();
          reject(new Error('WebSocket connection closed unexpectedly'));
        }
      });

      // 发送执行请求，携带当前工作目录和外部 skills
      ws.send(JSON.stringify({ type: 'execute', payload: { input, cwd: process.cwd(), skills } }));
    });
  } catch (error: any) {
    logErrorMsg(error as Error);
  }
}

// ─── 多轮对话 ────────────────────────────────────────

export async function multiInput() {
  try {
    const configPath = getConfigPath();
    if (!fs.pathExistsSync(configPath)) {
      logError('Config file not found, please run init first');
      return;
    }

    const config = getConfig();
    if (!config?.currentModel) {
      logError('No AI model configured, please run ai model use <name>');
      return;
    }

    const isServerRunning = await testServer();
    if (!isServerRunning) {
      logError('Failed to start service, please check config or port availability');
      return;
    }

    const agentId = getAgentId() || `cli-${process.pid}`;
    const ws = await connectAsWebClient(agentId);

    console.log('AI CLI Assistant');
    console.log('Type your question or command. Type "exit" to quit.');
    console.log('='.repeat(50));

    startReadlineLoop(ws);
  } catch (error: any) {
    logErrorMsg(error as Error);
  }
}

function startReadlineLoop(ws: WebSocket, thinking?: Thinking): readline.Interface {
  if (!thinking) thinking = new Thinking();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  rl.prompt();

  rl.on('line', (line) => {
    const input = line.trim();

    if (input.toLowerCase() === 'exit') {
      rl.close();
      ws.close();
      console.log('Goodbye!');
      process.exit(0);
      return;
    }

    // 关闭 readline 释放 stdin，让 inquirer 可以接管（处理交互式问题）
    rl.close();

    // 设置一次性消息处理器
    const onMessage = (data: WebSocket.Data) => {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'stream') {
        thinking!.start();
        if (msg.color) {
          process.stdout.write(chalk.hex(msg.color)(msg.payload));
        } else {
          process.stdout.write(msg.payload);
        }
        return;
      }

      if (msg.type === 'thinking') {
        if (msg.payload === 'start') thinking!.start();
        else thinking!.stop();
        return;
      }

      if (msg.type === 'log') {
        handleLogMessage(msg);
        return;
      }

      if (msg.type === 'execute-done') {
        ws.off('message', onMessage);
        thinking!.stop();
        console.log('='.repeat(50));
        // 重建 readline 进入下一轮
        const nextRl = startReadlineLoop(ws, thinking);
        nextRl.prompt();
        return;
      }

      if (msg.type === 'execute-error') {
        ws.off('message', onMessage);
        thinking!.stop();
        logError(msg.payload);
        console.log('='.repeat(50));
        const nextRl = startReadlineLoop(ws);
        nextRl.prompt();
        return;
      }

      if (msg.type === 'ask-question') {
        handleRemoteQuestion(ws, msg.payload);
        return;
      }
    };

    ws.on('message', onMessage);

    // 发送执行请求
    ws.send(JSON.stringify({ type: 'execute', payload: { input, cwd: process.cwd() } }));
  });

  return rl;
}
