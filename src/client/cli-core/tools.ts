import inquirer from 'inquirer';
import { logError, logSuccess, logErrorMsg, logInfo, logWarning } from '@/client/cli-utils/print';
import { openDirectory } from '@/client/cli-utils/normal';
import { getHomePath, getToolsPath, getWorkspacePath } from '../cli-utils/getGlobalPath';
import { getConfig } from '../cli-utils/init-config';
import { initAgent, testServer } from '../cli-utils/init-agent';
import { getUserToolList } from '../../server/agent/tools/utils';
import fs from 'fs-extra';
import path from 'path';

export function handleToolsLs() {
  const toolNames = getUserToolList().map(tool => {
    return tool.name
  });
  logInfo('='.repeat(50));
  if (toolNames.length === 0) {
    logInfo('No tools registered yet');
  } else {
    toolNames.forEach((name, index) => {
      logInfo(`[${index}] ${name}`);
    });
  }
  logInfo('='.repeat(50));
}

export function handleToolsDel(index: string) {
  const toolList = getUserToolList();
  const toolIndex = parseInt(index, 10);
  if (isNaN(toolIndex) || toolIndex < 0 || toolIndex >= toolList.length) {
    logError('Invalid tool index');
    return;
  }
  const tool = toolList[toolIndex];
  if (tool.dir) {
    fs.removeSync(tool.dir);
    logSuccess(`Tool directory deleted: ${tool.dir}`);
  } else {
    fs.removeSync(tool.path);
    logSuccess(`Tool file deleted: ${tool.path}`);
  }
}

export function handleToolsDir() {
  const toolsPath = getToolsPath();
  openDirectory(toolsPath);
  logSuccess('Tools directory opened');
}

export async function handleToolsAdd(name: string) {
  logInfo(`Adding tool: ${name}`);
  const workspace = getWorkspacePath();
  const toolDir = path.join(workspace, name);
  if (!fs.existsSync(toolDir)) {
    logError(`Tool directory does not exist: ${toolDir}`);
    return;
  }

  const { scope } = await inquirer.prompt([
    {
      type: 'select',
      name: 'scope',
      message: 'Select tool scope:',
      choices: [
        { name: 'Local (current workspace only)', value: 'local' },
        { name: 'Global (available to all workspaces)', value: 'global' },
      ],
    },
  ]);

  const homePath = getHomePath();
  const globalToolDir = path.join(homePath, 'tools');
  const localToolDir = path.join(workspace, '.deepfish-ai', 'tools');
  const targetDir = scope === 'local' ? localToolDir : globalToolDir;
  const targetPath = path.join(targetDir, name);

  const { action } = await inquirer.prompt([
    {
      type: 'select',
      name: 'action',
      message: 'Select add action:',
      choices: [
        { name: 'Move (cut)', value: 'move' },
        { name: 'Copy', value: 'copy' },
      ],
    },
  ]);

  fs.ensureDirSync(targetDir);

  if (fs.existsSync(targetPath)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `A tool named "${name}" already exists at the target location. Overwrite?`,
        default: false,
      },
    ]);
    if (!overwrite) {
      logWarning('Add cancelled');
      return;
    }
    fs.removeSync(targetPath);
  }

  if (action === 'move') {
    fs.moveSync(toolDir, targetPath, { overwrite: true });
  } else {
    fs.copySync(toolDir, targetPath, { overwrite: true });
  }
  logSuccess(`Tool ${scope === 'local' ? 'locally' : 'globally'} ${action === 'move' ? 'moved' : 'copied'}: ${targetPath}`);
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
    const generateSkillPath = path.join(__dirname, './skills/generate-tool.md');
    const agent = await initAgent(config, [generateSkillPath]);

    const prompt = `Please use the "generate-tool" SKILL to generate a tool module according to the following requirements: ${target}

  Requirements:
  1. Create a subdirectory named "deepfish-[feature]" under the current workspace (${getWorkspacePath()})
  2. Generate an index.js file inside that directory
  3. The file must export both "functions" and "descriptions"
  4. Ensure the code can run directly`;

    await agent.execute(prompt);
    process.exit(0);
  } catch (error: any) {
    logErrorMsg(error as Error);
  }
}
