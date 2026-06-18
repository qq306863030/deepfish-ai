import fs from 'fs-extra';
import { getConfig } from '../cli-utils/init-config';
import { getConfigPath } from '../cli-utils/getGlobalPath';
import { connectAgentRoom, initAgent, testServer } from '../cli-utils/init-agent';
import { logError, logErrorMsg, logWarning } from '../../utils/print';
import TaskQueue from '../cli-utils/TaskQueue';
import * as readline from 'readline';

export async function handleInput(args: string[]) {
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
    const currentModelName = config!.currentModel;

    if (!currentModelName) {
      logError('No AI model configured, please run ai model use <name>');
      return;
    }
    const isServerRunning = await testServer();
    if (!isServerRunning) {
      logError('Failed to start service, please check config or port availability');
      return;
    }
    const agent = await initAgent(config!);
    // 连接agent socket服务器，并发送注册消息agentID
    const connResult = await connectAgentRoom(agent);
    if (!connResult.ok) {
      if (connResult.reason === 'duplicate-id') {
        logWarning(`[agent-room] agent "${agent.id}" is already running, task added to queue`);
        const taskQueue = new TaskQueue(agent);
        taskQueue.pushTask(input);
        return null;
      } else {
        logWarning('[agent-room] agent-room service not detected, running in offline mode');
      }
    }
    await agent.execute(input);
    // 断开连接
    agent.roomClient?.disconnect();
    // 杀死进程
    process.exit(0);
  } catch (error: any) {
    logErrorMsg(error as Error);
  }
}

// 进入多轮对话
export async function multiInput() {
  try {
    const configPath = getConfigPath();
    if (!fs.pathExistsSync(configPath)) {
      logError('Config file not found, please run init first');
      return;
    }

    const config = getConfig();
    const currentModelName = config!.currentModel;

    if (!currentModelName) {
      logError('No AI model configured, please run ai model use <name>');
      return;
    }
    const isServerRunning = await testServer();
    if (!isServerRunning) {
      logError('Failed to start service, please check config or port availability');
      return;
    }
    const agent = await initAgent(config!);
    // 连接agent socket服务器，并发送注册消息agentID
    const connResult = await connectAgentRoom(agent);
    if (!connResult.ok) {
      if (connResult.reason === 'duplicate-id') {
        logWarning(`[agent-room] agent "${agent.id}" is already running`);
        return null;
      } else {
        logWarning('[agent-room] agent-room service not detected, running in offline mode');
      }
    }
    // 进入多轮对话
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    });

    console.log('AI CLI Assistant');
    console.log('Type your question or command. Type "exit" to quit.');
    console.log('='.repeat(50));
    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();

      if (input.toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      try {
        await agent.execute(input);
      } catch (error: any) {
        console.error('Error:', error.message);
      }

      console.log('='.repeat(50));
      rl.prompt();
    });

    rl.on('close', () => {
      console.log('Goodbye!');
      process.exit(0);
    });
  } catch (error: any) {
    logErrorMsg(error as Error);
  }
}
