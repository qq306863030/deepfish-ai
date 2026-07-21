import { BaseMessage, createAgent, DynamicStructuredTool, HumanMessage, ReactAgent, summarizationMiddleware, todoListMiddleware } from 'langchain';
import { createPatchToolCallsMiddleware } from 'deepagents';
import { FileSystemSaver } from './utils/langgraph-checkpoint-filesystem';
import { getModel } from '../models';
import { z } from 'zod';
import type { AgentMessage, AgentOpt } from '../../@types/AgentOpt';
import { EventEmitterSuper } from 'eventemitter-super';
import { AgentEvent } from '../../@types/AgentEvent';
import { streamOutput, logError, log, logInfo, logSuccess } from '@/utils/print';
import { createAgentEventMiddleware } from './middleware/eventEmitMiddleware';
import Thinking from './utils/Thinking';
import TimeRecord from './utils/TimeRecord';
import { getSystemPrompt } from './system-prompt';
import { getTools } from '../tools';
import { getSkills } from '../skills';
import type { AgentRoomClient } from '@/serve/service/agent-room/agent-client';
import TaskQueue from '@/cli/cli-utils/TaskQueue';
import os from 'os';
import SubAIAgent from './SubAgents/SubAIAgent';

export default class AIAgent extends EventEmitterSuper {
  id: string = '';
  threadId: string = 'main_session_records';
  opt: AgentOpt = {} as AgentOpt;

  tools: DynamicStructuredTool[] = [];
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
  isUseMemory: boolean = true
  isVision: boolean = false

  constructor(opt: AgentOpt) {
    super();
    this.opt = structuredClone(opt);
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
    this.isUseMemory = opt.isUseMemory ?? true
    this.isVision = opt.isVision ?? false
  }

  async init() {
    this.tools = await getTools(this.excludeTools, this.excludeMCP, this.opt.externalTools);
    this.skills = [...getSkills(), ...(this.opt.externalSkills || [])];
    const excludeInnerTools:string[] = []
    if (!this.isUseMemory) {
      excludeInnerTools.push('read_user_semantic_memory', 'update_user_semantic_memory')
    }
    if (!this.isVision) {
      excludeInnerTools.push('subAgent_image')
    }
    if (excludeInnerTools.length) {
      this.tools = this.tools.filter(tool => {
        return !(excludeInnerTools.includes(tool.name))
      })
    }
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
          keep: { messages: 50 }
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
        isUseMemory: this.isUseMemory
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
      if (mode === 'messages') {
        const message = data?.[0] as unknown as AgentMessage | undefined;
        // const content = message?.content;
        const reasoning_content = message?.additional_kwargs?.reasoning_content;
        const toolcall_content = message?.tool_call_chunks?.[0]?.args;
        this.emit(AgentEvent.STREAM_CONTENT_OUTPUT, this.id, reasoning_content || toolcall_content || '');
      }
    }
    const newTask = this.taskQueue.getTask();
    if (newTask) {
      log(`[Task Queue] New task found, executing: ${newTask.taskStr}`, '#7fded1');
      await this.execute(newTask.taskStr);
    }
  }

  initEvents() {
    const thinking = new Thinking();
    const timeRecord = new TimeRecord();
    this.on(AgentEvent.TASK_BEFORE, () => {
      timeRecord.start()
    });
    this.on(AgentEvent.TASK_AFTER, (_msg) => {
      if (!this.isPrintThinking) {
        thinking.stop();
      }
      logSuccess(_msg);
      logInfo(timeRecord.end())
    });
    this.on(AgentEvent.MODEL_BEFORE, () => {});
    this.on(AgentEvent.MODEL_AFTER, () => {
      if (!this.isPrintThinking) {
        thinking.stop();
      }
      streamOutput('\n');
    });
    this.on(AgentEvent.MODEL_ERROR, (error) => {
      if (!this.isPrintThinking) {
        thinking.stop();
      }
      logError(error?.message + '\n' + error?.stack);
    });
    this.on(AgentEvent.STREAM_CONTENT_OUTPUT, (agentId, content) => {
      if (!content || agentId !== this.id) {
        if (!this.isPrintThinking) {
          thinking.start();
        }
        return
      }
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
    this.on(AgentEvent.USE_TOOL_BEFORE, (_toolId, funcName, _funcArgs) => {
      log(`\n[Tool Call] ${funcName}`, '#c2a654');
    });
    this.on(AgentEvent.USE_TOOL_RETURN, (_toolId, _funcName, _toolContent = '') => {
      logInfo(`\n[Tool Return] ${_funcName} returned: ${_toolContent.length > 200 ? _toolContent.slice(0, 200) + '...' : _toolContent}`);
    });
    this.on(AgentEvent.USE_TOOL_ERROR, (_toolId, _funcName, _error) => {
      logError(`Error in tool ${_funcName}: ${_error instanceof Error ? _error.message : String(_error)}`);
    });
    this.on(AgentEvent.USE_TOOL_AFTER, (_toolId, _funcName, _funcArgs) => {});
  }

  async createSubAgent(systemPrompt?: string): Promise<SubAIAgent> {
    const subAgent = new SubAIAgent(this.opt, this);
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
