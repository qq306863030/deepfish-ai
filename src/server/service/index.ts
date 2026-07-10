import express from 'express';
import type { Server } from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import chalk from 'chalk';
import { logWarning, logSuccess, logInfo } from '@/server/utils/print';
import { getCodePath } from '@/client/cli-utils/getGlobalPath';
import { getServePort } from '@/client/cli-utils/getGlobalData';

// 定期根据配置清除过期文件

// ─── 配置常量 ───────────────────────────────────────

const PORT = getServePort();
const distDir = path.resolve(getCodePath(), 'dist/server');
const clientDir = path.join(distDir, 'web-ui');
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

  // 仅托管 JS/CSS 等资产文件，index.html 由 SSR 控制
  app.use(express.static(clientDir, { index: false }));
  // 健康检查
  app.get('/ping', (_req, res) => res.send('pong'));
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
    options.onReady?.(server as Server);
  });
}

export function stopServer() {
  if (!server) return;
  server.close();
  resetState();
  logInfo('Server stopped');
}
