import type { Command } from 'commander';
import { handleVersion } from './cli-core/common';


export function registerCommonFlags(program: Command) {
  program.version(handleVersion(), '-v, --version', 'Show version');
}
