import { EventEmitterSuper } from 'eventemitter-super';
import type { AgentEvent } from '../@types/AgentEvent';

/**
 * 全局 EventBus — 所有 Agent 实例共享，用于将事件从 Agent 层透传到 Serve 层。
 *
 * 事件约定：
 * - 事件名使用 AgentEvent 枚举值
 * - 第一个参数固定为 agentId（与 WebSocket 注册的 id 一致，用于区分客户端）
 * - 后续参数为事件载荷
 *
 * 用法示例：
 * ```ts
 * globalEventBus.emit(AgentEvent.STREAM_CONTENT_OUTPUT, agentId, content);
 * globalEventBus.on(AgentEvent.STREAM_CONTENT_OUTPUT, (agentId, content) => { ... });
 * ```
 */
export const globalEventBus = new EventEmitterSuper();

/** EventBus 上的事件载荷类型 */
export interface AgentEventPayloads {
  [AgentEvent.STREAM_CONTENT_OUTPUT]: [agentId: string, content: string, color?: string];
  [AgentEvent.MODEL_AFTER]: [agentId: string];
  [AgentEvent.TASK_AFTER]: [agentId: string, msg: string, color?: string];
  [AgentEvent.MODEL_ERROR]: [agentId: string, msg: string, color?: string];
  [AgentEvent.THINKING_START]: [agentId: string];
  [AgentEvent.THINKING_STOP]: [agentId: string];
  [AgentEvent.USE_TOOL_BEFORE]: [agentId: string, msg: string, color?: string];
  [AgentEvent.USE_TOOL_RETURN]: [agentId: string, msg: string];
  [AgentEvent.USE_TOOL_ERROR]: [agentId: string, msg: string];
}
