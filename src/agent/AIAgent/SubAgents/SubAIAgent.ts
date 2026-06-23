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
import { createPatchToolCallsMiddleware } from 'deepagents';
import { FileSystemSaver } from '../utils/langgraph-checkpoint-filesystem';
import { getModel } from '../../models';
import { z } from 'zod';
import type { AgentMessage, AgentOpt } from '../../../@types/AgentOpt';
import { EventEmitterSuper } from 'eventemitter-super';
import { AgentEvent } from '../../../@types/AgentEvent';
import { streamOutput, logError, log, logInfo } from '@/utils/print';
import { createAgentEventMiddleware } from '../middleware/eventEmitMiddleware';
import Thinking from '../utils/Thinking';
import { subSystemPrompt, getSystemPrompt } from '../system-prompt';
import { getTools } from '../../tools';
import { getSkills } from '../../skills';
import os from 'os';
import { randomUUID } from 'crypto';
import { cloneDeep } from 'lodash';

// 通用子agent
export default class SubAIAgent extends EventEmitterSuper {
  id: string = '';
  opt: AgentOpt = {} as AgentOpt;

  tools: DynamicStructuredTool[] = [];
  dynamicTools: string[] = [];
  skills: string[] = [];
  mcp: string[] = [];
  subLevel: number = 1;
  agent: ReactAgent<any> = {} as ReactAgent<any>;
  messages: BaseMessage[] = [];

  basespace: string = '';
  workspace: string = '';
  memoryFilePath: string = '';
  sessionDirPath: string = '';
  userStorePath: string = '';
  agentRulesPath: string = '';
  isPrintThinking: boolean = true;
  maxSubAgentCount: number = 2;

  excludeTools: string[] = [];
  excludeSkills: string[] = []
  excludeMCP: string[] = [];
  systemPrompt: string = '';

  constructor(opt: AgentOpt) {
    super();
    this.opt = cloneDeep(opt);
    this.id = opt.id || `agent-${randomUUID()}`;
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
    this.subLevel = opt.subLevel || 1;
    this.maxSubAgentCount = opt.maxSubAgentCount || 2;
  }

  async init() {
    if (this.subLevel > 2) {
      this.excludeTools.push('subAgent_exec')
    }
    this.tools = await getTools(this.excludeTools, this.excludeMCP);
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
      curAgent: z.object().optional(),
    });
    const systemPrompt = this.subLevel > 2 ? getSystemPrompt({
        systemPrompt: this.systemPrompt,
        workspace: this.workspace,
        osType: os.platform(),
        skills: this.skills,
        memoryFilePath: this.memoryFilePath,
        agentRulesPath: this.agentRulesPath,
        excludeSkills: this.excludeSkills,
      }) : subSystemPrompt(this.workspace, os.platform(), this.skills, this.excludeSkills);
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
      ],
      systemPrompt,
    });
    await checkpointer.init(this.id, agent);
    this.agent = agent;
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

    return new Promise<void>(async (resolve) => {
      this.once(AgentEvent.TASK_AFTER, (msg) => {
        resolve(msg);
      });
      for await (const [_namespace, mode, data] of stream) {
        if (mode === 'messages') {
          const message = (data[0] as unknown as AgentMessage).additional_kwargs.reasoning_content;
          this.emit(AgentEvent.STREAM_CONTENT_OUTPUT, message);
        }
      }
    });
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
    this.on(AgentEvent.USE_TOOL_RETURN, (_toolId, _funcName, _toolContent) => {
      logInfo(`[Tool Return] ${_funcName} returned: ${_toolContent}`);
    });
    this.on(AgentEvent.USE_TOOL_ERROR, (_toolId, _funcName, _error) => {
      logError(`Error in tool ${_funcName}: ${_error instanceof Error ? _error.message : String(_error)}`);
    });
    this.on(AgentEvent.USE_TOOL_AFTER, (_toolId, _funcName, _funcArgs) => {});
  }

  async createSubAgent(): Promise<SubAIAgent> {
    const subAgent = new SubAIAgent(this.opt);
    subAgent.subLevel = this.subLevel + 1;
    await subAgent.init();
    return subAgent;
  }

  destory() {
    this.removeAllListeners();
  }
}
