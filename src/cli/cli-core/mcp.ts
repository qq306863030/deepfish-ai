import { getMCPFilePath } from '../cli-utils/getGlobalPath';
import { editFile } from '../../utils/normal';
import fs from 'fs-extra';
import { logInfo, logSuccess, logWarning, logError } from '../../utils/print';

export function handleMcpEdit() {
  const mcpPath = getMCPFilePath();
  editFile(mcpPath);
}

function readMcpConfig() {
  const mcpPath = getMCPFilePath();
  return fs.readJSONSync(mcpPath);
}

function writeMcpConfig(data: any) {
  const mcpPath = getMCPFilePath();
  fs.writeJSONSync(mcpPath, data, { spaces: 2 });
}

export function handleMcpLs() {
  const config = readMcpConfig();
  const servers = config.mcpServers || {};
  const entries = Object.entries(servers);

  if (entries.length === 0) {
    logWarning('No MCP servers configured yet');
    return;
  }

  logInfo('='.repeat(50));
  entries.forEach(([name, server]: [string, any], index: number) => {
    const disabled = server.disabled === true;
    if (disabled) {
      logInfo(`[${index}] ${name} [×]`);
    } else {
      logSuccess(`[${index}] ${name} [√]`);
    }
  });
  logInfo('='.repeat(50));
}

function _resolveMcpTarget(nameOrIndex: string, entries: string[]): number {
  const index = parseInt(nameOrIndex, 10);
  if (!isNaN(index) && index >= 0 && index < entries.length) {
    return index;
  }
  return entries.findIndex((name) => name === nameOrIndex);
}

function _toggleMcp(nameOrIndexStr: string, enabled: boolean) {
  const config = readMcpConfig();
  const servers = config.mcpServers || {};
  const entries = Object.keys(servers);

  const tokens = nameOrIndexStr.split(',').map(s => s.trim()).filter(Boolean);
  let hasError = false;
  for (const token of tokens) {
    const targetIndex = _resolveMcpTarget(token, entries);
    if (targetIndex === -1) {
      logError(`MCP server not found: ${token}`);
      hasError = true;
      continue;
    }
    const serverName = entries[targetIndex];
    servers[serverName].disabled = !enabled;
    const action = enabled ? 'enabled' : 'disabled';
    logSuccess(`MCP server "${serverName}" ${action}`);
  }
  writeMcpConfig(config);
  return hasError;
}

export function handleMcpEnable(nameOrIndex: string) {
  _toggleMcp(nameOrIndex, true);
}

export function handleMcpDisable(nameOrIndex: string) {
  _toggleMcp(nameOrIndex, false);
}
