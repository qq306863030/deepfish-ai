import type { ModelOpt } from './Model';

export type AgentOpt = {
  id?: string;
  modelOpt: ModelOpt;
  basespace: string;
  workspace?: string;
  memoryFilePath: string;
  sessionDirPath: string;
  userStorePath: string;
  agentRulesPath: string; // 预设规则文件路径，包含 agent 的行为规范和限制条件等
  maxBlockFileSize: number; // 最大分块文件大小，单位KB；超过该大小的文件需要分块处理
  encoding: string; // 命令行编码格式，可设置为 utf-8、gbk 等，也可以设置成 auto 或空值自动判断
  maxSubAgentCount: number; // "最大子agent并行执行数量", -1 表示无限制
  isPrintThinking: boolean; // 是否打印 AI 思考过程中的中间信息，默认为 true
  externalSkills?: string[]; // 预设技能列表，技能ID数组
  externalTools?: string[]; // 外接的工具目录或文件路径
  excludeTools?: string[]; // 排除的工具列表，工具ID数组
  excludeSkills?: string[]; // 排除的技能列表，技能ID数组
  excludeMCP?: string[]; // 排除的多轮对话技能列表，技能ID数组
  systemPrompt?: string; // 系统提示词，覆盖默认系统提示词
  subLevel?: number; // 子智能体层级，默认为 0，表示主智能体；1 表示子智能体；2 表示孙智能体，以此类推
  isUseMemory?: boolean // 是否使用记忆，默认是true
  isVision?: boolean // 是否支持图像识别，默认是false
  isSilence?: boolean // 是否输出大模型返回的内容, 默认是false=输出 true=沉默
};

export type AgentMessage = {
  id: string;
  content: string;
  additional_kwargs: {
    reasoning_content: string;
  };
  response_metadata: {
    model_provider: string;
    usage: {};
  };
  tool_calls: any[];
  tool_call_chunks: any[];
  invalid_tool_calls: any[];
};
