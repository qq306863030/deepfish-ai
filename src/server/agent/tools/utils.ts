import { getScanDirPaths } from '@/client/cli-utils/getGlobalPath';
import { DynamicStructuredTool, tool } from 'langchain';
import { z } from 'zod';
import path from 'path';
import fs from 'fs-extra';
import { randomUUID } from 'crypto';
import type { Description, ErrorResult, SuccsessResult } from '@/@types/Tools';
import { logWarning } from '../../utils/print';
import { truncateOutput } from './fileTools';

export type ToolResult = SuccsessResult | ErrorResult;

type ToolFile = {
  dir: string | null;
  filePath: string;
};

type ToolOpt = {
  name: string;
  path: string;
  dir: string | null;
};

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

// 将 JSON Schema 节点递归转换为 zod schema
function jsonSchemaToZod(node: any): z.ZodTypeAny {
  if (!node || typeof node !== 'object') {
    return z.any();
  }

  const { type, description: desc, properties, items, required, enum: enumValues } = node;

  const withDesc = (schema: z.ZodTypeAny) => (desc ? schema.describe(desc) : schema);

  // 支持 enum
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    const allStrings = enumValues.every((v) => typeof v === 'string');
    if (allStrings) {
      return withDesc(z.enum(enumValues as [string, ...string[]]));
    }
  }

  switch (type) {
    case 'string':
      return withDesc(z.string());
    case 'number':
    case 'integer':
      return withDesc(z.number());
    case 'boolean':
      return withDesc(z.boolean());
    case 'array': {
      const itemSchema = items ? jsonSchemaToZod(items) : z.any();
      return withDesc(z.array(itemSchema));
    }
    case 'object': {
      const shape: Record<string, z.ZodTypeAny> = {};
      if (properties && typeof properties === 'object') {
        const requiredFields: string[] = Array.isArray(required) ? required : [];
        for (const [key, value] of Object.entries(properties)) {
          let childSchema = jsonSchemaToZod(value);
          if (!requiredFields.includes(key)) {
            childSchema = childSchema.optional();
          }
          shape[key] = childSchema;
        }
      }
      // 使用 passthrough 防止意外字段被 strip，保证嵌套 object 参数不会丢失
      return withDesc(z.object(shape).passthrough());
    }
    default:
      return withDesc(z.any());
  }
}

// 将一个普通函数转换为 LangChain 的工具函数
function toLangChainTool(func: (...args: any[]) => SuccsessResult | ErrorResult | string, description: Description, index: number): DynamicStructuredTool {
  const { name, description: desc, parameters } = description.function;
  const { properties } = parameters;

  // 将 description 中的 parameters 转换为 zod schema
  const zodProperties: Record<string, z.ZodTypeAny> = {};
  for (const [key, value] of Object.entries(properties)) {
    zodProperties[key] = jsonSchemaToZod(value);
  }

  const schema = z.object(zodProperties);

  // 包装函数，提取 args 中的参数传递给原函数，并处理返回值
  const wrappedFunc = async (args: any, runtime: any) => {
    try {
      const boundFunc = func.bind({
        createSubAgent: async (systemPrompt: string, prompt: string) => {
          return runtime.context.curAgent.subExecute(systemPrompt, prompt)
        },
        curAgent: runtime.context.curAgent,
      });
      const result = await boundFunc(...Object.values(args));
      if (typeof result === 'object' && result !== null && 'success' in result) {
        return serializeToolResult(result as ToolResult);
      }
      return serializeToolResult(successResult(result));
    } catch (error) {
      return serializeToolResult(errorResult(error));
    }
  };

  return tool(wrappedFunc, {
    name: `${name}_${index}`,
    description: desc,
    schema,
  });
}

// 文件扫描
function scanUserTools(excludeTools: string[], externalTools: string[]) {
  const files1 = _scanUserToolsFile();
  const files2 = _scanExternalToolsFile(externalTools)
  const tools: DynamicStructuredTool[] = [];
  [...files1, ...files2].forEach((toolFile) => {
    _loadToolsFromFile(toolFile.filePath, tools, excludeTools);
  });
  
  return tools;
}

function getUserToolList() {
  const files = _scanUserToolsFile();
  const toolOpts: ToolOpt[] = [];
  files.forEach((toolFile) => {
    const toolModule = require(toolFile.filePath);
    const { functions, descriptions } = toolModule;
    descriptions.forEach((desc: Description) => {
      if (!desc.type) {
        desc = {
          type: 'function',
          function: desc as any,
        };
      }
      const func = functions[desc.function.name];
      if (typeof func !== 'function') {
        return;
      }
      toolOpts.push({
        name: desc.function.name,
        path: toolFile.filePath,
        dir: toolFile.dir,
      });
    });
  });
  return toolOpts;
}

function _scanToolsFile(filePath: string) {
  let toolFile: ToolFile | null = null;
  if (fs.statSync(filePath).isDirectory()) {
    // 扫描目录中的js文件，如果包含index.js则只扫描index.js，否则扫描所有js文件
    const subDirPath = path.resolve(filePath);
    const subFiles = fs.readdirSync(subDirPath);
    const indexFile = subFiles.find((f) => f === 'index.js' || f === 'index.cjs');
    if (indexFile) {
      const filePath = _scanDeepFishJsFile(path.resolve(subDirPath, indexFile));
      if (filePath) {
        toolFile = {
          filePath,
          dir: subDirPath,
        };
      }
    } else {
      subFiles.forEach((subFile) => {
        const filePath = _scanDeepFishJsFile(path.resolve(subDirPath, subFile));
        if (filePath) {
          toolFile = {
            filePath,
            dir: subDirPath,
          };
        }
      });
    }
  } else {
    const toolfilePath = _scanDeepFishJsFile(filePath);
    if (toolfilePath) {
      toolFile = {
        filePath: toolfilePath,
        dir: null,
      };
    }
  }
  return toolFile;
}

function _scanExternalToolsFile(externalTools: string[]) {
  const toolFiles: ToolFile[] = [];
  externalTools.forEach((filePath) => {
    const toolFile = _scanToolsFile(filePath);
    if (toolFile) {
      toolFiles.push(toolFile);
    }
  });
  return toolFiles
}

function _scanUserToolsFile() {
  const toolFiles: ToolFile[] = [];
  const scanPaths = getScanDirPaths();
  scanPaths.forEach((scanPath) => {
    let toolsDir = scanPath;
    if (!scanPath.endsWith('@deepfish-ai')) {
      toolsDir = path.resolve(scanPath, 'tools');
    }
    // 扫描里面的目录和第一层级的js文件
    if (fs.pathExistsSync(toolsDir)) {
      const files = fs.readdirSync(toolsDir);
      files.forEach((file) => {
        const filePath = path.resolve(toolsDir, file);
        const toolFile = _scanToolsFile(filePath);
        if (toolFile) {
          toolFiles.push(toolFile);
        }
      });
    }
  });
  return toolFiles;
}

function _scanDeepFishJsFile(filePath: string) {
  if (filePath.endsWith('.js') || filePath.endsWith('.cjs')) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    if (fileContent.includes('module.exports') && fileContent.includes('descriptions') && fileContent.includes('functions')) {
      return filePath;
    }
  }
  return null;
}

// 读取文件中的functions和descriptions并转换为LangChain工具
function _loadToolsFromFile(filePath: string, tools: DynamicStructuredTool[], excludeTools: string[]) {
  try {
    const toolModule = require(filePath);
    const { functions, descriptions } = toolModule;
    if (!functions || typeof functions !== 'object' || !Array.isArray(descriptions)) {
      logWarning(`Skip invalid tool file: ${filePath}`);
      return;
    }

    descriptions.forEach((desc: Description, index:number) => {
      if (!desc.type) {
        desc = {
          type: 'function',
          function: desc as any,
        };
      }

      if (excludeTools.includes(desc.function.name)) {
        return;
      }

      const func = functions[desc.function.name];
      if (typeof func !== 'function') {
        logWarning(`Skip tool "${desc.function.name}": implementation not found in ${filePath}`);
        return;
      }

      const langChainTool = toLangChainTool(func, desc, index);
      tools.push(langChainTool);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarning(`Failed to load tool file: ${filePath}. ${message}`);
  }
}

export { scanUserTools, getUserToolList };
