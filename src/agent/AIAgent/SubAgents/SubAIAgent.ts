import { BaseMessage, createAgent, DynamicStructuredTool, HumanMessage, ReactAgent, summarizationMiddleware, todoListMiddleware } from 'langchain';
import { createPatchToolCallsMiddleware } from 'deepagents';
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
import { clone, cloneDeep } from 'lodash';
import { MemorySaver } from '@langchain/langgraph';
import type AIAgent from '../index';

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
  excludeSkills: string[] = [];
  excludeMCP: string[] = [];
  systemPrompt: string = '';

  parentAgent: AIAgent | SubAIAgent = {} as AIAgent | SubAIAgent;

  constructor(opt: AgentOpt, parentAgent: AIAgent | SubAIAgent) {
    super();
    this.opt = cloneDeep(opt);
    this.id = `child-agent-${randomUUID()}`;
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
    this.parentAgent = parentAgent;
  }

  async init() {
    this.tools = clone(this.parentAgent.tools) || await getTools(this.excludeTools, this.excludeMCP, this.opt.externalTools);
    this.skills = clone(this.parentAgent.skills) || [...getSkills(), ...(this.opt.externalSkills || [])];
    if (this.subLevel > 2) {
      this.excludeTools.push('subAgent_exec');
    }
    this.tools = this.tools.filter((tool) => !this.excludeTools.some((excludeTool) => tool.name.startsWith(excludeTool)));

    const model = getModel(this.opt.modelOpt);
    const checkpointer = new MemorySaver();
    const contextSchema = z.object({
      agent_name: z.string(),
      encoding: z.string(),
      skills: z.array(z.string()).optional(),
      memoryFilePath: z.string().optional(),
      agentId: z.string().optional(),
      curAgent: z.object({}).optional(),
    });
    const systemPrompt =
      this.subLevel > 2
        ? getSystemPrompt({
            systemPrompt: this.systemPrompt,
            workspace: this.workspace,
            osType: os.platform(),
            skills: this.skills,
            memoryFilePath: this.memoryFilePath,
            agentRulesPath: this.agentRulesPath,
            excludeSkills: this.excludeSkills,
          })
        : subSystemPrompt({
            systemPrompt: this.systemPrompt,
            workspace: this.workspace,
            osType: os.platform(),
            skills: this.skills,
            excludeSkills: this.excludeSkills,
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
      systemPrompt,
    });
    this.agent = agent;
    this.initEvents();
  }

  async execute(input: string) {
    const humanMessage = new HumanMessage(input);
    this.messages.push(humanMessage);
    return new Promise<void>(async (resolve, reject) => {
      this.once(AgentEvent.TASK_AFTER, (msg) => {
        resolve(msg);
      });
      let stream: any;
      try {
        stream = await this.agent.stream(
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
        // for await (const [_namespace, mode, data] of stream) {
        //   if (mode === 'messages') {
        //     const message = data?.[0] as unknown as AgentMessage | undefined;
        //     const reasoning_content = message?.additional_kwargs?.reasoning_content;
        //     const toolcall_content = message?.tool_call_chunks?.[0]?.args;
        //     this.emit(AgentEvent.STREAM_CONTENT_OUTPUT, this.id, reasoning_content || toolcall_content || '');
        //   }
        // }
      } catch (error) {
        logError(error instanceof Error ? error.message : String(error));
        reject(error);
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
    this.on(AgentEvent.STREAM_CONTENT_OUTPUT, (agentId, content) => {
      if (!content || agentId !== this.id) {
        return;
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
    this.on(AgentEvent.COMPRESS_MESSAGES_BEFORE, (_currentLength) => {});
    this.on(AgentEvent.COMPRESS_MESSAGES_AFTER, (_currentLength) => {});
    this.on(AgentEvent.NEW_MESSAGE, (_msg) => {});
    this.on(AgentEvent.USE_TOOL_BEFORE, (_toolId, funcName, _funcArgs) => {
      log(`[Tool Call] ${funcName}`, '#c2a654');
    });
    this.on(AgentEvent.USE_TOOL_RETURN, (_toolId, _funcName, _toolContent = '') => {
      logInfo(`[Tool Return] ${_funcName} returned: ${_toolContent.length > 200 ? _toolContent.slice(0, 200) + '...' : _toolContent}`);
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
    return subAgent.execute(prompt);
  }

  destory() {
    this.removeAllListeners();
  }
}
