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
import { taskTool } from './task';
import { webFetchTool } from './webfetch';
import { writeFileTool } from './write';

const builtinTools = [
  taskTool,
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
];

async function getTools() {
  return [...builtinTools, ...(await scanUserTools()), ...(await scanUserMcp())];
}

export { getTools };
