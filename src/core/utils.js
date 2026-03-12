const chalk = require("chalk");
const path = require("path");
const os = require("os");
const fs = require("fs-extra");
const { GlobalVariable } = require("./globalVariable");

// 日志相关工具函数
function logInfo(message) {
  log(message, "#6dd2ea");
}

function logSuccess(message) {
  log(message, "#9bed7f");
}

function logError(message) {
  log(message, "#ed7f7f");
}

function writeLine(msg1, msg2 = "", color = "blue") {
  if (color === "blue") {
    process.stdout.write("\r" + chalk.hex("#6dd2ea")(msg1) + " " + msg2);
  } else if (color === "green") {
    process.stdout.write("\r" + chalk.hex("#9bed7f")(msg1) + " " + msg2);
  } else if (color === "red") {
    process.stdout.write("\r" + chalk.hex("#ed7f7f")(msg1) + " " + msg2);
  } else {
    process.stdout.write("\r" + chalk.hex(color)(msg1) + " " + msg2);
  }
}

// 流式输出
async function streamOutput(text, speed = 30, color = "#9bed7f") {
  for (const char of text) {
    process.stdout.write(chalk.hex(color)(char));
    await delay(speed + Math.random() * 20);
  }
  process.stdout.write("\n");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loading(label = "Thinking...") {
  let animationInterval;
  const spinners = ["|", "/", "-", "\\"];
  let spinnerIndex = 0;
  process.stdout.write("\r");
  animationInterval = setInterval(() => {
    writeLine(spinners[spinnerIndex], label);
    spinnerIndex = (spinnerIndex + 1) % spinners.length;
  }, 200);
  return (endLabel, isError = false) => {
    clearInterval(animationInterval);
    if (endLabel) {
      writeLine(endLabel, "", isError ? "red" : "green");
    }
    process.stdout.write("\r\n");
  };
}

function log(msg, color) {
  if (!color) {
    console.log(msg);
  } else {
    console.log(chalk.hex(color)(msg));
  }
}

// 添加扩展
function addExtensionToConfig(fileName) {
  const userConfigPath = path.join(os.homedir(), ".ai-cmd.config.js");
  const filePath = path.resolve(process.cwd(), fileName);
  // 判断文件是否存在
  if (!fs.existsSync(filePath)) {
    logError(`File not found: ${filePath}`);
    return;
  }
  if (!fs.existsSync(userConfigPath)) {
    logError(
      `User config file not found: ${userConfigPath}. Please run 'ai config reset' first.`,
    );
    return;
  }
  const userConfig = require(userConfigPath);
  if (userConfig.extensions && Array.isArray(userConfig.extensions)) {
    userConfig.extensions.push(filePath);
  } else {
    userConfig.extensions = [filePath];
  }
  fs.writeFileSync(
    userConfigPath,
    `module.exports = ${JSON.stringify(userConfig, null, 2)}`,
  );
  logSuccess(
    `Extension added to config: ${filePath}.You can run 'ai ext ls' to view the changes.`,
  );
}

// 移除扩展
function removeExtensionFromConfig(fileName) {
  const userConfigPath = path.join(os.homedir(), ".ai-cmd.config.js");
  if (!fs.existsSync(userConfigPath)) {
    logError(
      `User config file not found: ${userConfigPath}. Please run 'ai config reset' first.`,
    );
    return;
  }
  const userConfig = require(userConfigPath);
  // 增加对数字索引的支持
  if (!isNaN(Number(fileName))) {
    const extIndex = Number(fileName);
    if (extIndex < 0 || extIndex >= userConfig.extensions.length) {
      logError(`Invalid extension index: ${extIndex}`);
      return;
    }
    const filePath = userConfig.extensions.splice(extIndex, 1);
    fs.writeFileSync(
      userConfigPath,
      `module.exports = ${JSON.stringify(userConfig, null, 2)}`,
    );
    logSuccess(
      `Extension removed from config: ${filePath}.You can run 'ai ext ls' to view the changes.`,
    );
    return;
  }
  const filePath = path.resolve(process.cwd(), fileName);
  // 判断文件是否存在
  if (!fs.existsSync(filePath)) {
    logError(`File not found: ${filePath}`);
    return;
  }
  if (userConfig.extensions && Array.isArray(userConfig.extensions)) {
    userConfig.extensions = userConfig.extensions.filter(
      (ext) => ext !== filePath,
    );
  }
  fs.writeFileSync(
    userConfigPath,
    `module.exports = ${JSON.stringify(userConfig, null, 2)}`,
  );
  logSuccess(
    `Extension removed from config: ${filePath}.You can run 'ai ext ls' to view the changes.`,
  );
}

// 查看扩展列表
function viewExtensionsFromConfig() {
  const userConfigPath = path.join(os.homedir(), ".ai-cmd.config.js");
  if (!fs.existsSync(userConfigPath)) {
    logError(
      `User config file not found: ${userConfigPath}. Please run 'ai config reset' first.`,
    );
    return;
  }
  const userConfig = require(userConfigPath);
  if (userConfig.extensions && Array.isArray(userConfig.extensions)) {
    console.log("=".repeat(50));
    // 打印扩展列表，并加上索引
    if (userConfig.extensions.length === 0) {
      console.log(`No extensions in config.`);
    } else {
      console.log("Extensions in config:");
      userConfig.extensions.forEach((ext, index) => {
        console.log(`[${index}] ${ext}`);
      });
    }
    console.log("=".repeat(50));
  } else {
    logSuccess(`No extensions in config.`);
  }
}

module.exports = {
  logInfo,
  logSuccess,
  logError,
  loading,
  writeLine,
  streamOutput,
  addExtensionToConfig,
  removeExtensionFromConfig,
  viewExtensionsFromConfig,
};
