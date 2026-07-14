import { describe, expect, test } from 'vitest';
import path from 'path';
import { resolveImage } from './image';

describe('resolveImage', () => {
  test('本地图片 cn.png 转为 Base64', () => {
    const filePath = path.resolve(__dirname, 'cn.png');
    const result = resolveImage(filePath);

    console.log('resolveImage 返回值:', result.slice(0, 80) + '...');
    console.log('返回值长度:', result.length);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
  });
});
