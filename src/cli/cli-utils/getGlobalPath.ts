import { HOME_DIR, WORKSPACE_DIR } from './SystemConfig';
import path from 'path';
import fs from 'fs-extra';
import getGlobalNodeModulesPath from './node-root';

// CJS 模式下 __dirname 直接可用
const getDirname = () => __dirname;

export function getHomePath() {
  return HOME_DIR;
}

export function getCodePath(): string {
  let dir = getDirname();
  const rootMarker = 'package.json';

  // 向上查找直到找到 package.json（项目根目录）
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, rootMarker))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return path.resolve(dir, '../../../');
}

export function getWorkspacePath() {
  return WORKSPACE_DIR;
}

export function getConfigPath() {
  return path.join(HOME_DIR, 'config.json5');
}

export function getUserPath() {
  return path.join(HOME_DIR, 'user');
}

export function getUserFilePath() {
  const userPath = getUserPath();
  return {
    memory: path.join(userPath, 'memory.md'),
    userInfo: path.join(userPath, 'user-info.md'),
    agentRules: path.join(userPath, 'agent-rules.md'),
    userStore: path.join(userPath, 'cache'),
  };
}

export function getSkillsPath() {
  return path.join(HOME_DIR, 'skills');
}

export function getToolsPath() {
  return path.join(HOME_DIR, 'tools');
}

export function getSessionsPath() {
  return path.join(HOME_DIR, 'sessions');
}

export function getSessionPath(agentId: string): string {
  const sessionsPath = getSessionsPath();
  return path.join(sessionsPath, agentId);
}

export function getSessionDirPath(agentId: string): string {
  const sessionDir = getSessionPath(agentId);
  return path.join(sessionDir, 'main-session');
}

export function getSessionMsgQueuePath(agentId: string): string {
  const sessionDir = getSessionPath(agentId);
  return path.join(sessionDir, 'main-msg-queue.json');
}

// 获取自动扫描路径 .deepfish目录和命令执行目录中的.deepfish目录
export function getScanDirPaths(): string[] {
  const workspacePath = getWorkspacePath();
  const homePath = getHomePath();
  const paths = new Set<string>();
  paths.add(path.join(workspacePath, '.deepfish-ai'));
  paths.add(path.join(homePath));
  // 获取nodejs的根目录
  const nodeRoot = path.join(getGlobalNodeModulesPath(), '@deepfish-ai')
  if (fs.existsSync(nodeRoot)) {
    paths.add(nodeRoot)
  }
  return Array.from(paths);
}

export function getMCPFilePath() {
  const mcpPath = path.join(HOME_DIR, 'mcp.json');
  if (!fs.pathExistsSync(mcpPath)) {
    fs.writeJSONSync(
      mcpPath,
      {
        mcpServers: {},
      },
      'utf-8',
    );
  }
  return mcpPath;
}

export function getUserStorePath() {
  const userPath = getUserPath();
  const cachePath = path.join(userPath, 'cache');
  fs.ensureDirSync(cachePath);
  return cachePath;
}
