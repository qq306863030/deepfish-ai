import { logInfo } from '@/client/cli-utils/print';

export function handleDynamicToolsLs() {
  logInfo('Listing all dynamic tools');
}

export function handleDynamicToolsEnable(nameOrIndex: string) {
  logInfo(`Enabling dynamic tool: ${nameOrIndex}`);
}

export function handleDynamicToolsDisable(nameOrIndex: string) {
  logInfo(`Disabling dynamic tool: ${nameOrIndex}`);
}

export function handleDynamicToolsDir() {
  logInfo('Opening dynamic tools directory');
}

export function handleDynamicToolsGenerate(target: string) {
  logInfo(`Generating dynamic tool: ${target}`);
}
