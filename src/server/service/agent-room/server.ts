import { WebSocketServer, WebSocket } from 'ws';
import { setOutputClient, clearOutputClient, setDisconnectClient, disconnectClient } from '@/server/utils/print';
import { getSessionList, getServePort } from '@/client/cli-utils/getGlobalData';
import { getConfig } from '@/client/cli-utils/init-config';
import { initAgent, removeSessionById } from '@/client/cli-utils/init-agent';
import { sendStreamOutput, sendStreamEnd, sendLog, sendWriteLine } from './sendLog';
import type { ClientType, RegisterMessage, RoomMessage, ServerMessage, ClientRecord, StartOptions, AgentInstance } from './types';

// ─── 内部状态 ────────────────────────────────────────

const agents = new Map<string, ClientRecord>();
const webs = new Map<string, ClientRecord>();

/** Agent 实例池，以 agent id 为 key */
const agentInstanceMap = new Map<string, AgentInstance>();

/** 等待中的交互问答 */
const pendingQuestions = new Map<string, { resolve: (val: string) => void }>();

/** Agent 空闲超时（毫秒） */
const AGENT_IDLE_TIMEOUT = 5 * 60 * 1000;

/** 空闲定时器 */
const idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
    console.log(`[agent-room] ${client.clientType} offline: ${client.id}`);
    // web 客户端离线时清除 print.ts 输出回调
    if (client.clientType === 'web') {
      clearOutputClient();
    }
    // agent 离线后，sessions 列表可能发生变化（status 由 1 变 0），推送给 web 端
    if (client.clientType === 'agent') {
      pushSessionsToWeb();
    }
  }
}

// ─── Agent 实例池管理 ────────────────────────────────

/**
 * 获取或创建 Agent 实例。以 agent id 为 key，首次请求时懒创建。
 */
async function getOrCreateAgent(agentId: string, cwd: string, skills?: string[]) {
  // 取消空闲销毁定时器
  const timer = idleTimers.get(agentId);
  if (timer) {
    clearTimeout(timer);
    idleTimers.delete(agentId);
  }

  const existing = agentInstanceMap.get(agentId);
  if (existing) {
    existing.lastActive = Date.now();
    return existing.agent;
  }

  const config = getConfig();
  if (!config) throw new Error('Config not found');

  console.log(`[agent-room] Creating agent instance: ${agentId}, cwd: ${cwd}`);
  const agent = await initAgent(config, skills, cwd, agentId);

  // 连接 agent-room，使 agent 可通过 WebSocket 向 web 客户端发送交互提问
  const { connectAgentRoom } = await import('@/client/cli-utils/init-agent');
  try {
    await connectAgentRoom(agent);
  } catch (err: unknown) {
    console.error(`[agent-room] Failed to connect agent ${agentId} to room: ${err instanceof Error ? err.message : String(err)}`);
  }

  const instance: AgentInstance = { agent, cwd, lastActive: Date.now() };
  agentInstanceMap.set(agentId, instance);
  console.log(`[agent-room] Agent instance created: ${agentId}`);
  return agent;
}

/**
 * 销毁 Agent 实例，释放 MCP 连接、内存等资源。
 */
function destroyAgent(agentId: string) {
  const instance = agentInstanceMap.get(agentId);
  if (!instance) return;

  try {
    instance.agent.destory?.();
  } catch {
    // ignore cleanup errors
  }

  // 断开 agent-room 连接
  try {
    instance.agent.roomClient?.disconnect();
  } catch {
    // ignore cleanup errors
  }
  instance.agent.roomClient = null;

  agentInstanceMap.delete(agentId);
  console.log(`[agent-room] Agent instance destroyed: ${agentId}`);
}

/**
 * 重置空闲定时器，超时后自动销毁 Agent 实例。
 */
function resetIdleTimer(agentId: string) {
  const timer = idleTimers.get(agentId);
  if (timer) clearTimeout(timer);

  idleTimers.set(
    agentId,
    setTimeout(() => {
      destroyAgent(agentId);
      idleTimers.delete(agentId);
    }, AGENT_IDLE_TIMEOUT),
  );
}

// ─── 执行 / 交互路由 ─────────────────────────────────

/**
 * 处理 web 端发来的 execute 请求：查找或创建 Agent，执行任务，流式转发输出。
 */
async function handleExecute(from: ClientRecord, msg: RoomMessage) {
  const { input, cwd, skills } = (msg.payload || {}) as { input: string; cwd?: string; skills?: string[] };
  if (!input) {
    send(from.socket, { type: 'error', code: 'MISSING_INPUT', message: 'execute 必须提供 input' });
    return;
  }

  let agent: any;
  try {
    console.log(`[agent-room] Getting/creating agent for ${from.id}...`);
    agent = await getOrCreateAgent(from.id, cwd || process.cwd(), skills);
    console.log(`[agent-room] Agent ready, executing input (${input.length} chars)...`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[agent-room] Failed to create agent: ${message}`);
    send(from.socket, { type: 'execute-error', payload: `Agent 创建失败: ${message}` });
    return;
  }

  try {
    console.log(`[agent-room] Calling agent.execute()...`);
    // 服务端超时保护：6 分钟（比 agent 的 5 分钟多 1 分钟作为缓冲）
    const SERVER_TIMEOUT_MS = 6 * 60 * 1000;
    await Promise.race([
      agent.execute(input).then(() => console.log(`[agent-room] agent.execute() completed`)),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Server execute timeout')), SERVER_TIMEOUT_MS);
      }),
    ]);
    send(from.socket, { type: 'execute-done' });
    // agent 执行完毕后主动断开 WebSocket 连接
    disconnectClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[agent-room] Execute error for ${from.id}: ${message}`);
    send(from.socket, { type: 'execute-error', payload: message });
  } finally {
    resetIdleTimer(from.id);
  }
}

/**
 * 处理 web 端发来的 question-answer：resolve 挂起的 Promise。
 */
function resolvePendingQuestion(msg: RoomMessage) {
  const { questionId, answer } = (msg.payload || {}) as { questionId: string; answer: string };
  const pending = pendingQuestions.get(questionId);
  if (pending) {
    pending.resolve(answer);
    pendingQuestions.delete(questionId);
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

  // web 客户端注册时设置 print.ts 输出回调，让 log()/writeLine()/streamOutput() 同时推送到客户端
  if (clientType === 'web') {
    setOutputClient(
      (message, color) => sendLog(socket, message, color),
      (message, color) => sendWriteLine(socket, message, color),
      (content, color) => sendStreamOutput(socket, content, color),
    );
    setDisconnectClient(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1000, 'agent execution completed');
      }
    });
  }

  send(socket, { type: 'registered', clientType, id });
  console.log(`[agent-room] ${clientType} online: ${id}`);
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

  // web 端发起的 execute 指令：交给 resident agent 执行
  if (from.clientType === 'web' && msg.type === 'execute') {
    handleExecute(from, msg);
    return;
  }

  // web 端回复交互问题
  if (from.clientType === 'web' && msg.type === 'question-answer') {
    resolvePendingQuestion(msg);
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
    console.log(`[agent-room] web ${from.id}  deleted session: ${id}`);
    send(from.socket, { type: 'delete-session-result', payload: { id, ok: true } });
    // 重新推送：删除后 sessions 列表会缩短
    pushSessionsToWeb();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[agent-room] Failed to delete session: ${message}`);
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

  // WebSocket 保活：每 25s 发送 ping，防止空闲连接被操作系统/代理断开
  const pingInterval = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.ping();
    }
  }, 25_000);

  let alive = true;
  socket.on('pong', () => { alive = true; });

  // 检测 pong 响应，30s 无响应则断开
  const aliveCheck = setInterval(() => {
    if (!alive) {
      socket.terminate();
      return;
    }
    alive = false;
    if (socket.readyState === WebSocket.OPEN) {
      socket.ping();
    }
  }, 30_000);

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
    clearInterval(pingInterval);
    clearInterval(aliveCheck);
    if (registered) removeClient(registered);
  });

  socket.on('error', (err) => {
    console.error(`[agent-room] socket error: ${err.message}`);
  });
}

// ─── 公共 API ────────────────────────────────────────

export { type StartOptions } from './types';

export function startAgentRoomServer(opts: StartOptions = {}) {
  if (wss) {
    console.warn('[agent-room] Service already running');
    return wss;
  }

  const path = opts.path ?? '/agent-room';
  if (opts.httpServer) {
    wss = new WebSocketServer({ server: opts.httpServer, path });
    console.log(`[agent-room] started, path=${path}`);
  } else {
    const port = opts.port ?? PORT;
    wss = new WebSocketServer({ port, path });
    console.log(`[agent-room] started: ws://localhost:${port}${path}`);
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
  console.log('[agent-room] Service stopped');
}

/** 调试 / 状态查询 */
export function getAgentRoomStats() {
  return {
    agents: Array.from(agents.keys()),
    webs: Array.from(webs.keys()),
    agentInstances: Array.from(agentInstanceMap.keys()),
  };
}

/**
 * 通过 agent-room 向指定 web 客户端发送交互问题，等待用户回答。
 * 供 question tool 在远程模式下调用。
 */
export async function askUserViaWebSocket(
  webClientId: string,
  question: string,
  type: string,
  choices: string[],
  error?: string,
): Promise<string> {
  const webClient = webs.get(webClientId);
  if (!webClient) throw new Error('Web client disconnected');

  const questionId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  send(webClient.socket, {
    type: 'ask-question',
    payload: { questionId, question, type, choices, error },
  });

  return new Promise((resolve) => {
    pendingQuestions.set(questionId, { resolve });
  });
}

/** 获取当前所有在线 web 客户端 id 列表 */
export function getOnlineWebClientIds(): string[] {
  return Array.from(webs.keys());
}
