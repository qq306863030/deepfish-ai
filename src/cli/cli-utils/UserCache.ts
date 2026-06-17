import { getUserStorePath } from '@/cli/cli-utils/getGlobalPath';
import path from 'path';
import fs from 'fs-extra';
import { type Catalog } from '@/@types/ConfigFile';
import { randomUUID } from 'crypto';

export default class UserCache {
  private cacheDir: string;
  private catalogPath: string;
  constructor() {
    // 根据描述
    const cacheDir = getUserStorePath();
    const catalog = path.join(cacheDir, 'catalog.json');
    fs.ensureFileSync(catalog);
    this.cacheDir = cacheDir;
    this.catalogPath = catalog;
  }
  getCatalog(): Catalog[] {
    return fs.readJSONSync(this.catalogPath, { throws: false }) || [];
  }
  getCatalogFilePath(): string {
    return this.catalogPath;
  }
  updateCatalog(catalog: Catalog[]) {
    fs.writeJSONSync(this.catalogPath, catalog);
  }
  add(description: string, content: string) {
    // 根据描述和内容添加到缓存中,将描述添加到'catalog.json'文件中，content在this.cacheDir目录中创建一个以id命名的markdown文件，内容为content
    const id = randomUUID();
    const filePath = path.join(this.cacheDir, `${id}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');
    const catalog = this.getCatalog();
    catalog.push({ id, description });
    this.updateCatalog(catalog);
  }
  getContentById(id: string) {
    // 根据id获取内容，找到对应的description和markdown文件，读取内容并返回
    const catalog = this.getCatalog();
    const item = catalog.find((item) => item.id === id);
    if (item) {
      const filePath = path.join(this.cacheDir, `${id}.md`);
      if (fs.existsSync(filePath)) {
        return { description: item.description, content: fs.readFileSync(filePath, 'utf-8') };
      }
    }
    return { description: '', content: '' };
  }
  list() {
    return this.getCatalog();
  }
  getByIndex(index: number) {
    const catalog = this.getCatalog();
    if (index < 0 || index >= catalog.length) {
      return null;
    }
    return catalog[index];
  }
  del(id: string) {
    const catalog = this.getCatalog();
    const idx = catalog.findIndex((item) => item.id === id);
    if (idx === -1) {
      return false;
    }
    catalog.splice(idx, 1);
    this.updateCatalog(catalog);
    const filePath = path.join(this.cacheDir, `${id}.md`);
    if (fs.existsSync(filePath)) {
      fs.removeSync(filePath);
    }
    return true;
  }
  delByIndex(index: number) {
    const catalog = this.getCatalog();
    if (index < 0 || index >= catalog.length) {
      return false;
    }
    const item = catalog[index];
    return this.del(item.id);
  }
  update(id: string, content: string) {
    const catalog = this.getCatalog();
    const item = catalog.find((item) => item.id === id);
    if (!item) {
      return false;
    }
    const filePath = path.join(this.cacheDir, `${id}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }
}
