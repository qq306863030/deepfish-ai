import type { Command } from 'commander';
import { handleInput, multiInput } from './cli-core/input';

export function registerInputCommand(program: Command) {
  // Use a default command with optional variadic argument
  program
    .argument('[inputs...]', 'Natural language instruction or enter interactive mode')
    .action(async (inputs: string[]) => {
      if (!inputs || inputs.length === 0) {
        await multiInput();
      } else {
        const combinedInput = [inputs.join(' ')];
        await handleInput(combinedInput);
      }
    });
}
