import path from 'path';
import fs from 'fs';
import { logError } from "./print";
import { exec, spawn } from 'child_process';

export function editFile(filePath: string) {
  const platform = process.platform;
  let openCommand;
  if (platform === 'darwin') {
    openCommand = `open -e "${filePath}"`;
  } else if (platform === 'win32') {
    openCommand = `notepad "${filePath}"`;
  } else {
    openCommand = `xdg-open "${filePath}"`;
  }
  exec(openCommand, (error) => {
    if (error) {
      logError('Error opening configuration file:' + error.message);
    }
  });
}

export function openDirectory(dirPath: string) {
  const platform = process.platform;
  let command: string;
  let args: string[];

  if (platform === 'darwin') {
    command = 'open';
    args = [dirPath];
  } else if (platform === 'win32') {
    command = 'explorer.exe';
    args = [dirPath];
  } else {
    command = 'xdg-open';
    args = [dirPath];
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.on('error', (error) => {
    console.error(`Error opening directory "${dirPath}": ${error.message}`);
  });
  child.unref();
}

export function getTrueCwd() {
  return process.cwd();
}