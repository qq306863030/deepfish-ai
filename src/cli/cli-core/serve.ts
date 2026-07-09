import path from 'path';
import pm2 from 'pm2';
import { logInfo, logSuccess, logError, logWarning } from '../../utils/print';
import { getServePort } from '../cli-utils/getGlobalData';
import { getCodePath } from '../cli-utils/getGlobalPath';

const PM2_APP_NAME = 'deepfish-ai-server';

function getPm2Config() {
  const port = getServePort();
  const serverScript = path.join(getCodePath(), 'dist', 'serve', 'pm2-server');
  return {
    name: PM2_APP_NAME,
    script: serverScript,
    cwd: getCodePath(),
    node_args: '--no-warnings',
    env: {
      NODE_ENV: 'production',
      PORT: String(port),
      NODE_OPTIONS: '--no-warnings',
    },
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: path.join(getCodePath(), 'logs', 'pm2-error.log'),
    out_file: path.join(getCodePath(), 'logs', 'pm2-out.log'),
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  };
}

function pm2Connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function pm2Start(config: any): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.start(config, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function pm2Delete(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.delete(name, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function pm2Restart(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.restart(name, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function pm2Describe(name: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    pm2.describe(name, (err, processList) => {
      if (err) reject(err);
      else resolve(processList);
    });
  });
}

function pm2Disconnect() {
  pm2.disconnect();
}

export async function handleServeStart() {
  try {
    logInfo('Checking service status...');
    await pm2Connect();

    const processList = await pm2Describe(PM2_APP_NAME);
    const isRunning = processList.length > 0 && processList[0].pm2_env?.status === 'online';

    if (isRunning) {
      logWarning(`Service already running - http://localhost:${getServePort()}`);
      pm2Disconnect();
      return;
    }

    if (processList.length > 0) {
      logInfo('Cleaning up old process...');
      await pm2Delete(PM2_APP_NAME);
    }

    logInfo('Starting service...');
    await pm2Start(getPm2Config());
    pm2Disconnect();
    logSuccess(`Service started: http://localhost:${getServePort()}`);
  } catch (err) {
    logError(`Failed to start service: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleServeStop() {
  try {
    await pm2Connect();
    await pm2Delete(PM2_APP_NAME);
    pm2Disconnect();
    logSuccess('Service stopped');
  } catch (err) {
    logError(`Failed to stop service: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleServeRestart() {
  try {
    await pm2Connect();
    await pm2Restart(PM2_APP_NAME);
    pm2Disconnect();
    logSuccess('Service restarted');
  } catch (err) {
    logError(`Failed to restart service: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleServeOpen() {
  const port = getServePort();
  const url = `http://localhost:${port}`;
  const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    const { execSync } = await import('child_process');
    execSync(`${start} ${url}`, { stdio: 'ignore' });
    logSuccess(`Opened ${url}`);
  } catch {
    logWarning(`Could not auto-open browser, please visit: ${url}`);
  }
}
