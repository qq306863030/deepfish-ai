import { getScanDirPaths } from '@/cli/cli-utils/getGlobalPath';
import { DynamicStructuredTool, tool } from 'langchain';
import { z } from 'zod';
import path from 'path';
import fs from 'fs-extra';
import { randomUUID } from 'crypto';

type succsessResult = {
  success: true;
  data: any;
};

type errorResult = {
  success: false;
  error: string;
  data?: any;
};

interface Description {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required: string[];
    };
  };
}

// 将一个普通函数转换为 LangChain 的工具函数
function toLangChainTool(func: (...args: any[]) => succsessResult | errorResult | string, description: Description): DynamicStructuredTool {
  const { name, description: desc, parameters } = description.function;
  const { properties, required } = parameters;

  // 将 description 中的 parameters 转换为 zod schema
  const zodProperties: Record<string, z.ZodTypeAny> = {};
  for (const [key, value] of Object.entries(properties)) {
    const { type, description: desc, ...rest } = value as { type: string; description?: string };
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
  const wrappedFunc = (args: any) => {
    const result = func(...Object.values(args));
    if (typeof result === 'object') {
      return JSON.stringify(result);
    } else {
      return result;
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
