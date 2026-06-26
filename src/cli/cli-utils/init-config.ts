import fs from 'fs-extra';
import path from 'path';
import JSON5 from 'json5';
import { HOME_DIR, DEFAULT_CONFIG_JSON5 } from './SystemConfig';
import { getConfigPath, getMCPFilePath, getSessionsPath, getSkillsPath, getUserPath } from './getGlobalPath';
import type { ConfigFile } from '@/@types/ConfigFile';

// 初始化项目配置
export function initConfig() {
  fs.ensureDirSync(HOME_DIR);

  // 创建配置文件 -config.json5
  const configPath = getConfigPath();
  if (!fs.pathExistsSync(configPath)) {
    fs.writeFileSync(configPath, DEFAULT_CONFIG_JSON5, 'utf-8');
  }

  // 创建 user 目录及其文件
  const userDir = getUserPath();
  fs.ensureDirSync(userDir);
  for (const file of ['memory.md', 'user-info.md', 'agent-rules.md']) {
    const filePath = path.join(userDir, file);
    if (!fs.pathExistsSync(filePath)) {
      fs.writeFileSync(filePath, '', 'utf-8');
    }
  }
  fs.ensureDirSync(path.join(userDir, 'cache'));

  // 创建 skills 目录
  const skillsDir = getSkillsPath();
  fs.ensureDirSync(skillsDir);
  const skillsRegisterPath = path.join(skillsDir, 'register.json');
  if (!fs.pathExistsSync(skillsRegisterPath)) {
    fs.writeFileSync(skillsRegisterPath, '[]', 'utf-8');
  }

  // 创建 sessions 目录
  const sessionsDir = getSessionsPath();
  fs.ensureDirSync(sessionsDir);
  const sessionsIndexPath = path.join(sessionsDir, 'sessions.json');
  if (!fs.pathExistsSync(sessionsIndexPath)) {
    fs.writeFileSync(sessionsIndexPath, '{}', 'utf-8');
  }

  // 创建mcp.json文件
  getMCPFilePath();
}

export function getConfig(): ConfigFile | null {
  const configPath = getConfigPath();
  if (!fs.pathExistsSync(configPath)) {
    return null;
  }
  const content = fs.readFileSync(configPath, 'utf-8');
  return JSON5.parse(content) as ConfigFile;
}

export function updateConfig(data: ConfigFile): void {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON5.stringify(data, null, 2), 'utf-8');
}
