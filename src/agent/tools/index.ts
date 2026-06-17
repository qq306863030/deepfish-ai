import { executeCommandTool } from './executeCommand';
import { executeJSCodeTool, packageTools } from './executeJSCode';
import { learnTools } from './learn-self';
import { scanUserMcp } from './mcp';
import { scanUserTools } from './utils';

async function getTools() {
    return [executeCommandTool, executeJSCodeTool, ...packageTools, ...learnTools, ...(await scanUserTools()), ...(await scanUserMcp())];
}

export { getTools };
