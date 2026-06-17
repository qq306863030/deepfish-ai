import { logInfo } from '../../utils/print';
import { getVersion } from '../cli-utils/getGlobalData';
export function handleHelp() {
  logInfo('Displaying help information');
}

export function handleVersion() {
  return getVersion()
}
