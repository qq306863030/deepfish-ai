/**
 * Agent 客户端 — 连接到 agent-room 服务的 agent 端。
 *
 * 用法：
 * ```ts
 * import { AgentRoomClient } from './agent-room/agent-client';
 *
 * const agent = new AgentRoomClient({
 *   url: 'ws://localhost:8866/agent-room',
 *   id: 'agent-001',
 *   onReady: (client) => log('Registered successfully', client.id),
 *   onMessage: (client, msg) => {
 *     if (msg.fromType === 'web') {
 *       client.reply(msg, { ok: true, result: 'done' });
 *     }
 *   },
 * });
 * ```
 */

import WebSocket from 'ws';
import type { ClientMessage, AgentClientOptions } from './types';
import { getServePort } from '@/client/cli-utils/getGlobalData';

// ─── Agent 客户端 ────────────────────────────────────

export class AgentRoomClient {
  url: string;
  id: string;

  private ws: WebSocket | null = null;
  private opts: AgentClientOptions;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnecting = false;

  constructor(opts: AgentClientOptions) {
    this.opts = opts;
    const port = getServePort();
    this.url = opts.url || `ws://localhost:${port}/agent-room`;
    this.id = opts.id;
    this.connect();
  }

  /** 连接到服务端 */
  connect(): void {
    if (this.ws) return;

    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      this.ws!.send(JSON.stringify({ type: 'register', clientType: 'agent', id: this.id }));
    });

    this.ws.on('message', (data) => {
      const msg: ClientMessage = JSON.parse(data.toString());

      if (msg.type === 'error' && msg.code === 'AGENT_ALREADY_CONNECTED') {
        this.opts.onError?.(this, msg.code, msg.message || 'agent 已在线上');
        this.disconnect();
        return;
      }

      if (msg.type === 'registered') {
        this.opts.onReady?.(this);
        return;
      }

      if (msg.type === 'error') {
        this.opts.onError?.(this, msg.code || '', msg.message || '');
        return;
      }

      this.opts.onMessage?.(this, msg);
    });

    this.ws.on('close', (code, reason) => {
      this.opts.onClose?.(this, code, reason.toString());
      this.ws = null;
      this.tryReconnect();
    });

    this.ws.on('error', () => {
      // close 事件随后触发，统一在 close 中处理重连
    });
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
