/**
 * 服务端日志发送 — 通过 agent-room WebSocket 将日志推送给对应的 CLI 客户端。
 *
 * 与客户端的 print.ts 对应：
 * - 客户端 print.ts 负责本地终端渲染（chalk 着色、streamOutput 等）
 * - 本模块负责将结构化日志消息发送给客户端，由客户端决定如何渲染
 *
 * 消息格式：
 * ```json
 * { "type": "log", "payload": { "level": "info", "message": "..." } }
 * ```
 */

import type { WebSocket } from 'ws';

export type LogLevel = 'info' | 'success' | 'error' | 'warning' | 'stream' | 'tool-call' | 'tool-return' | 'tool-error';

interface LogPayload {
  level: LogLevel;
  message: string;
  color?: string;
}

function sendLog(ws: WebSocket, level: LogLevel, message: string, color?: string) {
  if (ws.readyState !== ws.OPEN) return;
  // 确保消息末尾有换行符
  const msg = message.endsWith('\n') ? message : message + '\n';
  const payload: LogPayload = { level, message: msg, color };
  ws.send(JSON.stringify({ type: 'log', payload }));
}

export function sendLogInfo(ws: WebSocket, message: string, color?: string) {
  sendLog(ws, 'info', message, color);
}

export function sendLogSuccess(ws: WebSocket, message: string, color?: string) {
  sendLog(ws, 'success', message, color);
}

export function sendLogError(ws: WebSocket, message: string, color?: string) {
  sendLog(ws, 'error', message, color);
}

export function sendLogWarning(ws: WebSocket, message: string) {
  sendLog(ws, 'warning', message);
}

export function sendStreamOutput(ws: WebSocket, content: string, color?: string) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type: 'stream', payload: content, color }));
}

/** 发送流式内容结束标记（换行） */
export function sendStreamEnd(ws: WebSocket) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type: 'stream', payload: '\n', color: undefined }));
}

export function sendToolCall(ws: WebSocket, funcName: string, color?: string) {
  sendLog(ws, 'tool-call', `[Tool Call] ${funcName}`, color);
}

export function sendToolReturn(ws: WebSocket, funcName: string, content: string, color?: string) {
  const truncated = content.length > 200 ? content.slice(0, 200) + '...' : content;
  sendLog(ws, 'tool-return', `[Tool Return] ${funcName} returned: ${truncated}`, color);
}

export function sendToolError(ws: WebSocket, funcName: string, error: string, color?: string) {
  sendLog(ws, 'tool-error', `Error in tool ${funcName}: ${error}`, color);
}
