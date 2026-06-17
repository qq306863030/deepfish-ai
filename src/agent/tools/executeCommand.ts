import { logError, logSuccess } from '@/utils/print';
import { spawnSync } from 'child_process';
import chardet from 'chardet';
import os from 'os';
import iconv from 'iconv-lite';
import { tool, type ToolRuntime } from 'langchain';
import { z } from 'zod';
import { getTrueCwd } from '@/utils/normal';
import { getEncoding } from '@/cli/cli-utils/getGlobalData';


export function executeCommand(command: string, timeout = -1, cwd?: string): string {
  logSuccess(`Executing system command: ${command}; ${timeout > 0 ? `Timeout: ${timeout}ms` : 'No timeout limit'}`);
  try {
    const result = spawnSync(command, {
      cwd: cwd || getTrueCwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      encoding: 'buffer',
      windowsHide: true,
      timeout: timeout > 0 ? timeout : undefined,
    });
    let targetEncoding = getEncoding();
    if (!targetEncoding || targetEncoding === 'auto') {
      targetEncoding = detectEncoding(result.stdout || result.stderr);
    }
    const stdout = iconv.decode(result.stdout, targetEncoding);
    const stderr = iconv.decode(result.stderr, targetEncoding);
    const code = result.status;
    if (stderr && !stderr.trim().startsWith('WARNING')) {
      const error = new Error(`Command failed (code ${code}): ${stderr.trim()}`);
      logError(`Execute error: ${error.message}`);
      return `Execute error: ${error.message}`;
    }
    logSuccess(`${stdout}\nCommand executed successfully`);
    return stdout || 'Command executed successfully';
  } catch (decodeError: any) {
    logError(`Encoding convert error: ${decodeError.message}`);
    return `Failed to parse command output: ${decodeError.message}`;
  }
}

function detectEncoding(buffer: any): string {
  if (!buffer) {
    return os.platform() === 'win32' ? 'gbk' : 'utf-8';
  }
  const detected = chardet.detect(buffer);
  const encoding = detected?.toLowerCase();
  if (encoding === 'utf-8') {
    return 'utf-8';
  }
  if (encoding && ['gbk', 'gb2312', 'gb18030'].includes(encoding)) {
    return 'gbk';
  }
  return os.platform() === 'win32' ? 'gbk' : 'utf-8';
}

export const executeCommandTool = tool(
  ({ command, timeout }, config: ToolRuntime) => {
    return executeCommand(command, timeout);
  },
  {
    name: 'execute_command',
    description:
      `在本地系统(${os.platform()})上执行一条 shell 命令并返回输出结果。适用于running脚本、操作文件系统、启动进程等场景。必须注意操作系统的兼容性，当前操作系统为 ${os.platform()}。`,
    schema: z.object({
      command: z.string().describe('要执行的 shell 命令'),
      timeout: z.number().default(-1).describe('超时时间（毫秒），-1 表示不限制'),
    }),
  },
);
