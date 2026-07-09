import { getScanDirPaths } from '@/cli/cli-utils/getGlobalPath';
import { logError, logInfo, logWarning } from '@/utils/print';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import fs from 'fs-extra';
import { tool, type DynamicStructuredTool } from 'langchain';
import path from 'path';
import { z } from 'zod';
import { errorResult, serializeToolResult, successResult } from './utils';

function normalizeMcpToolResult(result: unknown): unknown {
  if (Array.isArray(result)) {
    return result.map((item) => normalizeMcpToolResult(item));
  }
  if (result && typeof result === 'object' && 'content' in result) {
    return result;
  }
  return result;
}

function wrapMcpTool(mcpTool: DynamicStructuredTool): DynamicStructuredTool {
  const wrapped = tool(
    async (input, runtime) => {
      try {
        const result = await mcpTool.invoke(input, runtime);
        return serializeToolResult(successResult(normalizeMcpToolResult(result)));
      } catch (error) {
        return serializeToolResult(errorResult(error));
      }
    },
    {
      name: mcpTool.name,
      description: mcpTool.description,
      schema: (mcpTool as any).schema ?? z.object({}),
    },
  );
  return wrapped as unknown as DynamicStructuredTool;
}

const mcpToolsCache = new Map<string, DynamicStructuredTool[]>();
async function loadMcpToolsFromConfigPath(mcpFilePath: string, excludeMCP: string[]): Promise<DynamicStructuredTool[]> {
  const jsonContent = fs.readJSONSync(mcpFilePath);
  let mcpServers = jsonContent.mcpServers;
  if (!mcpServers || Object.keys(mcpServers).length === 0) {
    return [];
  }
  try {
    for (const key of Object.keys(mcpServers)) {
      const server = mcpServers[key];
      if (server.disabled || excludeMCP.includes(key)) {
        delete mcpServers[key];
        continue;
      }
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
    if (Object.keys(mcpServers).length === 0) {
      return [];
    }
    

    logInfo(`Loading MCP tools from config path: ${mcpFilePath}`);
    const tools = []
    for (const key of Object.keys(mcpServers)) {
      if (mcpToolsCache.has(key)) {
        const serverTools = mcpToolsCache.get(key) || [];
        tools.push(...serverTools);
        continue;
      }
      const client = new MultiServerMCPClient({
        key: mcpServers[key]
      });
      const serverTools = await client.getTools();
      tools.push(...serverTools);
    }
    logInfo(`Loaded ${tools.length} tools from MCP config.`);
    return tools.map(wrapMcpTool);
  } catch (error) {
    logError('Error loading MCP tools:' + error);
    return [];
  }
}

export async function scanUserMcp(excludeMCP: string[]) {
  const tools: DynamicStructuredTool[] = [];
  const scanPaths = getScanDirPaths();
  for (const scanPath of scanPaths) {
    const mcpFilePath = path.join(scanPath, 'mcp.json');
    if (fs.existsSync(mcpFilePath)) {
      const mcpTools = await loadMcpToolsFromConfigPath(mcpFilePath, excludeMCP);
      tools.push(...mcpTools);
    }
  }
  return tools;
}
