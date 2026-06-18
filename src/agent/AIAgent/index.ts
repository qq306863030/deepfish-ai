import {
  BaseMessage,
  createAgent,
  DynamicStructuredTool,
  humanInTheLoopMiddleware,
  HumanMessage,
  ReactAgent,
  summarizationMiddleware,
  todoListMiddleware,
} from 'langchain';
import { createPatchToolCallsMiddleware, createSubAgentMiddleware } from 'deepagents';
import { FileSystemSaver } from './utils/langgraph-checkpoint-filesystem';
import { getModel } from '../models';
import { z } from 'zod';
import type { AgentMessage, AgentOpt } from '../../@types/AgentOpt';
import { EventEmitterSuper } from 'eventemitter-super';
import { AgentEvent } from '../../@types/AgentEvent';
import { streamOutput, logError, log, logSuccess, logInfo } from '@/utils/print';
import { createAgentEventMiddleware } from './middleware/eventEmitMiddleware';
import Thinking from './utils/Thinking';
import { subSystemPrompt, systemPrompt } from './system-prompt';
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
  agent: ReactAgent<any> = {} as ReactAgent<any>;
  messages: BaseMessage[] = [];

  basespace: string = '';
  workspace: string = '';
  memoryFilePath: string = '';
  sessionDirPath: string = '';
  userStorePath: string = '';
  agentRulesPath: string = '';
  roomClient: AgentRoomClient | null = null;
  taskQueue: TaskQueue = {} as TaskQueue;
  isPrintThinking: boolean = true;

  constructor(opt: AgentOpt) {
    super();
    this.id = opt.id || `agent-${Date.now()}`;
    this.basespace = opt.basespace;
    this.workspace = opt.workspace;
    this.memoryFilePath = opt.memoryFilePath; // todo
    this.sessionDirPath = opt.sessionDirPath;
    this.userStorePath = opt.userStorePath;
    this.agentRulesPath = opt.agentRulesPath;
    this.isPrintThinking = opt.isPrintThinking;
    this.opt = opt;
  }

  async init() {
    this.tools = await getTools();
    this.skills = [...getSkills(), ...(this.opt.skills || [])]; // todo
    const model = getModel(this.opt.modelOpt);
    const checkpointer = new FileSystemSaver({
      rootFolder: this.sessionDirPath,
    });
    const contextSchema = z.object({
      agent_name: z.string(),
      encoding: z.string(),
      skills: z.array(z.string()).optional(),
      memoryFilePath: z.string().optional(),
      agentId: z.string().optional(),
    });
    const agent = createAgent({
      model: model,
      checkpointer,
      tools: this.tools,
      contextSchema,
      middleware: [
        createAgentEventMiddleware(this),
        summarizationMiddleware({
          model: model,
          trigger: { tokens: this.opt.modelOpt.maxContextLength || 100000 },
          keep: { messages: 50 },
        }),
        humanInTheLoopMiddleware({
          interruptOn: {
            install_package: {
              allowedDecisions: ['approve', 'reject'],
            },
            readEmailTool: false,
          },
        }),
        todoListMiddleware(),
        createPatchToolCallsMiddleware(),
        createSubAgentMiddleware({
          defaultModel: model,
          subagents: [
            {
              name: 'subagent',
              description: 'This subagent can execute sub tasks.',
              systemPrompt: subSystemPrompt(this.workspace, os.platform(), this.skills),
              tools: this.tools,
              model: model,
              middleware: [],
            },
          ],
        }),
      ],
      systemPrompt: systemPrompt(this.workspace, os.platform(), this.skills, this.memoryFilePath, this.agentRulesPath),
    });
    this.agent = agent;
    this.taskQueue = new TaskQueue(this.id);
    this.initEvents();
  }

  async execute(input: string) {
    const humanMessage = new HumanMessage(input);
    this.messages.push(humanMessage);
    const stream = await this.agent.stream(
      { messages: this.messages },
      {
        streamMode: ['messages'],
        recursionLimit: 2000,
        subgraphs: true,
        configurable: { thread_id: this.id },
        context: { agent_name: 'deepfish', encoding: this.opt.encoding, skills: this.skills, memoryFilePath: this.memoryFilePath, agentId: this.id },
      },
    );

    for await (const [_namespace, mode, data] of stream) {
      if (mode === 'messages') {
        const message = (data[0] as unknown as AgentMessage).additional_kwargs.reasoning_content;
        this.emit(AgentEvent.STREAM_CONTENT_OUTPUT, message);
      }
    }
    const newTask = this.taskQueue.getTask();
    if (newTask) {
      log(`[任务队列] 发现新任务，即将执行: ${newTask.taskStr}`, '#7fded1');
      await this.execute(newTask.taskStr);
    }
  }

  initEvents() {
    const thinking = new Thinking();
    this.on(AgentEvent.TASK_BEFORE, () => {});
    this.on(AgentEvent.TASK_AFTER, (msg) => {
      logInfo(msg);
    });
    this.on(AgentEvent.MODEL_BEFORE, () => {});
    this.on(AgentEvent.MODEL_AFTER, () => {
      if (this.isPrintThinking) {
        thinking.stop();
      }
      streamOutput('\n');
    });
    this.on(AgentEvent.MODEL_ERROR, (error) => {
      if (this.isPrintThinking) {
        thinking.stop();
      }
      logError(error?.message + '\n' + error?.stack);
    });
    this.on(AgentEvent.STREAM_CONTENT_OUTPUT, (content) => {
      if (this.isPrintThinking) {
        if (content && typeof content === 'string') {
          streamOutput(content, '#f2c97d');
        }
      } else {
        if (content && typeof content === 'string') {
          thinking.start();
        } else {
          thinking.stop();
        }
      }
    });
    this.on(AgentEvent.COMPRESS_MESSAGES_BEFORE, (_currentLength) => {});
    this.on(AgentEvent.COMPRESS_MESSAGES_AFTER, (_currentLength) => {});
    this.on(AgentEvent.NEW_MESSAGE, (_msg) => {});
    this.on(AgentEvent.USE_TOOL_BEFORE, (_toolId, funcName, _funcArgs) => {
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
