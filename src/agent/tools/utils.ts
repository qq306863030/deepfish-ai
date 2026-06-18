import { getScanDirPaths } from '@/cli/cli-utils/getGlobalPath';
import { DynamicStructuredTool, tool } from 'langchain';
import { z } from 'zod';
import path from 'path';
import fs from 'fs-extra';
import { randomUUID } from 'crypto';
import type { Description, ErrorResult, SuccsessResult } from '@/@types/Tools';
import { truncateOutput } from './fileTools';

export type ToolResult = SuccsessResult | ErrorResult;

export function successResult(data: any): SuccsessResult {
  return { success: true, data };
}

export function errorResult(error: unknown, data?: any): ErrorResult {
  const message = error instanceof Error ? error.message : String(error);
  return data === undefined ? { success: false, error: message } : { success: false, error: message, data };
}

export function serializeToolResult(result: ToolResult): string {
  return truncateOutput(JSON.stringify(result, null, 2));
}

export async function safeTool<T>(handler: () => T | Promise<T>): Promise<string> {
  try {
    const data = await handler();
    return serializeToolResult(successResult(data));
  } catch (error) {
    return serializeToolResult(errorResult(error));
  }
}

// 将一个普通函数转换为 LangChain 的工具函数
function toLangChainTool(func: (...args: any[]) => SuccsessResult | ErrorResult | string, description: Description): DynamicStructuredTool {
  const { name, description: desc, parameters } = description.function;
  const { properties } = parameters;

  // 将 description 中的 parameters 转换为 zod schema
  const zodProperties: Record<string, z.ZodTypeAny> = {};
  for (const [key, value] of Object.entries(properties)) {
    const { type, description: desc } = value as { type: string; description?: string };
    let zodType: z.ZodTypeAny;
    switch (type) {
      case 'string':
        zodType = desc ? z.string().describe(desc) : z.string();
        break;
      case 'number':
        zodType = desc ? z.number().describe(desc) : z.number();
        break;
      case 'boolean':
        zodType = desc ? z.boolean().describe(desc) : z.boolean();
        break;
      case 'object':
        zodType = desc ? z.object({}).describe(desc) : z.object({});
        break;
      case 'array':
        zodType = desc ? z.array(z.string()).describe(desc) : z.array(z.string());
        break;
      default:
        zodType = z.any();
    }
    zodProperties[key] = zodType;
  }

  const schema = z.object(zodProperties);

  // 包装函数，提取 args 中的参数传递给原函数，并处理返回值
  const wrappedFunc = async (args: any) => {
    try {
      const result = await func(...Object.values(args));
      if (typeof result === 'object' && result !== null && 'success' in result) {
        return serializeToolResult(result as ToolResult);
      }
      return serializeToolResult(successResult(result));
    } catch (error) {
      return serializeToolResult(errorResult(error));
    }
  };

  return tool(wrappedFunc, {
    name: `${name}_${randomUUID().slice(0, 3)}`,
    description: desc,
    schema,
  });
}

// 文件扫描 todo
function scanUserTools() {
  const tools: DynamicStructuredTool[] = [];
  const scanPaths = getScanDirPaths();
  scanPaths.forEach((scanPath) => {
    const toolsDir = path.resolve(scanPath, 'tools');
    // 扫描里面的目录和第一层级的js文件
    if (fs.pathExistsSync(toolsDir)) {
      const files = fs.readdirSync(toolsDir);
      files.forEach((file) => {
        if (fs.statSync(path.resolve(toolsDir, file)).isDirectory()) {
          // 扫描目录中的js文件，如果包含index.js则只扫描index.js，否则扫描所有js文件
          const subDirPath = path.resolve(toolsDir, file);
          const subFiles = fs.readdirSync(subDirPath);
          const indexFile = subFiles.find((f) => f === 'index' || f === 'index.cjs');
          if (indexFile) {
            const filePath = _scanDeepFishJsFile(path.resolve(subDirPath, indexFile), indexFile);
            if (filePath) {
              _loadToolsFromFile(filePath, tools);
            }
          } else {
            subFiles.forEach((subFile) => {
              const filePath = _scanDeepFishJsFile(path.resolve(subDirPath, subFile), subFile);
              if (filePath) {
                _loadToolsFromFile(filePath, tools);
              }
            });
          }
        } else {
          const filePath = _scanDeepFishJsFile(toolsDir, file);
          if (filePath) {
            _loadToolsFromFile(filePath, tools);
          }
        }
      });
    }
  });
  return tools;
}

function _scanDeepFishJsFile(filePath: string, fileName: string) {
  if (fileName.endsWith('.js') || fileName.endsWith('.cjs')) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    if (fileContent.includes('module.exports') && fileContent.includes('descriptions') && fileContent.includes('functions')) {
      return filePath;
    }
  }
  return null;
}

// 读取文件中的functions和descriptions并转换为LangChain工具
function _loadToolsFromFile(filePath: string, tools: DynamicStructuredTool[]) {
  const toolModule = require(filePath);
  const { functions, descriptions } = toolModule;
  descriptions.forEach((desc: Description) => {
    const func = functions[desc.function.name];
    if (func) {
      const langChainTool = toLangChainTool(func, desc);
      tools.push(langChainTool);
    }
  });
}

export { scanUserTools };
