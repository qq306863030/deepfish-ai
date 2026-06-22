import type { Command } from 'commander';
import { handleServeStart, handleServeStop, handleServeRestart } from './cli-core/serve';
import { logInfo, logError, logWarning, logSuccess } from '../utils/print';
import { getServePort } from './cli-utils/getGlobalData';
import { openDirectory } from '../utils/normal';

export function registerServeCommands(program: Command) {
  const serve = program.command('serve');
  serve.command('start').description('启动服务').action(handleServeStart);
  serve.command('stop').description('停止服务').action(handleServeStop);
  serve.command('restart').description('重启服务').action(handleServeRestart);

  // 新增：打开服务页面（检测服务状态）
  serve
    .command('open')
    .description('打开服务页面（检测服务是否已启动）')
    .action(async () => {
      const port = getServePort();
      const url = `http://localhost:${port}`;
      logInfo(`Checking service: ${url}`);
      try {
        const res = await fetch(`${url}/ping`, { method: 'GET' });
        const text = await res.text();
        if (text === 'pong') {
          logSuccess(`Service running, opening: ${url}`);
          openDirectory(url);
          return;
        }
        // 返回了非 pong，说明Port被其他服务占用
        logError(`Port ${port} is occupied but did not respond with expected content (received: ${text})`);
      } catch (err) {
        // fetch 抛错 → 连接失败，服务未running
        logWarning('Service not started, please run `ai serve start`');
      }
    });

  // 输入 ai serve 时不带子命令也触发启动
  serve.action(handleServeStart);
}
