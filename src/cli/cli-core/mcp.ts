import { getMCPFilePath } from '../cli-utils/getGlobalPath';
import { editFile } from '../../utils/normal';

export function handleMcpEdit() {
  const mcpPath = getMCPFilePath();
  editFile(mcpPath);
}
