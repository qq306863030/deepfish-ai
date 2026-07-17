import os from 'os';

/**
 * 检测 Buffer 是否为合法的 UTF-8 序列（快速验证，不依赖外部包）
 */
function isValidUtf8(buffer: Buffer): boolean {
  let i = 0;
  const len = buffer.length;
  while (i < len) {
    const byte = buffer[i];
    if (byte <= 0x7f) {
      i++;
    } else if (byte >= 0xc2 && byte <= 0xdf) {
      // 2-byte: 110xxxxx 10xxxxxx
      if (i + 1 >= len) return false;
      const b2 = buffer[i + 1];
      if (b2 < 0x80 || b2 > 0xbf) return false;
      i += 2;
    } else if (byte === 0xe0) {
      // 3-byte: 11100000 1010xxxx 10xxxxxx
      if (i + 2 >= len) return false;
      const b2 = buffer[i + 1];
      const b3 = buffer[i + 2];
      if (b2 < 0xa0 || b2 > 0xbf || b3 < 0x80 || b3 > 0xbf) return false;
      i += 3;
    } else if (byte >= 0xe1 && byte <= 0xef) {
      if (byte === 0xed) {
        // 11101101 1010xxxx 10xxxxxx —  surrogate (U+D800..U+DFFF)
        if (i + 2 >= len) return false;
        const b2 = buffer[i + 1];
        if (b2 >= 0xa0) return false;
      }
      // 3-byte: 1110xxxx 10xxxxxx 10xxxxxx
      if (i + 2 >= len) return false;
      const b2 = buffer[i + 1];
      const b3 = buffer[i + 2];
      if (b2 < 0x80 || b2 > 0xbf || b3 < 0x80 || b3 > 0xbf) return false;
      i += 3;
    } else if (byte === 0xf0) {
      // 4-byte: 11110000 1001xxxx 10xxxxxx 10xxxxxx
      if (i + 3 >= len) return false;
      const b2 = buffer[i + 1];
      const b3 = buffer[i + 2];
      const b4 = buffer[i + 3];
      if (b2 < 0x90 || b2 > 0xbf || b3 < 0x80 || b3 > 0xbf || b4 < 0x80 || b4 > 0xbf) return false;
      i += 4;
    } else if (byte >= 0xf1 && byte <= 0xf3) {
      // 4-byte: 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
      if (i + 3 >= len) return false;
      for (let j = 1; j <= 3; j++) {
        const b = buffer[i + j];
        if (b < 0x80 || b > 0xbf) return false;
      }
      i += 4;
    } else if (byte === 0xf4) {
      // 4-byte: 11110100 1000xxxx 10xxxxxx 10xxxxxx
      if (i + 3 >= len) return false;
      const b2 = buffer[i + 1];
      const b3 = buffer[i + 2];
      const b4 = buffer[i + 3];
      if (b2 < 0x80 || b2 > 0x8f || b3 < 0x80 || b3 > 0xbf || b4 < 0x80 || b4 > 0xbf) return false;
      i += 4;
    } else {
      return false; // 无效首字节
    }
  }
  return true;
}

/**
 * 检测 Buffer 的字符编码（替代 chardet）
 * - 检查 BOM
 * - 尝试验证 UTF-8 合法性
 * - 失败则根据操作系统返回 gbk（Windows）或 utf-8
 */
export function detectEncoding(buffer: Buffer | null | undefined): string {
  if (!buffer || buffer.length === 0) {
    return os.platform() === 'win32' ? 'gbk' : 'utf-8';
  }

  // BOM 检测
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return 'utf-8';
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf-16le';
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return 'utf-16be';

  // 尝试验证 UTF-8
  if (isValidUtf8(buffer)) return 'utf-8';

  return os.platform() === 'win32' ? 'gbk' : 'utf-8';
}

/**
 * 使用原生 TextDecoder 解码 Buffer（替代 iconv-lite）
 * 支持 utf-8、gbk、utf-16le、big5 等 Node.js 内置编码
 */
export function decodeBuffer(buffer: Buffer, encoding: string): string {
  let normalized = encoding.toLowerCase().trim();

  // 兼容 iconv-lite 的编码别名
  if (normalized === 'cp936' || normalized === 'cp1252') normalized = 'gbk';
  if (normalized === 'utf8') normalized = 'utf-8';
  if (normalized === 'utf16le' || normalized === 'ucs2') normalized = 'utf-16le';
  if (normalized === 'utf16be') normalized = 'utf-16be';
  if (normalized === 'ascii' || normalized === 'latin1') normalized = 'latin1';

  try {
    return new TextDecoder(normalized, { fatal: true }).decode(buffer);
  } catch {
    // fatal 失败时尝试不抛出异常的版本
    try {
      return new TextDecoder(normalized).decode(buffer);
    } catch {
      // 未知编码，兜底用 utf-8
      return buffer.toString('utf-8');
    }
  }
}
