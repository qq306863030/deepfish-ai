import { program } from 'commander'
import MemeryManager from './MemeryManager.js'

const memeryManager = new MemeryManager()
const extCommand = program
  .command('memery')
  .description('Memory management commands')

extCommand
  .command('clear')
  .description('Clear the memory messages for the current directory')
  .action(() => {
    memeryManager.clearMessage()
  })

extCommand
  .command('dir')
  .description('Open the memory directory')
  .action(() => {
    memeryManager.openDirectory()
  })

