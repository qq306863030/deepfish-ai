/**
 * 服务端日志发送 — 通过 agent-room WebSocket 将日志推送给对应的 CLI 客户端。
 *
 * 消息格式：
 * - log:    { "type": "log",    "payload": { "message": "...", "color": "..." } }
 * - writeLine: { "type": "writeLine", "payload": { "message": "...", "color": "..." } }
 * - stream: { "type": "stream", "payload": "...", "color": "..." }
 */

import type { WebSocket } from 'ws';

/** 发送普通日志消息（log 级别，带颜色和换行） */
export function sendLog(ws: WebSocket, message: string, color?: string) {
  if (ws.readyState !== ws.OPEN) return;
  const msg = message.endsWith('\n') ? message : message + '\n';
  ws.send(JSON.stringify({ type: 'log', payload: { message: msg, color } }));
}

/** 发送行内消息（writeLine 级别，不带尾部换行） */
export function sendWriteLine(ws: WebSocket, message: string, color?: string) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type: 'writeLine', payload: { message, color } }));
}

/** 发送流式内容 */
export function sendStreamOutput(ws: WebSocket, content: string, color?: string) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type: 'stream', payload: content, color }));
}

/** 发送流式内容结束标记（换行） */
export function sendStreamEnd(ws: WebSocket) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type: 'stream', payload: '\n' }));
}
