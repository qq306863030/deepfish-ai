import chalk from 'chalk';

/**
 * 消息发送回调 — 由 serve 端在 WebSocket 客户端连接时设置，
 * 让 log()/writeLine()/streamOutput() 的输出同时推送到 CLI 客户端。
 */
let _sendToClient: ((message: string, color?: string) => void) | null = null;
let _sendWriteLine: ((message: string, color?: string) => void) | null = null;
let _sendStream: ((content: string, color?: string) => void) | null = null;
let _disconnectClient: (() => void) | null = null;

/** 设置 WebSocket 发送回调（serve 端调用） */
export function setOutputClient(
  onLog: (message: string, color?: string) => void,
  onWriteLine: (message: string, color?: string) => void,
  onStream: (content: string, color?: string) => void,
) {
  _sendToClient = onLog;
  _sendWriteLine = onWriteLine;
  _sendStream = onStream;
}

/** 设置 WebSocket 断开回调（serve 端调用） */
export function setDisconnectClient(onDisconnect: () => void) {
  _disconnectClient = onDisconnect;
}

/** 清除 WebSocket 发送回调（serve 端调用） */
export function clearOutputClient() {
  _sendToClient = null;
  _sendWriteLine = null;
  _sendStream = null;
  _disconnectClient = null;
}

/** 主动断开当前 WebSocket 客户端连接（agent 执行完毕后调用） */
export function disconnectClient() {
  if (_disconnectClient) {
    _disconnectClient();
    _disconnectClient = null;
  }
}

function log(msg: string, color?: string) {
  if (_sendToClient) {
    // 有 web 客户端连接时，只发给客户端，不打印到本地 stdout
    _sendToClient(msg, color);
  } else {
    const hex = color || '#6dd2ea';
    console.log(chalk.hex(hex)(msg));
  }
}

function logInfo(message: string) {
  log(message, '#6dd2ea');
}

function logSuccess(message: string) {
  log(message, '#9bed7f');
}

function logError(message: string) {
  log(message, '#ed7f7f');
}

function logWarning(message: string) {
  log(message, '#f2c94c');
}

function logDisabled(message: string) {
  log(message, '#999999');
}

function logErrorMsg(error: Error) {
  logError(`${error.message}\n${error.stack}`);
}

function writeLine(msg1: string, msg2 = '', color = 'blue') {
  if (_sendWriteLine) {
    _sendWriteLine(`${msg1} ${msg2}`.trim(), color);
  } else {
    const hex = color === 'blue' ? '#6dd2ea' : color === 'green' ? '#9bed7f' : color === 'red' ? '#ed7f7f' : color;
    process.stdout.write('\r' + chalk.hex(hex)(msg1) + ' ' + msg2);
  }
}

function streamOutput(text: string, color = '#9bed7f') {
  if (_sendStream) {
    _sendStream(text, color);
  } else {
    process.stdout.write(chalk.hex(color)(text));
  }
}

function streamLineBreak() {
  process.stdout.write('\n');
}

function loading(label = 'Thinking...') {
  let animationInterval: ReturnType<typeof setInterval>;
  const spinners = ['|', '/', '-', '\\'];
  let spinnerIndex = 0;
  process.stdout.write('\r');
  animationInterval = setInterval(() => {
    writeLine(spinners[spinnerIndex], label);
    spinnerIndex = (spinnerIndex + 1) % spinners.length;
  }, 200);
  return (endLabel: string | undefined, isError = false) => {
    clearInterval(animationInterval);
    if (endLabel) {
      writeLine(endLabel, '', isError ? 'red' : 'green');
    }
    process.stdout.write('\r\n');
  };
}

export { logInfo, logSuccess, logError, logWarning, logDisabled, writeLine, streamOutput, streamLineBreak, loading, log, logErrorMsg };
