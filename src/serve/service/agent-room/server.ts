import { WebSocketServer, WebSocket } from 'ws';
import { logInfo, logSuccess, logWarning, logError } from '../../../utils/print';
import { getSessionList, getServePort } from '@/cli/cli-utils/getGlobalData';
import { removeSessionById } from '@/cli/cli-utils/init-agent';
import type { ClientType, RegisterMessage, RoomMessage, ServerMessage, ClientRecord, StartOptions } from './types';

// ─── 内部状态 ────────────────────────────────────────

const agents = new Map<string, ClientRecord>();
const webs = new Map<string, ClientRecord>();

let wss: WebSocketServer | null = null;

const PORT = getServePort();

// ─── 工具函数 ────────────────────────────────────────

function send(socket: WebSocket, msg: ServerMessage) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

function getPool(clientType: ClientType) {
  return clientType === 'agent' ? agents : webs;
}

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function broadcastPeer(clientType: ClientType, status: 'peer-online' | 'peer-offline', id: string) {
  // 通知对端类型的所有客户端：某个 agent / web 上线或下线
  const targetPool = clientType === 'agent' ? webs : agents;
  for (const peer of targetPool.values()) {
    if (status === 'peer-online') {
      send(peer.socket, { type: 'peer-online', clientType, id });
    } else {
      send(peer.socket, { type: 'peer-offline', clientType, id });
    }
  }
}

function removeClient(client: ClientRecord) {
  const pool = getPool(client.clientType);
  if (pool.get(client.id)?.socket === client.socket) {
    pool.delete(client.id);
    broadcastPeer(client.clientType, 'peer-offline', client.id);
    logInfo(`[agent-room] ${client.clientType}  offline: ${client.id}`);
    // agent 离线后，sessions 列表可能发生变化（status 由 1 变 0），推送给 web 端
    if (client.clientType === 'agent') {
      pushSessionsToWeb();
    }
  }
}

// ─── sessions 推送 ──────────────────────────────────

/**
 * 读取最新 session 列表，根据当前在线 agent 池补齐 status 后推送给所有 web 客户端。
 */
function pushSessionsToWeb() {
  const sessions = getSessionList();
  for (const s of sessions) {
    s.status = agents.has(s.id) ? 1 : 0;
  }
  for (const web of webs.values()) {
    send(web.socket, { type: 'sessions-push', payload: sessions });
  }
}

// ─── 注册逻辑 ────────────────────────────────────────

/**
 * 处理注册消息。注册成功返回 ClientRecord，否则返回 null（已通过 socket 反馈错误）。
 */
function registerClient(socket: WebSocket, raw: RegisterMessage): ClientRecord | null {
  const { clientType } = raw;
  if (clientType !== 'agent' && clientType !== 'web') {
    send(socket, { type: 'error', code: 'INVALID_CLIENT_TYPE', message: 'clientType 必须为 "agent" 或 "web"' });
    socket.close(4000, 'invalid clientType');
    return null;
  }

  // agent 必须提供 id；web 缺省时自动生成
  let id = raw.id?.trim();
  if (clientType === 'agent') {
    if (!id) {
      send(socket, { type: 'error', code: 'MISSING_ID', message: 'agent 必须提供 id' });
      socket.close(4001, 'missing id');
      return null;
    }
    // 同 id 已连接 → 拒绝新连接
    if (agents.has(id)) {
      send(socket, { type: 'error', code: 'AGENT_ALREADY_CONNECTED', message: `agent "${id}" 已经在线` });
      socket.close(4002, 'agent already connected');
      return null;
    }
  } else {
    if (!id) id = genId('web');
    // web 端允许同 id 多连接？这里采用：同 id 已存在则覆盖踢掉旧连接
    const existing = webs.get(id);
    if (existing) {
      send(existing.socket, { type: 'error', code: 'KICKED', message: '同 id 新连接已建立，旧连接被踢下线' });
      existing.socket.close(4003, 'kicked by new connection');
    }
  }

  const record: ClientRecord = { id, clientType, socket };
  getPool(clientType).set(id, record);

  send(socket, { type: 'registered', clientType, id });
  logSuccess(`[agent-room] ${clientType}  online: ${id}`);
  broadcastPeer(clientType, 'peer-online', id);

  // agent 上线 → sessions 状态可能由 0 变 1；web 上线 → 首次同步
  if (clientType === 'agent' || clientType === 'web') {
    pushSessionsToWeb();
  }

  return record;
}

// ─── 消息路由 ────────────────────────────────────────

function routeMessage(from: ClientRecord, msg: RoomMessage) {
  // web 端发起的会话管理指令由 server 端直接处理（不转发给 agent）
  if (from.clientType === 'web' && msg.type === 'delete-session') {
    handleDeleteSession(from, msg);
    return;
  }

  // 默认路由策略：agent ↔ web 互发；同类型之间不直接转发。
  const targetPool = from.clientType === 'agent' ? webs : agents;

  const envelope: ServerMessage = {
    ...msg,
    from: from.id,
    fromType: from.clientType,
  };

  if (msg.to) {
    const target = targetPool.get(msg.to);
    if (!target) {
      send(from.socket, {
        type: 'error',
        code: 'TARGET_NOT_FOUND',
        message: `目标 ${msg.to} 不存在或未连接`,
      });
      return;
    }
    send(target.socket, envelope);
  } else {
    // 广播给对端类型所有客户端
    for (const target of targetPool.values()) {
      send(target.socket, envelope);
    }
  }
}

/**
 * web 端发起的删除 session 指令：调用 init-agent.removeSessionById 删除磁盘与 sessions.json 记录，
 * 删除成功后再推一次 sessions 列表给所有 web 端，让 UI 自动刷新。
 */
function handleDeleteSession(from: ClientRecord, msg: RoomMessage) {
  const payload = (msg.payload ?? {}) as { id?: string };
  const id = payload.id;
  if (!id) {
    send(from.socket, { type: 'error', code: 'MISSING_ID', message: 'delete-session 必须提供 id' });
    return;
  }
  try {
    removeSessionById(id);
    logInfo(`[agent-room] web ${from.id}  deleted session: ${id}`);
    send(from.socket, { type: 'delete-session-result', payload: { id, ok: true } });
    // 重新推送：删除后 sessions 列表会缩短
    pushSessionsToWeb();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError(`[agent-room] Failed to delete session: ${message}`);
    send(from.socket, { type: 'error', code: 'DELETE_FAILED', message });
  }
}

// ─── 连接处理 ────────────────────────────────────────

function handleConnection(socket: WebSocket) {
  let registered: ClientRecord | null = null;

  // 注册超时：10s 内未注册则断开
  const registerTimer = setTimeout(() => {
    if (!registered) {
      send(socket, { type: 'error', code: 'REGISTER_TIMEOUT', message: '注册超时' });
      socket.close(4004, 'register timeout');
    }
  }, 10_000);

  socket.on('message', (data) => {
    let parsed: RegisterMessage | RoomMessage;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      send(socket, { type: 'error', code: 'INVALID_JSON', message: '消息必须为合法 JSON' });
      return;
    }

    if (!registered) {
      if ((parsed as RegisterMessage).type !== 'register') {
        send(socket, { type: 'error', code: 'NOT_REGISTERED', message: '请先发送 register 消息' });
        return;
      }
      registered = registerClient(socket, parsed as RegisterMessage);
      if (registered) clearTimeout(registerTimer);
      return;
    }

    routeMessage(registered, parsed as RoomMessage);
  });

  socket.on('close', () => {
    clearTimeout(registerTimer);
    if (registered) removeClient(registered);
  });

  socket.on('error', (err) => {
    logError(`[agent-room] socket error: ${err.message}`);
  });
}

// ─── 公共 API ────────────────────────────────────────

export { type StartOptions } from './types';

export function startAgentRoomServer(opts: StartOptions = {}) {
  if (wss) {
    logWarning('[agent-room] Service already running');
    return wss;
  }

  const path = opts.path ?? '/agent-room';

  if (opts.httpServer) {
    wss = new WebSocketServer({ server: opts.httpServer, path });
    logSuccess(`[agent-room] started, path=${path}`);
  } else {
    const port = opts.port ?? PORT;
    wss = new WebSocketServer({ port, path });
    logSuccess(`[agent-room] started: ws://localhost:${port}${path}`);
  }

  wss.on('connection', handleConnection);
  return wss;
}

export function stopAgentRoomServer() {
  if (!wss) return;

  for (const pool of [agents, webs]) {
    for (const c of pool.values()) {
      c.socket.close(1001, 'server shutting down');
    }
    pool.clear();
  }

  wss.close();
  wss = null;
  logInfo('[agent-room] Service stopped');
}

/** 调试 / 状态查询 */
export function getAgentRoomStats() {
  return {
    agents: Array.from(agents.keys()),
    webs: Array.from(webs.keys()),
  };
}
