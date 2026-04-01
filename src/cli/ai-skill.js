/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-23 15:07:51
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-25 16:03:48
 * @FilePath: \deepfish\src\cli\ai-skill.js
 * @Description: AI skill management CLI
 * @
 */
import { program } from 'commander'
import SkillConfigManager from './SkillConfigManager.js'
const skillConfigManager = new SkillConfigManager()
// ai skill command
const skillCommand = program
  .command('skill')
  .description('Skill management commands')

skillCommand
  .command('ls')
  .description('List all skills in the configuration')
  .action(() => {
    skillConfigManager.viewList()
  })

skillCommand
  .command('add <name>')
  .description('Add a local skill directory or zip file')
  .action(async (name) => {
    await skillConfigManager.add(name)
  })

skillCommand
  .command('del <name>')
  .description('Remove a skill by name or index')
  .action((name) => {
    skillConfigManager.remove(name)
  })

skillCommand
  .command('dir')
  .description('Open the history directory')
  .action(() => {
    skillConfigManager.openDirectory()
  })

skillCommand
  .command('install <url>')
  .description('Install a skill from ClawHub')
  .action(async (url) => {
    await skillConfigManager.install(url)
  })

skillCommand
  .command('enable <name>')
  .description('Enable a skill by name or index')
  .action((name) => {
    skillConfigManager.enable(name)
  })

skillCommand
  .command('disable <name>')
  .description('Disable a skill by name or index')
  .action((name) => {
    skillConfigManager.disable(name)
  })
