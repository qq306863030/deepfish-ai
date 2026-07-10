import type { Command } from 'commander';
import { handleServeStart, handleServeStop, handleServeRestart } from './cli-core/serve';
import { logInfo, logError, logSuccess } from '@/client/cli-utils/print';
import { getServePort } from '@/client/cli-utils/getGlobalData';
import path from 'path';
import { spawn } from 'child_process';
import { getCodePath } from '@/client/cli-utils/getGlobalPath';

/**
 * ai server open：前台直接运行服务（不走子进程），日志实时打印到终端，Ctrl+C 停止。
 */
function handleServeOpen() {
  const port = getServePort();
  const script = path.join(getCodePath(), 'dist', 'server', 'server.js');

  logInfo(`Starting service in foreground (port: ${port})...`);
  logInfo('Press Ctrl+C to stop\n');

  const child = spawn(process.execPath, [script], {
    cwd: getCodePath(),
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
    },
  });

  child.on('error', (err) => {
    logError(`Failed to start service: ${err.message}`);
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      logError(`Service exited with code ${code}`);
    }
  });
}

export function registerServeCommands(program: Command) {
  const server = program.command('server');
  server.command('start').description('启动服务（后台运行）').action(handleServeStart);
  server.command('stop').description('停止服务').action(handleServeStop);
  server.command('restart').description('重启服务').action(handleServeRestart);
  server.command('open').description('前台直接运行服务（日志实时输出，Ctrl+C 停止）').action(handleServeOpen);

  // 输入 ai server 时不带子命令也触发前台启动
  server.action(handleServeOpen);
}
