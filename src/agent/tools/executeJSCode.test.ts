import { describe, expect, test } from 'vitest';
import { executeJSCode } from './executeJSCode';

describe('executeJSCode', () => {
  test('执行代码并返回当前时间 (dayjs)', async () => {
    const code = `async function __main() {
        const dayjs = require('dayjs');
        const now = dayjs();
        return now.format('YYYY年MM月DD日 HH:mm:ss');
    }`;

    const result = await executeJSCode(code, undefined as any);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d{4}年\d{2}月\d{2}日 \d{2}:\d{2}:\d{2}$/);
  });
});
