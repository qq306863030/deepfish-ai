import { describe, expect, test } from 'vitest';
import { grepTool } from './grep';

describe('grepTool', () => {
  test('当没有 query 或 pattern 时返回友好提示', async () => {
    const result = await grepTool.invoke({
      cwd: process.cwd(),
      includePattern: '**/*',
      isRegexp: false,
      includeHidden: false,
      maxResults: 10,
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('query 或 pattern');
  });
});
