import fs from 'fs-extra';
import JSON5 from 'json5';
import { getConfigPath, getHomePath } from '../cli-utils/getGlobalPath';
import { DEFAULT_CONFIG_JSON5 } from '../cli-utils/SystemConfig';
import { editFile, openDirectory } from '@/client/cli-utils/normal';
import { logInfo, logSuccess, logWarning } from '@/client/cli-utils/print';
import type { ConfigFile } from '@/@types/ConfigFile';

export function handleConfigEdit() {
  const configPath = getConfigPath();
  editFile(configPath);
}

export function handleConfigView() {
  const configPath = getConfigPath();
  if (!fs.pathExistsSync(configPath)) {
    logWarning('Config file not found, please run init first');
    return;
  }
  const content = fs.readFileSync(configPath, 'utf-8');
  const data = JSON5.parse(content) as ConfigFile;
  data.aiList?.forEach(item => {
    item.apiKey = '******'
  })
  logInfo('Current config:');
  logInfo(JSON.stringify(data, null, 2));
}

export function handleConfigReset() {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, DEFAULT_CONFIG_JSON5, 'utf-8');
  logSuccess('Config file reset to default values');
}

export function handleConfigDir() {
  const homePath = getHomePath();
  openDirectory(homePath);
}
