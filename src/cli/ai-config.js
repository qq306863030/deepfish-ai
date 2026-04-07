/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-19 11:45:10
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-04-07 15:15:43
 * @FilePath: \deepfish\src\cli\ai-config.js
 * @Description: ai config 相关命令
 * @
 */
import { program } from 'commander'
import { aiCliConfig } from './DefaultConfig.js'
import ConfigManager from './ConfigManager.js'
import aiInquirer from '../AgentRobot/BaseAgentRobot/utils/aiInquirer.js'

const configManager = new ConfigManager()
const configCommand = program
  .command('config')
  .description('Configure AI service settings')

configCommand
  .command('edit')
  .description('Edit configuration file with default editor')
  .action(() => {
    configManager.edit()
  })

configCommand
  .command('dir')
  .description('Open configuration directory')
  .action(() => {
    configManager.dir()
  })

configCommand
  .command('reset')
  .description('Reset configuration file')
  .action(async () => {
    const isReset = await aiInquirer.askConfirm(
      'isReset',
      'Are you sure you want to reset the configuration file?',
      false,
    )
    if (isReset) {
      configManager.resetConfig()
    } else {
      console.log('Operation cancelled')
      process.exit(0)
    }
  })

configCommand
  .command('add')
  .description('Add a new AI configuration')
  .action(async () => {
    console.log('AI Service Configuration')
    console.log('='.repeat(50))
    const questions = [
      {
        type: 'input',
        name: 'name',
        message: 'Enter AI configuration name:',
        validate: (value) => {
          if (value.trim() === '') {
            return 'Configuration name cannot be empty'
          }
          const hasName = configManager.checkName(value.trim())
          if (hasName) {
            setTimeout(() => {
              // 结束会话
              process.exit(0)
            })
            return 'Configuration with this name already exists. Please enter a different name.'
          }
          return true
        },
      },
      {
        type: 'list',
        name: 'Type',
        message: 'Select AI service type:',
        choices: Object.keys(aiCliConfig).map((key) => {
          return { name: key, value: key }
        }),
        default: 'deepseek',
      },
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Enter API base URL:',
        default: (answers) => {
          return aiCliConfig[answers.Type].baseUrl
        },
      },
      {
        type: 'list',
        name: 'model',
        message: 'Select DeepSeek model:',
        when: (answers) => answers.Type === 'DeepSeek',
        choices: aiCliConfig['DeepSeek'].model.list.map((item) => {
          return { name: item, value: item }
        }),
        default: 'deepseek-reasoner',
      },
      {
        type: 'input',
        name: 'model',
        message: 'Enter model name:',
        when: (answers) => answers.Type !== 'DeepSeek',
        default: (answers) => {
          return aiCliConfig[answers.Type].model.defaultValue
        },
      },
      {
        type: 'input',
        name: 'deepseekOtherModel',
        message: 'Enter DeepSeek model name:',
        when: (answers) =>
          answers.Type === 'DeepSeek' && answers.model === 'other',
        default: 'deepseek-reasoner',
      },
      {
        type: 'input',
        name: 'apiKey',
        message: 'Enter API key:',
        default: (answers) => {
          return aiCliConfig[answers.Type].apiKey
        },
      },
      {
        type: 'number',
        name: 'temperature',
        message: 'Enter temperature (0-2):',
        default: (answers) => {
          return aiCliConfig[answers.Type].temperature
        },
        validate: (value) =>
          (value >= 0 && value <= 2) || 'Temperature must be between 0 and 2',
      },
      {
        type: 'number',
        name: 'maxTokens',
        message: 'Enter max tokens (KB):',
        default: (answers) => {
          return aiCliConfig[answers.Type].maxTokens
        },
        validate: (value) => value > 0 || 'Max tokens must be greater than 0',
      },
      {
        type: 'number',
        name: 'maxContextLength',
        message: 'Enter max context length (KB):',
        default: (answers) => {
          return aiCliConfig[answers.Type].maxContextLength
        },
        validate: (value) => value > 0 || 'Max context length must be greater than 0',
      },
      {
        type: 'confirm',
        name: 'stream',
        message: 'Enable streaming output:',
        default: (answers) => {
          return aiCliConfig[answers.Type].stream
        },
      },
    ]
    const answers = await aiInquirer.askAny(questions)
    const aiConfig = {
      name: answers.name,
      type: aiCliConfig[answers.Type].type,
      baseUrl: answers.baseUrl,
      model: answers.model,
      apiKey: answers.apiKey,
      temperature: answers.temperature,
      maxTokens: answers.maxTokens,
      maxContextLength: answers.maxContextLength,
      stream: answers.stream,
    }
    return configManager.addAiConfig(aiConfig)
  })

configCommand
  .command('ls')
  .description('List all AI configurations')
  .action(async () => {
    configManager.getAiList()
  })

configCommand
  .command('use <name>')
  .description('Set the specified AI configuration as current')
  .action((name) => {
    configManager.setCurrentAi(name)
  })

configCommand
  .command('del <name>')
  .description('Delete the specified AI configuration')
  .action((name) => {
    configManager.delAiConfig(name)
  })

configCommand
  .command('view [name]')
  .description('View details of the specified AI configuration')
  .action((name) => {
    configManager.viewAiConfigDetail(name)
  })
