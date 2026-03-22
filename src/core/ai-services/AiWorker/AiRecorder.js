/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-16 09:18:05
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-17 10:01:45
 * @FilePath: \src\core\ai-services\AiWorker\AiRecorder.js
 * @Description: 对话历史记录、恢复
 * @
 */
const fs = require("fs-extra");
const path = require("path");
const inquirer = require("inquirer");
const dayjs = require("dayjs");
const { GlobalVariable } = require("../../globalVariable");

class AiRecorder {
  constructor(aiCli) {
    this.aiCli = aiCli;
  }

  record(messages) {
    if (!GlobalVariable.isRecordHistory) {
      return false;
    }
    const recordDir = path.join(process.cwd(), "ai-history");
    const recordFile = path.join(recordDir, "history.json");

    try {
      fs.ensureDirSync(recordDir);
      const recordData = {
        timestamp: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        messages: messages,
      };

      fs.writeJSONSync(recordFile, recordData, { spaces: 2 });
      return true;
    } catch (error) {
      console.error("Failed to record:", error.message);
      return false;
    }
  }

  async recover() {
    if (!GlobalVariable.isRecordHistory) {
      return null;
    }
    const recordDir = path.join(process.cwd(), "ai-history");
    const recordFile = path.join(recordDir, "history.json");

    try {
      const exists = fs.pathExistsSync(recordFile);
      if (!exists) {
        return null;
      }
      const recordData = fs.readJSONSync(recordFile);
      const answer = await inquirer.default.prompt([
        {
          type: "confirm",
          name: "recover",
          message: "发现之前的任务记录，是否恢复？",
          default: true,
        },
      ]);
      if (answer.recover) {
        return {
          messages: recordData.messages,
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error("Failed to recover:", error.message);
      return null;
    }
  }

  // 记录message以及压缩后的messages
  log(message) {
    if (GlobalVariable.isLog) {
      const time = dayjs();
      const logDir = path.join(
        process.cwd(),
        `ai-log/${time.format("YYYY-MM-DD")}`,
      );
      const logFile = path.join(logDir, `log-${time.format("HH")}.txt`);

      try {
        fs.ensureDirSync(logDir);
        if (typeof message === "object" && !Array.isArray(message)) {
          message = JSON.stringify(message);
        } else if (Array.isArray(message)) {
          message = '###压缩上下文###' + "\n" + JSON.stringify(message);
        }
        const logEntry = `[${new Date().toISOString()}] ${message}\n`;
        fs.appendFileSync(logFile, logEntry);
        return true;
      } catch (error) {
        console.error("Failed to log:", error.message);
        return false;
      }
    }
  }

  clear() {
    const recordDir = path.join(process.cwd(), "ai-history");
    try {
      const exists = fs.pathExistsSync(recordDir);
      if (exists) {
        fs.removeSync(recordDir);
      }
      return true;
    } catch (error) {
      console.error("Failed to clear:", error.message);
      return false;
    }
  }
}

module.exports = AiRecorder;
