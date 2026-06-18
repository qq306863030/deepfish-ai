import { tool } from 'langchain';
import { z } from 'zod';
import { truncateOutput } from './fileTools';

export async function webFetch(url: string, timeout = 30_000, maxLength = 60_000): Promise<string> {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Web fetch error: ${message}`;
  } finally {
    clearTimeout(timer);
  }
}

export const webFetchTool = tool(
  async ({ url, timeout, maxLength }) => webFetch(url, timeout, maxLength),
  {
    name: 'web_fetch',
    description: '通过 HTTP GET 获取网页、接口或远程文本内容，并返回状态码、content-type 和响应正文。',
    schema: z.object({
      url: z.string().url().describe('要请求的完整 URL，例如 https://example.com'),
      timeout: z.number().default(30000).describe('请求超时时间（毫秒）'),
      maxLength: z.number().default(60000).describe('最大返回字符数，超出会截断'),
    }),
  },
);
