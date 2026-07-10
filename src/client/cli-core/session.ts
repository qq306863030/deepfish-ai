import { clearSession, openSessionDir } from '../cli-utils/init-agent';

export function handleSessionClear() {
  clearSession();
}

export function handleSessionDir() {
  openSessionDir();
}
