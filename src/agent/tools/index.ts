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
import { subAgentTool } from './subAgent';
import { taskTool } from './task';
import { webFetchTool } from './webfetch';
import { writeFileTool } from './write';
import { fishInfoTools } from './getFishInfo';

const builtinTools = [
  taskTool,
  subAgentTool,
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
];

async function getTools(excludeTools: string[], excludeMCP: string[]) {
  return [...builtinTools, ...(await scanUserTools(excludeTools)), ...(await scanUserMcp(excludeMCP))];
}

export { getTools };
