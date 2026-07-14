import * as fs from 'fs';
import * as path from 'path';

function isNetworkUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

function localImageToBase64(filePath: string): string {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`图片文件不存在: ${absolutePath}`);
  }

  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  const ext = path.extname(absolutePath).toLowerCase();
  const mime = mimeMap[ext];

  if (!mime) {
    throw new Error(`不支持的图片格式: ${ext}`);
  }

  const buffer = fs.readFileSync(absolutePath);
  const base64 = buffer.toString('base64');

  return `data:${mime};base64,${base64}`;
}

/**
 * 输入一个地址，如果是网络图片地址则直接返回，如果是本地图片文件地址则转换为 Base64
 * @param input 图片地址（网络 URL 或本地文件路径）
 * @returns 图片地址或 Base64 数据字符串
 */
export function resolveImage(input: string): string {
  if (isNetworkUrl(input)) {
    return input;
  }

  return localImageToBase64(input);
}
