import path from 'path';
import { getCodePath, getSessionsPath } from './getGlobalPath';
import fs from 'fs-extra';
import type { Session } from '@/@types/ConfigFile';
import { getConfig } from './init-config';

export function getSessionList() {
  const sessionsPath = getSessionsPath();
  const sessionsFilePath = path.join(sessionsPath, 'sessions.json');
  let sessions: Session[] = [];
  if (fs.pathExistsSync(sessionsFilePath)) {
    sessions = fs.readJSONSync(sessionsFilePath);
  }
  return sessions;
}

export function getServePort() {
  const port = getConfig()?.serve?.port || 8866;
  return port;
}

export function getVersion() {
  const packageJson = fs.readJSONSync(path.join(getCodePath(), 'package.json'));
  return packageJson.version;
}

export function getEncoding() {
  return (getConfig()?.encoding || 'auto').toLowerCase();
}