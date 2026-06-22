import UserCache from '../cli-utils/UserCache';
import { editFile } from '../../utils/normal';
import { logInfo, logSuccess, logWarning } from '../../utils/print';
import path from 'path';
import { getUserStorePath } from '../cli-utils/getGlobalPath';

const userCache = new UserCache();

function resolveId(input: string): string | null {
  // 尝试按 index 解析
  const index = Number(input);
  if (!isNaN(index) && Number.isInteger(index)) {
    const item = userCache.getByIndex(index);
    if (!item) {
      logWarning(`Invalid index: ${input}`);
      return null;
    }
    return item.id;
  }
  // 按 id 查找
  const catalog = userCache.list();
  const found = catalog.find((c) => c.id === input);
  if (!found) {
    logWarning(`Cache item with id "${input}" not found`);
    return null;
  }
  return input;
}

export function handleCacheList() {
  const catalog = userCache.list();
  if (catalog.length === 0) {
    logInfo('Cache is empty');
    return;
  }
  catalog.forEach((item, index) => {
    const desc = item.description.length > 20
      ? item.description.slice(0, 20) + '...'
      : item.description;
  });
}

export function handleCacheEdit(input: string) {
  const id = resolveId(input);
  if (!id) return;
  const filePath = path.join(getUserStorePath(), `${id}.md`);
  editFile(filePath);
}

export function handleCacheDel(input: string) {
  const id = resolveId(input);
  if (!id) return;
  const success = userCache.del(id);
  if (success) {
    logSuccess(`Cache item deleted: ${id}`);
  } else {
    logWarning(`Delete failed: ${id}`);
  }
}
