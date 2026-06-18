import inquirer from 'inquirer';
import fs from 'fs-extra';
import JSON5 from 'json5';
import { ADD_MODEL_Config } from '../cli-utils/SystemConfig';
import { getConfigPath } from '../cli-utils/getGlobalPath';
import { logInfo, logSuccess, logWarning, logError } from '../../utils/print';
import type { AIConfig, ConfigFile } from '@/@types/ConfigFile';

type ModelAnswers = {
  name: string;
  Type: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxContextLength: number;
};

function readConfig() {
  const configPath = getConfigPath();
  if (!fs.pathExistsSync(configPath)) {
    return null;
  }
  const content = fs.readFileSync(configPath, 'utf-8');
  return JSON5.parse(content) as ConfigFile;
}

function writeConfig(data: any) {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON5.stringify(data, null, 2), 'utf-8');
}

export async function handleModelAdd() {
  try {
    const aiCliConfig = ADD_MODEL_Config;
    const typeChoices = Object.keys(aiCliConfig);

    const questions: any[] = [
      {
        type: 'input',
        name: 'name',
        message: 'Enter AI config name:',
        validate: (input: string) => input.trim() !== '' || '名称不能为空',
      },
      {
        type: 'select',
        name: 'Type',
        message: 'Select AI type:',
        choices: typeChoices,
      },
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Enter API URL (press Enter to use default):',
        when: (answers: ModelAnswers) => !!answers.Type,
        default: (answers: ModelAnswers) => aiCliConfig[answers.Type as keyof typeof aiCliConfig]?.baseUrl || '',
      },
      {
        type: 'input',
        name: 'apiKey',
        message: 'Enter API Key:',
        when: (answers: ModelAnswers) => !!answers.Type,
        default: (answers: ModelAnswers) => aiCliConfig[answers.Type as keyof typeof aiCliConfig]?.apiKey || '',
      },
      {
        type: 'input',
        name: 'model',
        message: 'Enter model name:',
        when: (answers: ModelAnswers) => !!answers.Type,
        default: (answers: ModelAnswers) => {
          const type = answers.Type || typeChoices[0];
          return aiCliConfig[type as keyof typeof aiCliConfig]?.model?.defaultValue || '';
        },
      },
      {
        type: 'number',
        name: 'temperature',
        message: 'Enter temperature (press Enter to use default 0.7):',
        default: 0.7,
      },
      {
        type: 'number',
        name: 'maxContextLength',
        message: 'Enter max context length (in Tokens，press Enter to use default):',
        when: (answers: ModelAnswers) => !!answers.Type,
        default: (answers: ModelAnswers) => aiCliConfig[answers.Type as keyof typeof aiCliConfig]?.maxContextLength || 1000000,
      },
    ];

    const answers = (await inquirer.prompt(questions)) as ModelAnswers;

    const selectedType = answers.Type as keyof typeof aiCliConfig;
    const newModel: AIConfig = {
      name: answers.name,
      type: aiCliConfig[selectedType].type,
      baseUrl: answers.baseUrl || aiCliConfig[selectedType].baseUrl,
      model: answers.model,
      apiKey: answers.apiKey || aiCliConfig[selectedType].apiKey,
      temperature: answers.temperature,
      maxContextLength: answers.maxContextLength,
    };

    const config = readConfig();
    if (!config) {
      logError('Config file not found, please run init first');
      return;
    }

    config.aiList = config.aiList || [];
    if (config.aiList.some((item: AIConfig) => item.name === answers.name)) {
      logError(`AI config "${answers.name}" already exists, please use a different name`);
      return;
    }

    config.aiList.push(newModel);
    writeConfig(config);

    logSuccess(`AI config "${answers.name}" added successfully`);
  } catch (e: any) {
    if (e?.name === 'ExitPromptError' || e?.message?.includes('force closed')) {
      logInfo('Cancelled');
      return;
    }
    throw e;
  }
}

export function handleModelLs() {
  const config = readConfig();
  if (!config) {
    logError('Config file not found, please run init first');
    return;
  }

  const aiList = config.aiList || [];
  if (aiList.length === 0) {
    logWarning('No AI configs configured yet');
    return;
  }
  const currentModel = config.currentModel;
  logInfo('='.repeat(50));
  aiList.forEach((item: AIConfig, index: number) => {
    const isCurrent = item.name === currentModel;
    if (isCurrent) {
      logSuccess(`[${index}] ${item.name} (${item.model}) [√]`);
    } else {
      logInfo(`[${index}] ${item.name} (${item.model}) [×]`);
    }
  });
  logInfo('='.repeat(50));
}

export async function handleModelUse(nameOrIndex: string) {
  const config = readConfig();
  if (!config) {
    logError('Config file not found, please run init first');
    return;
  }

  const aiList = config.aiList || [];
  let targetIndex = -1;

  const index = parseInt(nameOrIndex, 10);
  if (!isNaN(index) && index >= 0 && index < aiList.length) {
    targetIndex = index;
  } else {
    targetIndex = aiList.findIndex((item: any) => item.name === nameOrIndex);
  }

  if (targetIndex === -1) {
    logError(`未找到 AI config: ${nameOrIndex}`);
    return;
  }

  config.currentModel = aiList[targetIndex].name;
  writeConfig(config);
  logSuccess(`已切换到 AI config: ${aiList[targetIndex].name}`);
}

export async function handleModelDel(nameOrIndex: string) {
  const config = readConfig();
  if (!config) {
    logError('Config file not found, please run init first');
    return;
  }

  const aiList = config.aiList || [];
  let targetIndex = -1;

  const index = parseInt(nameOrIndex, 10);
  if (!isNaN(index) && index >= 0 && index < aiList.length) {
    targetIndex = index;
  } else {
    targetIndex = aiList.findIndex((item: AIConfig) => item.name === nameOrIndex);
  }

  if (targetIndex === -1) {
    logError(`未找到 AI config: ${nameOrIndex}`);
    return;
  }

  const deletedName = aiList[targetIndex].name;
  aiList.splice(targetIndex, 1);
  config.aiList = aiList;

  if (config.currentModel === deletedName) {
    config.currentModel = '';
  }

  writeConfig(config);
  logSuccess(`已删除 AI config: ${deletedName}`);
}
