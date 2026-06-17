import { Command } from 'commander';

export function helpInformation(): string {
  return `Usage: ai [options] [command]

Commands:
  ai "xxx"

  # Configuration commands
  ai config edit
  ai config view
  ai config reset
  ai config dir

  # Model commands
  ai models add
  ai models ls
  ai models use <name>
  ai models del <name>

  # Skill commands
  ai skills ls
  ai skills add <name>
  ai skills del <index>
  ai skills enable <name|index>
  ai skills disable <name|index>
  ai skills dir
  ai skills generate xxx

  # Tools commands
  ai tools dir
  ai tools generate xxx

  # Session commands
  ai session clear
  ai session dir
  
  # Task commands
  ai task ls
  ai task add <task>
  ai task del <index>
  ai task clear
  
  # MCP commands
  ai mcp edit
  
  # Serve commands
  ai serve
  ai serve start
  ai serve stop
  ai serve restart
  
  # Cache commands
  ai cache ls
  ai cache edit <index|id>
  ai cache del <index|id>
`;
}

export function registerHelpCommand(program: Command) {
  program.helpInformation = helpInformation;
  program
    .command('help')
    .description('Displaying help information')
    .action(() => {
      console.log(helpInformation());
    });
}

export default helpInformation;
