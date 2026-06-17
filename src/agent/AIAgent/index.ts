import { BaseMessage, DynamicStructuredTool, HumanMessage } from 'langchain';
import { createDeepAgent, FilesystemBackend, type DeepAgent } from 'deepagents';
import { FileSystemSaver } from './utils/langgraph-checkpoint-filesystem';
import { getModel } from '../models';
import { z } from 'zod';
import type { AgentOpt } from '../../@types/AgentOpt';
import { EventEmitterSuper } from 'eventemitter-super';
import { AgentEvent } from '../../@types/AgentEvent';
import { streamOutput, logError, log } from '@/utils/print';
import { createAgentEventMiddleware } from './middleware/eventEmitMiddleware';
import Thinking from './utils/Thinking';
import { systemPrompt } from './system-prompt';
import { getTools } from '../tools';
import { getSkills } from '../skills';
import type { AgentRoomClient } from '@/serve/service/agent-room/agent-client';
import TaskQueue from '@/cli/cli-utils/TaskQueue';
import os from 'os';

export default class AIAgent extends EventEmitterSuper {
  id: string = '';
  opt: AgentOpt = {} as AgentOpt;

  tools: DynamicStructuredTool[] = [];
  dynamicTools: string[] = [];
  skills: string[] = [];
  mcp: string[] = [];
  subLevel: number = 0;
  agent: DeepAgent = {} as DeepAgent;
  messages: BaseMessage[] = [];

  basespace: string = '';
  workspace: string = '';
  memoryFilePath: string = '';
  sessionDirPath: string = '';
  userStorePath: string = '';
  roomClient: AgentRoomClient | null = null;
  taskQueue: TaskQueue = {} as TaskQueue;

  constructor(opt: AgentOpt) {
    super();
    this.id = opt.id || `agent-${Date.now()}`;
    this.basespace = opt.basespace;
    this.workspace = opt.workspace;
    this.memoryFilePath = opt.memoryFilePath;
    this.sessionDirPath = opt.sessionDirPath;
    this.opt = opt;
  }

  async init() {
    this.tools = await getTools();
    this.skills = [...getSkills(), ...(this.opt.skills || [])];
    const model = getModel(this.opt.modelOpt);
    const checkpointer = new FileSystemSaver({
      rootFolder: this.sessionDirPath,
    });
    const contextSchema = z.object({
      agent_name: z.string(),
      encoding: z.string(),
    });
    const agent = createDeepAgent({
      model: model,
      checkpointer,
      backend: new FilesystemBackend({
        rootDir: this.workspace,
        virtualMode: false,
      }),
      tools: this.tools,
      skills: this.skills,
      contextSchema,
      middleware: [
        createAgentEventMiddleware(this),
      ],
      memory: [this.memoryFilePath],
      systemPrompt: systemPrompt(this.workspace, os.platform()),
    });
    this.agent = agent as unknown as DeepAgent;
    this.taskQueue = new TaskQueue(this);
    this.initEvents();
  }

  async execute(input: string) {
    const humanMessage = new HumanMessage(input);
    this.messages.push(humanMessage);
    const stream = await this.agent.stream(
      { messages: this.messages },
      {
        streamMode: ['messages'],
        subgraphs: true,
        configurable: { thread_id: this.id },
        context: { agent_name: 'deepfish', encoding: this.opt.encoding },
      },
    );

    for await (const [_namespace, mode, data] of stream) {
      if (mode === 'messages') {
        this.emit(AgentEvent.STREAM_CONTENT_OUTPUT, data[0].content);
      }
    }
  }

  initEvents() {
    const thinking = new Thinking();
    this.on(AgentEvent.TASK_BEFORE, () => {
      thinking.init();
    });
    this.on(AgentEvent.TASK_AFTER, (msg) => {
      thinking.stop();
      const newTask = this.taskQueue.getTask();
      if (newTask) {
        log(`[任务队列] 发现新任务，即将执行: ${newTask.taskStr}`, '#7fded1');
        this.execute(newTask.taskStr);
      }
    });
    this.on(AgentEvent.MODEL_BEFORE, () => {});
    this.on(AgentEvent.MODEL_AFTER, () => {
      streamOutput('\n');
    });
    this.on(AgentEvent.MODEL_ERROR, (error) => {
      logError(error?.message + '\n' + error?.stack);
    });
    this.on(AgentEvent.STREAM_CONTENT_OUTPUT, (content) => {
      thinking.setStop(content);
      if (!thinking.isThinking) {
        if (typeof content === 'string') {
          streamOutput(content, '#f2c97d');
        }
      }
    });
    this.on(AgentEvent.COMPRESS_MESSAGES_BEFORE, (_currentLength) => {});
    this.on(AgentEvent.COMPRESS_MESSAGES_AFTER, (_currentLength) => {});
    this.on(AgentEvent.NEW_MESSAGE, (_msg) => {});
    this.on(AgentEvent.USE_TOOL_BEFORE, (_toolId, funcName, _funcArgs) => {
      thinking.stop();
      log(`[调用工具] ${funcName}`, '#c2a654');
    });
    this.on(AgentEvent.USE_TOOL_RETURN, (_toolId, funcName, toolContent) => {});
    this.on(AgentEvent.USE_TOOL_ERROR, (_toolId, funcName, error) => {});
    this.on(AgentEvent.USE_TOOL_AFTER, (_toolId, funcName, _funcArgs) => {});
  }

  destory() {
    this.removeAllListeners();
  }
}
