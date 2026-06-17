import type { ModelOpt } from './Model';

export type AgentOpt = {
  id?: string;
  modelOpt: ModelOpt;
  basespace: string;
  workspace: string;
  memoryFilePath: string;
  sessionDirPath: string;
  userStorePath: string;
  maxBlockFileSize: number, // 最大分块文件大小，单位KB；超过该大小的文件需要分块处理
  encoding: string, // 命令行编码格式，可设置为 utf-8、gbk 等，也可以设置成 auto 或空值自动判断
  maxSubAgentCount: number, // "最大子agent并行执行数量", -1 表示无限制
  skills?: string[]; // 预设技能列表，技能ID数组
};
