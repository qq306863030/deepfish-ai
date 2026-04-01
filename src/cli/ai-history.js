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
    historyManager.clearMessage(1)
    historyManager.clearMessage(2)
    historyManager.clearMessage(3)
  })

extCommand
  .command('output')
  .description('Output the history messages to current directory')
  .action(() => {
    historyManager.outputMessage()
  })

extCommand
  .command('dir')
  .description('Open the history directory')
  .action(() => {
    historyManager.openDirectory()
  })

extCommand
  .command('reset')
  .description('Reset all history for all directories')
  .action(() => {
    historyManager.reset()
  })
