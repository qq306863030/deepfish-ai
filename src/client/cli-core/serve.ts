import path from 'path';
import fs from 'fs-extra';
import { spawn, execSync } from 'child_process';
import { logInfo, logSuccess, logError, logWarning } from '@/client/cli-utils/print';
import { getServePort } from '../cli-utils/getGlobalData';
import { getCodePath } from '../cli-utils/getGlobalPath';

const PID_FILE = path.join(getCodePath(), 'logs', 'serve.pid');

function readPid(): number | null {
  try {
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
      return Number.isFinite(pid) ? pid : null;
    }
  } catch { /* ignore */ }
  return null;
}

function writePid(pid: number) {
  fs.ensureDirSync(path.dirname(PID_FILE));
  fs.writeFileSync(PID_FILE, String(pid));
}

function removePid() {
  try { fs.removeSync(PID_FILE); } catch { /* ignore */ }
}

function isRunning(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/** 通过端口查找进程 PID（跨平台） */
function findPidByPort(port: number): number | null {
  try {
    if (process.platform === 'win32') {
      const stdout = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      for (const line of stdout.split('\n')) {
        // 匹配 LISTENING 状态的 PID（行末数字）
        const match = line.trim().match(/LISTENING\s+(\d+)/);
        if (match) return parseInt(match[1], 10);
      }
    } else {
      const stdout = execSync(`lsof -ti :${port} 2>/dev/null`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const pid = parseInt(stdout.trim(), 10);
      if (Number.isFinite(pid)) return pid;
    }
  } catch { /* 没有进程占用该端口或命令不存在 */ }
  return null;
}

/** 强制杀掉进程（跨平台） */
function forceKill(pid: number): boolean {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
    return true;
  } catch {
    return false;
  }
}

export async function handleServeStart() {
  try {
    const existingPid = readPid();
    if (existingPid && isRunning(existingPid)) {
      logWarning(`Service already running (PID: ${existingPid}) - http://localhost:${getServePort()}`);
      return;
    }
    if (existingPid) removePid();

    const port = getServePort();
    const script = path.join(getCodePath(), 'dist', 'server', 'server.js');

    logInfo('Starting service...');

    const child = spawn(process.execPath, [script], {
      cwd: getCodePath(),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(port),
        NODE_OPTIONS: '--no-warnings',
      },
      stdio: 'ignore',
      detached: true,
    });

    child.unref();

    if (child.pid) {
      writePid(child.pid);
      logSuccess(`Service started (PID: ${child.pid}) - http://localhost:${port}`);
    } else {
      logError('Failed to start service: no PID assigned');
    }
  } catch (err) {
    logError(`Failed to start service: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleServeStop() {
  try {
    let pid: number | null = null;

    // 1) 优先尝试 PID 文件
    const pidFromFile = readPid();
    if (pidFromFile && isRunning(pidFromFile)) {
      pid = pidFromFile;
    }

    // 2) 如果 PID 文件无效，尝试通过端口查找
    if (!pid) {
      const pidByPort = findPidByPort(getServePort());
      if (pidByPort) {
        logInfo(`Found process by port ${getServePort()} (PID: ${pidByPort})`);
        pid = pidByPort;
      }
    }

    if (!pid) {
      logWarning('No service PID found, service may not be running');
      return;
    }

    // 3) 强制杀掉进程
    logInfo(`Stopping service (PID: ${pid})...`);
    if (forceKill(pid)) {
      removePid();
      logSuccess('Service stopped');
    } else {
      logError('Failed to stop service');
    }
  } catch (err) {
    logError(`Failed to stop service: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleServeRestart() {
  await handleServeStop();
  // 等待端口释放
  await new Promise(resolve => setTimeout(resolve, 1000));
  await handleServeStart();
}

export async function handleServeOpen() {
  const port = getServePort();
  const url = `http://localhost:${port}`;
  const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    const { execSync } = await import('child_process');
    execSync(`${startCmd} ${url}`, { stdio: 'ignore' });
    logSuccess(`Opened ${url}`);
  } catch {
    logWarning(`Could not auto-open browser, please visit: ${url}`);
  }
}
