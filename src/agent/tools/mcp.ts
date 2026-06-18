import { getScanDirPaths } from '@/cli/cli-utils/getGlobalPath';
import { logInfo, logWarning } from '@/utils/print';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import fs from 'fs-extra';
import type { DynamicStructuredTool } from 'langchain';
import path from 'path';

async function loadMcpToolsFromConfigPath(mcpFilePath: string): Promise<DynamicStructuredTool[]> {
  const jsonContent = fs.readJSONSync(mcpFilePath);
  const { mcpServers } = jsonContent;
  if (!mcpServers || Object.keys(mcpServers).length === 0) {
    return [];
  }
  try {
    for (const key of Object.keys(mcpServers)) {
      const server = mcpServers[key];
      if (!server.transport) {
        if (server.url) {
          if (server.url.startsWith('ws://') || server.url.startsWith('wss://')) {
            server.transport = 'websocket';
          } else if (server.url.startsWith('http://') || server.url.startsWith('https://')) {
            server.transport = 'http';
          }
        } else if (server.command === 'node' || server.command === 'npx') {
          server.transport = 'stdio';
        }
      }
      if (!server.transport) {
        logWarning(`Unable to determine transport for MCP server ${key}, skipping...`);
        delete mcpServers[key];
      }
    }
    logInfo(`Loading MCP tools from config path: ${mcpFilePath}`);
    const client = new MultiServerMCPClient(jsonContent.mcpServers);
    const tools = await client.getTools();
    logInfo(`Loaded ${tools.length} tools from MCP config.`);
    return tools;
  } catch (error) {
    console.log('Error loading MCP tools:', error);
    return [];
  }
}

export async function scanUserMcp() {
  const tools: DynamicStructuredTool[] = [];
  const scanPaths = getScanDirPaths();
  for (const scanPath of scanPaths) {
    const mcpFilePath = path.join(scanPath, 'mcp.json');
    if (fs.existsSync(mcpFilePath)) {
      const mcpTools = await loadMcpToolsFromConfigPath(mcpFilePath);
      tools.push(...mcpTools);
    }
  }
  return tools;
}
