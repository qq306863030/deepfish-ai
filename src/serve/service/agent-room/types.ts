// ─── agent-room 共享类型定义 ────────────────────────

import type { WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import type { AgentRoomClient } from './agent-client';
import type { AgentRoomWebClient } from './web-client';
import type { Session } from '../../../@types/ConfigFile';
import type AIAgent from '../../../agent/AIAgent';

// ─── 基础类型 ────────────────────────────────────────

export type ClientType = 'agent' | 'web';

// ─── Agent 实例池 ────────────────────────────────────

export interface AgentInstance {
  agent: AIAgent;
  cwd: string;
  lastActive: number;
}

// ─── 服务端消息 ──────────────────────────────────────

/** 客户端发送的注册消息。连接后必须先发送此消息才能正式入会。 */
export interface RegisterMessage {
  type: 'register';
  clientType: ClientType;
  /** 客户端唯一标识。agent 必填；web 可选（缺省时自动生成）。 */
  id?: string;
}

/** 通用消息载荷（服务端收发版本：不含 from/fromType）。 */
export interface RoomMessage {
  type: string;
  /** 目标客户端 id；不传则视为广播给同房间内对端类型的所有客户端。 */
  to?: string;
  /** 业务负载。 */
  payload?: unknown;
}

/** 服务端发回的系统消息（精确判别联合）。 */
export type ServerMessage =
  | { type: 'registered'; clientType: ClientType; id: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'peer-online'; clientType: ClientType; id: string }
  | { type: 'peer-offline'; clientType: ClientType; id: string }
  | { type: 'sessions-push'; payload: Session[] }
  | { type: 'delete-session-result'; payload: { id: string; ok: boolean } }
  // ─── Agent 执行相关 ─────────────────────────────
  | { type: 'stream'; payload: string }
  | { type: 'log'; payload: { level: string; message: string } }
  | { type: 'execute-done' }
  | { type: 'execute-error'; payload: string }
  | { type: 'ask-question'; payload: { questionId: string; question: string; type: string; choices: string[] } }
  | ({ from: string; fromType: ClientType } & RoomMessage);

// ─── 服务端内部 ──────────────────────────────────────

export interface ClientRecord {
  id: string;
  clientType: ClientType;
  socket: WebSocket;
}

// ─── 服务端配置 ──────────────────────────────────────

export interface StartOptions {
  /** 已存在的 http server，若提供则附着其上（共享端口）；否则独立监听 PORT。 */
  httpServer?: HttpServer;
  /** 独立监听端口，默认 8866。仅在未提供 httpServer 时生效。 */
  port?: number;
  /** WebSocket 路径，默认 "/agent-room"。 */
  path?: string;
}

// ─── 客户端消息 ──────────────────────────────────────

/**
 * 客户端接收到的消息（宽接口）。
 * 客户端无法在类型层面区分所有 ServerMessage 变体，因此使用此松散接口。
 */
export interface ClientMessage {
  type: string;
  to?: string;
  payload?: unknown;
  from?: string;
  fromType?: ClientType;
  clientType?: ClientType;
  id?: string;
  code?: string;
  message?: string;
}

// ─── 客户端配置 ──────────────────────────────────────

export interface AgentClientOptions {
  /** WebSocket 服务地址，如 ws://localhost:8866/agent-room；缺省时自动从配置读取 */
  url?: string;
  /** agent 唯一 id（必填，全局唯一） */
  id: string;
  /** 注册成功回调 */
  onReady?: (client: AgentRoomClient) => void;
  /** 收到对端消息回调 */
  onMessage?: (client: AgentRoomClient, msg: ClientMessage) => void;
  /** 收到错误回调 */
  onError?: (client: AgentRoomClient, code: string, message: string) => void;
  /** 连接关闭回调 */
  onClose?: (client: AgentRoomClient, code: number, reason: string) => void;
  /** 重连间隔 ms，默认 3000；0 表示不自动重连 */
  reconnectInterval?: number;
}

export interface WebClientOptions {
  /** WebSocket 服务地址，如 ws://localhost:8866/agent-room；缺省时使用默认值 */
  url?: string;
  /** 可选自定义 id，缺省时服务端自动生成 */
  id?: string;
  /** 注册成功回调 */
  onReady?: (client: AgentRoomWebClient) => void;
  /** 收到对端消息回调 */
  onMessage?: (client: AgentRoomWebClient, msg: ClientMessage) => void;
  /** 收到错误回调 */
  onError?: (client: AgentRoomWebClient, code: string, message: string) => void;
  /** 连接关闭回调 */
  onClose?: (client: AgentRoomWebClient, code: number, reason: string) => void;
  /** 重连间隔 ms，默认 3000；0 表示不自动重连 */
  reconnectInterval?: number;
  /** 服务端推送 sessions 列表时回调（agent 上线/离线、web 注册成功时触发） */
  onSessionsPush?: (client: AgentRoomWebClient, sessions: Session[]) => void;
}
