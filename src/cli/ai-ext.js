/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-19 11:45:10
 * @LastEditors: roman_123 306863030@qq.com
 * @LastEditTime: 2026-03-21 00:18:10
 * @FilePath: \deepfish\src\cli\ai-ext.js
 * @Description: ai ext 相关命令
 * @
 */
import { program } from 'commander'
import ExtConfigManager from './ExtConfigManager.js'
const extConfigManager = new ExtConfigManager()
const extCommand = program
  .command('ext')
  .description('Extension management commands')

extCommand
  .command('add <filename>')
  .description('Add extension tool to the configuration')
  .action((filename) => {
    extConfigManager.add(filename)
  })

extCommand
  .command('del <filename>')
  .description('Remove extension tool from the configuration')
  .action((filename) => {
    extConfigManager.remove(filename)
  })

extCommand
  .command('ls')
  .description('List all extension tools in the configuration')
  .action(() => {
    extConfigManager.viewList()
  })