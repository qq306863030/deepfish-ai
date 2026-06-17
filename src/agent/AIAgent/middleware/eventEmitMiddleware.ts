import { createMiddleware, ToolMessage } from 'langchain';
import { AgentEvent } from '@/@types/AgentEvent';

type EventEmitter = {
  emit(event: AgentEvent, ...args: any[]): void;
};

/**
 * Creates a LangChain middleware that intercepts agent lifecycle hooks
 * and emits corresponding AgentEvent events.
 */
export function createAgentEventMiddleware(emitter: EventEmitter) {
  return createMiddleware({
    name: 'AgentEventMiddleware',
    // Before agent starts (once per invocation)
    beforeAgent: (_state) => {
      emitter.emit(AgentEvent.TASK_BEFORE);
      return; // must return undefined / no modification
    },

    // After agent completes (once per invocation)
    afterAgent: (_state) => {
      const lastMessage = _state.messages?.[_state.messages.length - 1].content;
      emitter.emit(AgentEvent.TASK_AFTER, lastMessage);
      return;
    },

    // Before each model call
    beforeModel: (_state) => {
      emitter.emit(AgentEvent.MODEL_BEFORE);
      return;
    },

    // After each model response
    afterModel: (_state) => {
      emitter.emit(AgentEvent.MODEL_AFTER);
      return;
    },

    wrapModelCall: async (request, handler) => {
      // Modify request before calling
      try {
        // Call the model
        return await handler(request);
      } catch (error) {
        emitter.emit(AgentEvent.MODEL_ERROR, error);
        throw error;
      }
    },

    // Around each tool call
    wrapToolCall: async (request, handler) => {
      const { toolCall } = request;
      emitter.emit(AgentEvent.USE_TOOL_BEFORE, toolCall.id, toolCall.name, toolCall.args);
      try {
        const result = await handler(request);
        emitter.emit(AgentEvent.USE_TOOL_RETURN, toolCall.id, toolCall.name, (result as ToolMessage)?.content);
        emitter.emit(AgentEvent.USE_TOOL_AFTER, toolCall.id, toolCall.name, toolCall.args);
        return result;
      } catch (err: any) {
        emitter.emit(AgentEvent.USE_TOOL_ERROR, toolCall.id, toolCall.name, err);
        emitter.emit(AgentEvent.USE_TOOL_AFTER, toolCall.id, toolCall.name, toolCall.args);
        throw err;
      }
    },
  });
}
