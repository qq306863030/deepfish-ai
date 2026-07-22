import express from 'express';
import type { Server } from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import chalk from 'chalk';
import { logWarning, logSuccess, logInfo } from '../../utils/print';
import { getCodePath } from '@/cli/cli-utils/getGlobalPath';
import { getServePort } from '@/cli/cli-utils/getGlobalData';
import { addScheduledTask, removeScheduledTaskById, updateScheduledTaskById, clearScheduledTasks, readScheduledTasks, loadScheduledTasks } from '@/utils/execScheduledTask';

// 定期根据配置清除过期文件

// ─── 配置常量 ───────────────────────────────────────

const PORT = getServePort();
const distDir = path.resolve(getCodePath(), 'dist/serve');
const clientDir = path.join(distDir, 'client');
const serverEntryPath = path.join(distDir, 'server/entry-server');
const clientHtmlPath = path.join(clientDir, 'index.html');

// ─── 服务状态 ───────────────────────────────────────

let server: Server | null = null;
let cachedHtml: string | null = null;

function resetState() {
  server = null;
  cachedHtml = null;
}

// ─── SSR 渲染引擎 ──────────────────────────────────

function loadClientHtml(): string {
  if (cachedHtml) return cachedHtml;
  cachedHtml = fs.readFileSync(clientHtmlPath, 'utf-8');
  return cachedHtml;
}

type SsrRender = () => { html: string };

import { pathToFileURL } from 'url';
import AIAgent from '@/agent/AIAgent';

async function loadSsrRender(): Promise<SsrRender> {
  // Windows absolute paths must be file:// URLs for ESM import()
  const mod = await import(pathToFileURL(serverEntryPath).href);
  return mod.render as SsrRender;
}

async function renderPage(): Promise<string> {
  const render = await loadSsrRender();
  const { html: ssrHtml } = render();
  const template = loadClientHtml();
  return template.replace('<div id="app"></div>', `<div id="app">${ssrHtml}</div>`);
}

// ─── Express 应用 ──────────────────────────────────

function createApp() {
  const app = express();

  // 解析 JSON 请求体
  app.use(express.json());

  // 仅托管 JS/CSS 等资产文件，index.html 由 SSR 控制
  app.use(express.static(clientDir, { index: false }));
  // 健康检查
  app.get('/ping', (_req, res) => res.send('pong'));

  // 添加定时任务
  app.post('/api/scheduled-task', (req, res) => {
    const { cron, workspace, prompt } = req.body ?? {};

    if (!cron || !workspace || !prompt) {
      res.status(400).json({ ok: false, error: '参数不完整，需要提供 cron、workspace、prompt' });
      return;
    }

    const error = addScheduledTask(cron, workspace, prompt);
    if (error) {
      res.status(400).json({ ok: false, error });
      return;
    }

    logInfo(`[scheduled-task] 添加定时任务: ${(prompt as string).slice(0, 40)}...`);
    res.json({ ok: true });
  });

  // 删除定时任务（按 id）
  app.delete('/api/scheduled-task/:id', (req, res) => {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ ok: false, error: '缺少 id 参数' });
      return;
    }

    const removed = removeScheduledTaskById(id);
    if (!removed) {
      res.status(404).json({ ok: false, error: `定时任务 ${id} 不存在` });
      return;
    }

    logInfo(`[scheduled-task] 删除定时任务: ${id}`);
    res.json({ ok: true });
  });

  // 列出所有定时任务
  app.get('/api/scheduled-task', (_req, res) => {
    res.json({ ok: true, data: readScheduledTasks() });
  });

  // 清空所有定时任务
  app.delete('/api/scheduled-task', (_req, res) => {
    clearScheduledTasks();
    logInfo('[scheduled-task] 已清空所有定时任务');
    res.json({ ok: true });
  });

  // 修改定时任务
  app.put('/api/scheduled-task/:id', (req, res) => {
    const { id } = req.params;
    const { cron, workspace, prompt } = req.body ?? {};

    if (!id) {
      res.status(400).json({ ok: false, error: '缺少 id 参数' });
      return;
    }

    const error = updateScheduledTaskById(id, { cron, workspace, prompt });
    if (error) {
      const status = error === '定时任务不存在' ? 404 : 400;
      res.status(status).json({ ok: false, error });
      return;
    }

    logInfo(`[scheduled-task] 修改定时任务: ${id}`);
    res.json({ ok: true });
  });

  // 所有页面请求走 SSR 渲染
  app.get('/{*path}', async (_req, res) => {
    try {
      const html = await renderPage();
      res.send(html);
    } catch (err) {
      console.error(chalk.red('[SSR] Render failed:'), err);
      res.send(loadClientHtml());
    }
  });

  return app;
}

// ─── 公开 API ──────────────────────────────────────

export interface StartServerOptions {
  /** HTTP server 启动后的回调，参数为底层 http.Server 实例，可用于附着 WebSocket 等。 */
  onReady?: (httpServer: Server) => void;
}

async function initFakeAgent() {
  new AIAgent({} as any)
}

export async function startServer(options: StartServerOptions = {}) {
  if (server) {
    logWarning(`Server already running at http://localhost:${PORT} running`);
    return;
  }

  const app = createApp();
  const startTime = Date.now();
  server = app.listen(PORT, () => {
    const ms = Date.now() - startTime;

    // 读取 package.json 获取 name/version（容错）
    let pkgName = 'app';
    let pkgVersion = '';
    try {
      const pkgPath = path.join(getCodePath(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { name?: string; version?: string };
      pkgName = pkg.name ?? pkgName;
      pkgVersion = pkg.version ?? '';
    } catch (err) {
      // ignore
    }

    logSuccess(`${pkgName} ${pkgVersion ? `v${pkgVersion} ` : ''}ready in ${ms} ms`);

    // locally与网络地址
    const addr = (server as Server).address();
    let port = PORT;
    if (addr && typeof addr === 'object' && 'port' in addr) {
      // @ts-ignore
      port = (addr as any).port;
    }

    logInfo(`  → Local: http://localhost:${port}`);

    // 列出可用 IPv4 网络地址
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      const addrs = nets[name] ?? [];
      for (const a of addrs) {
        if (a.family === 'IPv4' && !a.internal) {
          logInfo(`  → Network: http://${a.address}:${port}`);
        }
      }
    }
    logInfo('');
    loadScheduledTasks();
    options.onReady?.(server as Server);
    initFakeAgent() // 初始化一个Agent，为了加速下次启动
  });
}

export function stopServer() {
  if (!server) return;
  server.close();
  resetState();
  logInfo('Server stopped');
}
