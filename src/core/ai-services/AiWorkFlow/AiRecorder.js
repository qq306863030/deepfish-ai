const fs = require("fs-extra");
const path = require("path");
const inquirer = require("inquirer");
const dayjs = require("dayjs");
const { GlobalVariable } = require("../../globalVariable");

class Recorder {
  constructor(aiCli) {
    this.aiCli = aiCli;
    this.Tools = aiCli.Tools;
  }

  async record(goal, messages) {
    if (!GlobalVariable.isRecordHistory) {
      return false;
    }
    const recordDir = path.join(process.cwd(), "ai-history");
    const recordFile = path.join(recordDir, "history.json");

    try {
      await fs.ensureDir(recordDir);
      const recordData = {
        goal: goal,
        messages: messages,
        timestamp: new Date().toISOString(),
      };

      await fs.writeJson(recordFile, recordData, { spaces: 2 });
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
      const exists = await fs.pathExists(recordFile);
      if (!exists) {
        return null;
      }
      const recordData = await fs.readJson(recordFile);
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
          goal: recordData.goal,
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

  log(content) {
    if (GlobalVariable.isLog) {
      if (Array.isArray(content)) {
        const messages = content
        const lastMessage = messages[messages.length - 1]
        content = `[${lastMessage.role}]:${JSON.stringify(lastMessage)}`
      }
      const time = dayjs();
      const logDir = path.join(
        process.cwd(),
        `ai-log/${time.format("YYYY-MM-DD")}`,
      );
      const logFile = path.join(logDir, `log-${time.format("HH")}.txt`);

      try {
        fs.ensureDirSync(logDir);
        if (typeof content === "object") {
          content = JSON.stringify(content);
        }
        const logEntry = `[${new Date().toISOString()}] ${content}\n`;
        fs.appendFileSync(logFile, logEntry);
        return true;
      } catch (error) {
        console.error("Failed to log:", error.message);
        return false;
      }
    }
  }

  async clear() {
    const recordDir = path.join(process.cwd(), "ai-history");

    try {
      const exists = await fs.pathExists(recordDir);
      if (exists) {
        await fs.remove(recordDir);
      }
      return true;
    } catch (error) {
      console.error("Failed to clear:", error.message);
      return false;
    }
  }
}

module.exports = Recorder;
