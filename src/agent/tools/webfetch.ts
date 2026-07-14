import { tool } from 'langchain';
import { z } from 'zod';
import { truncateOutput } from './fileTools';
import { safeTool } from './utils';

export async function webFetch(url: string, timeout = 30_000, maxLength = 60_000): Promise<string> {
  // 参数验证
  if (!url || typeof url !== 'string') {
    throw new Error('url 参数必须是非空字符串');
  }
  
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'user-agent': 'deepfish-ai/agent-tool',
        accept: 'text/html,text/plain,application/json,application/xml,*/*',
      },
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    return truncateOutput(
      JSON.stringify(
        {
          url,
          status: response.status,
          ok: response.ok,
          contentType,
          body: text,
        },
        null,
        2,
      ),
      maxLength,
    );
  } finally {
    clearTimeout(timer);
  }
}

export const webFetchTool = tool(async ({ url, timeout, maxLength }) => safeTool(() => webFetch(url, timeout, maxLength)), {
  name: 'web_fetch',
  description: '通过 HTTP GET 获取网页、接口或远程文本内容，并返回状态码、content-type 和响应正文。必须提供 url 参数。',
  schema: z.object({
    url: z.string().url().describe('要请求的完整 URL，例如 https://example.com。必须提供有效的 URL。'),
    timeout: z.number().default(30000).describe('请求超时时间（毫秒）'),
    maxLength: z.number().default(60000).describe('最大返回字符数，超出会截断'),
  }),
});
