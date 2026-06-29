import { logError, logInfo } from '@/utils/print';
import { tool } from 'langchain';
import { z } from 'zod';
import { getCodePath } from '@/cli/cli-utils/getGlobalPath';
import path from 'path';
import fs from 'fs-extra';
import { executeCommand } from './executeCommand';
import { safeTool } from './utils';
import { subAgentExec } from './subAgent';

declare const require: any;
// CJS 模式下 require 直接可用


/**
 * 执行一段 Node.js 代码字符串，返回执行结果
 * @param {string} code - 要执行的代码
 * @returns {Promise<any>} 执行结果
 */
export async function executeJSCode(code: string, runtime: any) {
  logInfo('Executing JavaScript code: ');
  logInfo(code);
  try {
    // 在代码最后一条表达式前注入 return，使 async wrapper 能返回其结果
    const wrapped = `return (async () => {
        ${code}
        const result = await __main()
        return result || "Code executed successfully, but __main() did not return anything."
    })()`;
    const fn = new Function('require', 'agentExec', wrapped);
    const _require: any = require;
    const newRequire = (modulePath:string) => {
      if (modulePath.startsWith('./')) {
        const resolvedPath = path.resolve(process.cwd(), modulePath)
        return _require(resolvedPath)
      }
      return _require(modulePath)
    }
    const agentExec = async (prompt: string) => {
      return subAgentExec(prompt, runtime)
    }
    const result = await fn(newRequire, agentExec);
    return result;
  } catch (error: any) {
    logError(`Error executing code: ${error.stack}`);
    throw error;
  }
}

// 获取当前已安装的包的列表
const getInstalledPackagesTool = tool(
  async () =>
    safeTool(() => {
      const packageJson = path.join(getCodePath(), './package.json');
      const pkg = fs.readJsonSync(packageJson);
      return pkg.dependencies;
    }),
  {
    name: 'get_installed_packages',
    description: '获取 deepfish-ai CLI 工具自身已安装的 npm 依赖包列表',
    schema: z.object({}),
  },
);

const checkPackageInstalledTool = tool(
  async ({ packageName }) =>
    safeTool(() => {
      const packageJson = path.join(getCodePath(), './package.json');
      const pkg = fs.readJsonSync(packageJson);
      const installed = Object.prototype.hasOwnProperty.call(pkg.dependencies, packageName);
      return { packageName, installed };
    }),
  {
    name: 'check_package_installed',
    description: '检查指定的 npm 包是否已在 deepfish-ai CLI 工具中安装',
    schema: z.object({
      packageName: z.string().describe('要检查的 npm 包名称'),
    }),
  },
);

const installPackageTool = tool(
  async ({ packageName }) =>
    safeTool(() => {
      const packageJson = path.join(getCodePath(), './package.json');
      const pkg = fs.readJsonSync(packageJson);
      if (Object.prototype.hasOwnProperty.call(pkg.dependencies, packageName)) {
        return `Package "${packageName}" is already installed.`;
      }
      return executeCommand(`npm install ${packageName}`, 120000, getCodePath());
    }),
  {
    name: 'install_package',
    description: '在 deepfish-ai CLI 工具中安装指定的 npm 包，使 execute_js_code 可以 require 该包',
    schema: z.object({
      packageName: z.string().describe('要安装的 npm 包名称'),
    }),
  },
);

const executeJSCodeTool = tool(async ({ code }, runtime) => safeTool(() => executeJSCode(code, runtime)), {
  name: 'execute_js_code',
  description: `执行一段Node.js代码并返回执行结果。注意：1.如果代码中使用第三方依赖必须先使用check_package_installed工具检查包是否安装，如果未安装需要执行install_package工具安装指定的npm包;2.代码必须包含一个__main()函数作为执行入口，__main()函数内必须是一个使用async前缀的函数。
        可用内置函数：
        - agentExec(prompt: string): Promise<string>，创建一个通用子 agent 执行指定任务并返回结果，适合将复杂任务拆分给子 agent 完成。
        示例代码：
        async function __main() {
          const data = await fs.readFile("data.txt", "utf-8")
          const analysis = await agentExec("请分析这段文件内容并总结重点：" + data)
          return analysis
        }
        `,
  schema: z.object({
    code: z.string().describe('要执行的Node.js代码'),
  }),
});
export const packageTools = [getInstalledPackagesTool, checkPackageInstalledTool, installPackageTool, executeJSCodeTool];
