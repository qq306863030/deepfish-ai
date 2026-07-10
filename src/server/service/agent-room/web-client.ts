/**
 * Web 客户端 — 连接到 agent-room 服务的 web 端（浏览器端）。
 *
 * 浏览器用法（CDN 或 bundle）：
 * ```js
 * const web = new AgentRoomWebClient({
 *   url: 'ws://localhost:8866/agent-room',
 *   onReady: (client) => client.send('task', { cmd: 'scan' }, 'agent-001'),
 *   onMessage: (client, msg) => console.log('agent reply:', msg),
 * });
 * ```
 *
 * Node 端导入：
 * ```ts
 * import { AgentRoomWebClient } from './agent-room/web-client';
 * ```
 */

import type { ClientMessage, WebClientOptions } from './types';

// ─── Web 客户端 ──────────────────────────────────────

export class AgentRoomWebClient {
  url: string;
  id: string | null = null;

  private ws: WebSocket | null = null;
  private opts: WebClientOptions;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnecting = false;

  constructor(opts: WebClientOptions) {
    this.opts = opts;
    this.url = opts.url || `ws://localhost:8866/agent-room`;
    this.id = opts.id ?? null;
    this.connect();
  }

  /** 连接到服务端 */
  connect(): void {
    if (this.ws) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      const register: Record<string, unknown> = { type: 'register', clientType: 'web' };
      if (this.id) register['id'] = this.id;
      this.ws!.send(JSON.stringify(register));
    };

    this.ws.onmessage = (e) => {
      const msg: ClientMessage = JSON.parse(e.data);

      if (msg.type === 'registered') {
        this.id = msg.id!;
        this.opts.onReady?.(this);
        return;
      }

      if (msg.type === 'sessions-push') {
        const payload = (msg.payload ?? []) as import('../../../@types/ConfigFile').Session[];
        this.opts.onSessionsPush?.(this, payload);
        return;
      }

      if (msg.type === 'error') {
        this.opts.onError?.(this, msg.code || '', msg.message || '');
        return;
      }

      this.opts.onMessage?.(this, msg);
    };

    this.ws.onclose = (e) => {
      this.opts.onClose?.(this, e.code, e.reason);
      this.ws = null;
      this.tryReconnect();
    };

    this.ws.onerror = () => {
      // close 事件随后触发，统一处理
    };
  }

  /** 发送消息 */
  send(type: string, payload?: unknown, to?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, payload, to }));
  }

  /** 回复消息（自动填充 to 为消息来源） */
  reply(msg: ClientMessage, payload?: unknown): void {
    if (!msg.from) return;
    this.send(msg.type + '-result', payload, msg.from);
  }

  /** 断开连接，不重连 */
  disconnect(): void {
    this.clearReconnect();
    this.reconnecting = false;
    if (this.ws) {
      this.ws.close(1000, 'client disconnect');
      this.ws = null;
    }
  }

  /** 是否已连接 */
  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ─── 内部 ───────────────────────────────────────

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private tryReconnect(): void {
    const interval = this.opts.reconnectInterval ?? 3000;
    if (interval <= 0 || this.reconnecting) return;
    this.reconnecting = true;
    this.reconnectTimer = setTimeout(() => {
      this.reconnecting = false;
      this.connect();
    }, interval);
  }
}
