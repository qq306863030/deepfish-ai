import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

function isNetworkUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

async function localImageToBase64(filePath: string): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`图片文件不存在: ${absolutePath}`);
  }

  const supportedExts = ['.png', '.jpg', '.jpeg', '.jfif', '.gif', '.webp', '.bmp', '.svg', '.ico', '.tiff', '.tif', '.avif', '.heic', '.heif'];
  const ext = path.extname(absolutePath).toLowerCase();

  if (!supportedExts.includes(ext)) {
    throw new Error(`不支持的图片格式: ${ext}`);
  }

  const rawBuffer = fs.readFileSync(absolutePath);

  // 小于 500KB 则跳过压缩，直接转为 Base64
  const FIVE_HUNDRED_KB = 500 * 1024;
  if (rawBuffer.length < FIVE_HUNDRED_KB) {
    return `data:image/jpeg;base64,${rawBuffer.toString('base64')}`;
  }

  const compressedBuffer = await sharp(rawBuffer)
    .resize({
      width: 1280,
      height: 1280,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 78 })
    .toBuffer();

  const base64 = compressedBuffer.toString('base64');

  return `data:image/jpeg;base64,${base64}`;
}

/**
 * 输入一个地址，如果是网络图片地址则直接返回，如果是本地图片文件地址则转换为 Base64
 * @param input 图片地址（网络 URL 或本地文件路径）
 * @returns 图片地址或 Base64 数据字符串
 */
export async function resolveImage(input: string): Promise<string> {
  if (isNetworkUrl(input)) {
    const res = await fetch(input);
    if (!res.ok) {
      throw new Error(`网络图片访问失败: ${res.status} ${res.statusText} — ${input}`);
    }
    return input;
  }

  return localImageToBase64(input);
}
