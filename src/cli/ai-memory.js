const { program } = require('commander')
const MemoryManager = require('./MemoryManager.js')

const memoryManager = new MemoryManager()
const extCommand = program
  .command('memory')
  .description('Memory management commands')

extCommand
  .command('clear')
  .description('Clear the memory messages for the current directory')
  .action(() => {
    memoryManager.clearMessage()
  })

extCommand
  .command('dir')
  .description('Open the memory directory')
  .action(() => {
    memoryManager.openDirectory()
  })

