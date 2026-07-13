import { BaseMessage, createAgent, DynamicStructuredTool, HumanMessage, ReactAgent, summarizationMiddleware, todoListMiddleware } from 'langchain';
import { createPatchToolCallsMiddleware } from 'deepagents';
import { FileSystemSaver } from './utils/langgraph-checkpoint-filesystem';
import { getModel } from '../models';
import { z } from 'zod';
import type { AgentMessage, AgentOpt } from '../../../@types/AgentOpt';
import { EventEmitterSuper } from 'eventemitter-super';
import { AgentEvent } from '../../../@types/AgentEvent';
import { log, logError, logInfo, logSuccess, streamOutput, disconnectClient } from '@/server/utils/print';
import { createAgentEventMiddleware } from './middleware/eventEmitMiddleware';
import { getSystemPrompt } from './system-prompt';
import { getTools } from '../tools';
import { getSkills } from '../skills';
import type { AgentRoomClient } from '@/server/service/agent-room/agent-client';
import TaskQueue from '@/client/cli-utils/TaskQueue';
import os from 'os';
import SubAIAgent from './SubAgents/SubAIAgent';
import { cloneDeep } from 'lodash';
import Thinking from '@/server/utils/Thinking';

export default class AIAgent extends EventEmitterSuper {
  id: string = '';
  threadId: string = 'main_session_records';
  opt: AgentOpt = {} as AgentOpt;

  tools: DynamicStructuredTool[] = [];
  dynamicTools: string[] = [];
  skills: string[] = [];
  mcp: string[] = [];
  subLevel: number = 0;
  maxSubAgentCount: number = 2;
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

  excludeTools: string[] = [];
  excludeSkills: string[] = [];
  excludeMCP: string[] = [];
  systemPrompt: string = '';
  rootAgent: AIAgent | null = null;

  /** 获取根 Agent 的 id，用于区分客户端 */
  get rootAgentId(): string {
    return this.rootAgent?.id || this.id;
  }

  constructor(opt: AgentOpt) {
    super();
    this.opt = cloneDeep(opt);
    this.id = opt.id || `agent-${Date.now()}`;
    this.basespace = opt.basespace;
    this.workspace = opt.workspace;
    this.memoryFilePath = opt.memoryFilePath; // todo
    this.sessionDirPath = opt.sessionDirPath;
    this.userStorePath = opt.userStorePath;
    this.agentRulesPath = opt.agentRulesPath;
    this.isPrintThinking = opt.isPrintThinking;
    this.excludeTools = opt.excludeTools || [];
    this.excludeSkills = opt.excludeSkills || [];
    this.excludeMCP = opt.excludeMCP || [];
    this.systemPrompt = opt.systemPrompt || '';
    this.subLevel = 0;
    this.maxSubAgentCount = opt.maxSubAgentCount || 2;
  }

  async init() {
    this.tools = await getTools(this.excludeTools, this.excludeMCP, this.opt.externalTools);
    this.skills = [...getSkills(), ...(this.opt.externalSkills || [])];
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
      curAgent: z.object({}).optional(),
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
        todoListMiddleware(),
        createPatchToolCallsMiddleware(),
      ],
      systemPrompt: getSystemPrompt({
        systemPrompt: this.systemPrompt,
        workspace: this.workspace,
        osType: os.platform(),
        skills: this.skills,
        memoryFilePath: this.memoryFilePath,
        agentRulesPath: this.agentRulesPath,
        excludeSkills: this.excludeSkills,
      }),
    });
    await checkpointer.init(this.threadId, agent);
    this.agent = agent;
    this.taskQueue = new TaskQueue(this.id);
    this.initEvents();
  }

  async execute(input: string) {
    const humanMessage = new HumanMessage(input);
    this.messages.push(humanMessage);

    /** 执行超时保护：5 分钟无响应则终止 */
    const EXECUTE_TIMEOUT_MS = 5 * 60 * 1000;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const executeTask = async () => {
      const stream = await this.agent.stream(
        { messages: this.messages },
        {
          streamMode: ['messages'],
          recursionLimit: 2000,
          subgraphs: true,
          configurable: { thread_id: this.threadId },
          context: {
            agent_name: 'deepfish',
            encoding: this.opt.encoding,
            skills: this.skills,
            memoryFilePath: this.memoryFilePath,
            agentId: this.id,
            curAgent: this,
          },
        },
      );
      for await (const [_namespace, mode, data] of stream) {
        // 每收到一个事件就重置超时
        if (timeoutHandle) clearTimeout(timeoutHandle);
        timeoutHandle = setTimeout(() => {}, EXECUTE_TIMEOUT_MS);

        if (mode === 'messages') {
          const message = data?.[0] as unknown as AgentMessage | undefined;
          const content = message?.content;
          const reasoning_content = message?.additional_kwargs?.reasoning_content;
          const toolcall_content = message?.tool_call_chunks?.[0]?.args;
          this.emit(AgentEvent.STREAM_CONTENT_OUTPUT, content || reasoning_content || toolcall_content || '');
        }
      }
    };

    try {
      await Promise.race([
        executeTask(),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(`Agent execute timeout (${EXECUTE_TIMEOUT_MS / 1000}s)`));
          }, EXECUTE_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    const newTask = this.taskQueue.getTask();
    if (newTask) {
      log(`[Task Queue] New task found, executing: ${newTask.taskStr}`, '#7fded1');
      await this.execute(newTask.taskStr);
    }

    // 服务端主动断开socket
    disconnectClient();
  }

  initEvents() {
    const thinking = new Thinking();
    this.on(AgentEvent.TASK_BEFORE, () => {});
    this.on(AgentEvent.TASK_AFTER, (_msg) => {
      logSuccess(_msg);
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
      log(`[Tool Call] ${funcName}`, '#c2a654');
    });
    this.on(AgentEvent.USE_TOOL_RETURN, (_toolId, _funcName, _toolContent = '') => {
      logInfo(`[Tool Return] ${_funcName} returned: ${_toolContent}`);
    });
    this.on(AgentEvent.USE_TOOL_ERROR, (_toolId, _funcName, _error) => {
      logError(`Error in tool ${_funcName}: ${_error instanceof Error ? _error.message : String(_error)}`);
    });
    this.on(AgentEvent.USE_TOOL_AFTER, (_toolId, _funcName, _funcArgs) => {});
  }

  async createSubAgent(systemPrompt?: string): Promise<SubAIAgent> {
    const subAgent = new SubAIAgent(this.opt, this);
    subAgent.rootAgent = this
    systemPrompt && (subAgent.systemPrompt = systemPrompt);
    await subAgent.init();
    return subAgent;
  }

  async subExecute(systemPrompt: string, prompt: string) {
    const subAgent = await this.createSubAgent(systemPrompt);
    const result = await subAgent.execute(prompt);
    return result;
  }

  destory() {
    this.removeAllListeners();
  }
}
