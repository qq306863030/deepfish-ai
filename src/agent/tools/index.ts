import { executeCommandTool } from './executeCommand';
import { packageTools } from './executeJSCode';
import { learnTools } from './learn-self';
import { scanUserMcp } from './mcp';
import { scanUserTools } from './utils';
import { editFileTool } from './edit';
import { globTool } from './glob';
import { grepTool } from './grep';
import { questionTool } from './question';
import { readFileTool } from './read';
import { semanticMemoryTools } from './semanticMemory';
import { subAgentTool, subAgentImageTool, subAgentBatchTool } from './subAgent';
import { taskTool } from './task';
import { webFetchTool } from './webfetch';
import { writeFileTool } from './write';
import { fishInfoTools } from './getFishInfo';
import { scheduledTaskTools } from './scheduledTaskTool';

const builtinTools = [
  taskTool,
  subAgentTool,
  subAgentImageTool,
  subAgentBatchTool,
  executeCommandTool,
  readFileTool,
  editFileTool,
  writeFileTool,
  globTool,
  grepTool,
  questionTool,
  webFetchTool,
  ...packageTools,
  ...semanticMemoryTools,
  ...learnTools,
  ...fishInfoTools,
  ...scheduledTaskTools,
];

async function getTools(excludeTools: string[], excludeMCP: string[], externalTools: string[] = []) {
  return [...builtinTools, ...(await scanUserTools(excludeTools, externalTools)), ...(await scanUserMcp(excludeMCP))];
}

export { getTools };
