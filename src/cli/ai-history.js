import { program } from 'commander'
import HistoryManager from './HistoryManager.js'

const historyManager = new HistoryManager()
const extCommand = program
  .command('history')
  .description('History management commands')

extCommand
  .command('clear')
  .description('Clear the history messages for the current directory')
  .action(() => {
    historyManager.clearMessage()
  })

extCommand
  .command('dir')
  .description('Open the history directory')
  .action(() => {
    historyManager.openDirectory()
  })

