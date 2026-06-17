import path from 'path';
import pm2 from 'pm2';
import { logInfo, logSuccess, logError, logWarning } from '../../utils/print';
import { getServePort } from '../cli-utils/getGlobalData';
import { getCodePath } from '../cli-utils/getGlobalPath';

const PM2_APP_NAME = 'deepfish-ai-server';

function getPm2Config() {
  const port = getServePort();
  const serverScript = path.join(getCodePath(), 'dist/serve/pm2-server');
  return {
    name: PM2_APP_NAME,
    script: serverScript,
    cwd: getCodePath(),
    env: {
      NODE_ENV: 'production',
      PORT: String(port),
    },
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: path.join(getCodePath(), 'logs', 'pm2-error.log'),
    out_file: path.join(getCodePath(), 'logs', 'pm2-out.log'),
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  };
}

// 包装 pm2 操作为 Promise
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

function pm2Stop(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.stop(name, (err) => {
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
    
    // 检查是否已经running
    const processList = await pm2Describe(PM2_APP_NAME);
    const isRunning = processList.length > 0 && processList[0].pm2_env?.status === 'online';
    
    if (isRunning) {
      logWarning(`Service already running - http://localhost:${getServePort()}`);
      pm2Disconnect();
      return;
    }
    
    // 如果已存在但未running，先删除
    if (processList.length > 0) {
      logInfo('Cleaning up old process...');
      await pm2Delete(PM2_APP_NAME);
    }
    
    logInfo('Starting service...');
    const config = getPm2Config();
    await pm2Start(config);
    pm2Disconnect();
  } catch (err) {
    logError(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
    pm2Disconnect();
    process.exit(1);
  }
}

export async function handleServeStop() {
  try {
    logInfo('Stopping service...');
    await pm2Connect();
    
    const processList = await pm2Describe(PM2_APP_NAME);
    if (processList.length === 0) {
      logWarning('No running service found');
      pm2Disconnect();
      return;
    }
    
    await pm2Delete(PM2_APP_NAME);
    logSuccess('Service stopped');
    
    pm2Disconnect();
  } catch (err) {
    logError(`Failed to stop: ${err instanceof Error ? err.message : String(err)}`);
    pm2Disconnect();
    process.exit(1);
  }
}

export async function handleServeRestart() {
  try {
    logInfo('Restarting service...');
    await pm2Connect();
    
    const processList = await pm2Describe(PM2_APP_NAME);
    if (processList.length === 0) {
      logWarning('No running service found，starting...');
      const config = getPm2Config();
      await pm2Start(config);
    } else {
      await pm2Restart(PM2_APP_NAME);
    }
    
    logSuccess(`Service restarted - http://localhost:${getServePort()}`);
    
    pm2Disconnect();
  } catch (err) {
    logError(`Failed to restart: ${err instanceof Error ? err.message : String(err)}`);
    pm2Disconnect();
    process.exit(1);
  }
}

// 供 testServer 使用的工具函数
export async function isServerRunning(): Promise<boolean> {
  try {
    await pm2Connect();
    const processList = await pm2Describe(PM2_APP_NAME);
    const isRunning = processList.length > 0 && processList[0].pm2_env?.status === 'online';
    pm2Disconnect();
    return isRunning;
  } catch {
    pm2Disconnect();
    return false;
  }
}
