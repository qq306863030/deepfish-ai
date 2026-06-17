import { logError, logSuccess, logErrorMsg } from '../../utils/print';
import { openDirectory } from '../../utils/normal';
import { getToolsPath, getWorkspacePath } from '../cli-utils/getGlobalPath';
import { getConfig } from '../cli-utils/init-config';
import { initAgent, testServer } from '../cli-utils/init-agent';
import path from 'path';

export function handleToolsDir() {
  const toolsPath = getToolsPath();
  openDirectory(toolsPath);
  logSuccess('Tools directory opened');
}

export async function handleToolsGenerate(target: string) {
  if (!target.trim()) {
    logError('Please provide a tool description, e.g.: ai tools generate "a weather query tool"');
    return;
  }

  const config = getConfig();
  if (!config) {
    logError('Config file not found, please run init first');
    return;
  }

  const currentModelName = config.currentModel;
  if (!currentModelName) {
    logError('No AI model configured, please run ai model use <name>');
    return;
  }

  try {
    const isServerRunning = await testServer();
    if (!isServerRunning) {
      logError('Failed to start service, please check config or port availability');
      return;
    }

    // Create agent and inject generate-tool skill
    const generateSkillPath = path.join(__dirname, './generate-tool.md');
    const agent = await initAgent(config, [generateSkillPath]);

    const prompt = `Please use the "generate-tool" SKILL to generate a tool module according to the following requirements: ${target}

  Requirements:
  1. Create a subdirectory named "deepfish-[feature]" under the current workspace (${getWorkspacePath()})
  2. Generate an index.js file inside that directory
  3. The file must export both "functions" and "descriptions"
  4. Ensure the code can run directly`

    await agent.execute(prompt);
    process.exit(0);
  } catch (error: any) {
    logErrorMsg(error as Error);
  }
}
