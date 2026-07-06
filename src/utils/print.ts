import chalk from 'chalk';

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
  if (color === 'blue') {
    process.stdout.write('\r' + chalk.hex('#6dd2ea')(msg1) + ' ' + msg2);
  } else if (color === 'green') {
    process.stdout.write('\r' + chalk.hex('#9bed7f')(msg1) + ' ' + msg2);
  } else if (color === 'red') {
    process.stdout.write('\r' + chalk.hex('#ed7f7f')(msg1) + ' ' + msg2);
  } else {
    process.stdout.write('\r' + chalk.hex(color)(msg1) + ' ' + msg2);
  }
}

function streamOutput(text: string, color = '#9bed7f') {
  process.stdout.write(chalk.hex(color)(text));
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

function log(msg: string, color?: string) {
  if (!color) {
    console.log(chalk.hex('#6dd2ea')(msg));
  } else {
    console.log(chalk.hex(color)(msg));
  }
}

export { logInfo, logSuccess, logError, logWarning, logDisabled, writeLine, streamOutput, streamLineBreak, loading, log, logErrorMsg };
