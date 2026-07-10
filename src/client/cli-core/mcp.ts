import { getMCPFilePath } from '../cli-utils/getGlobalPath';
import { editFile } from '@/client/cli-utils/normal';
import fs from 'fs-extra';
import { logInfo, logSuccess, logWarning, logError } from '@/client/cli-utils/print';

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

export function handleMcpEnable(nameOrIndex: string) {
  const config = readMcpConfig();
  const servers = config.mcpServers || {};
  const entries = Object.keys(servers);

  let targetIndex = -1;
  const index = parseInt(nameOrIndex, 10);
  if (!isNaN(index) && index >= 0 && index < entries.length) {
    targetIndex = index;
  } else {
    targetIndex = entries.findIndex((name) => name === nameOrIndex);
  }

  if (targetIndex === -1) {
    logError(`MCP server not found: ${nameOrIndex}`);
    return;
  }

  const serverName = entries[targetIndex];
  servers[serverName].disabled = false;
  writeMcpConfig(config);
  logSuccess(`MCP server "${serverName}" enabled`);
}

export function handleMcpDisable(nameOrIndex: string) {
  const config = readMcpConfig();
  const servers = config.mcpServers || {};
  const entries = Object.keys(servers);

  let targetIndex = -1;
  const index = parseInt(nameOrIndex, 10);
  if (!isNaN(index) && index >= 0 && index < entries.length) {
    targetIndex = index;
  } else {
    targetIndex = entries.findIndex((name) => name === nameOrIndex);
  }

  if (targetIndex === -1) {
    logError(`MCP server not found: ${nameOrIndex}`);
    return;
  }

  const serverName = entries[targetIndex];
  servers[serverName].disabled = true;
  writeMcpConfig(config);
  logSuccess(`MCP server "${serverName}" disabled`);
}
