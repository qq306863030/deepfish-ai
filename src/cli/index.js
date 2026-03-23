#!/usr/bin/env node
const { program } = require("commander");
const AICLI = require("../core/AICLI");
const { logError } = require("../core/utils/log");
const { GlobalVariable } = require("../core/globalVariable.js");
const ConfigManager = require("./ConfigManager.js");
require("./ai-config.js");
require("./ai-ext.js");
require("./ai-skill.js");

program
  .version("1.0.0")
  .description(
    "A command-line tool that uses AI to execute commands and manipulate files",
  )
  .option("-p, --prompt <prompt>", "The prompt to send to the AI")
  .option("-i, --interactive", "Start interactive mode")
  .arguments("[prompt...]")
  .action((prompt) => {
    program.prompt = Array.isArray(prompt) ? prompt.join(" ") : prompt || "";
  });

async function main() {
  try {
    if (program.args && (program.args[0] === "config" || program.args[0] === "ext" || program.args[0] === "skill")) {
      return;
    }
    const options = program.opts();
    let prompt;

    if (program.prompt) {
      prompt = program.prompt;
    } else if (options.prompt) {
      prompt = options.prompt;
    } else if (!program.args || program.args.length === 0) {
      options.interactive = true;
    } else {
      prompt = program.args.join(" ");
    }
    const configManager = GlobalVariable.configManager
    // 判断当前列表是否为空
    if (configManager.isAiListEmpty()) {
      logError("No AI configurations found.");
      logError("Please use 'ai config add' to add a new AI configuration.");
      return;
    }
    const currentAi = configManager.getCurrentAi();
    // 判断当前是否有设置当前配置
    if (!currentAi || currentAi.trim() === "") {
      logError("No current AI configuration set.");
      logError("Please use 'ai config use <name>' to set a current configuration.");
      return;
    }
    if (!GlobalVariable.configManager) {
      GlobalVariable.configManager = new ConfigManager();
    }
    const cli = new AICLI(configManager.config);
    if (options.interactive) {
      cli.startInteractive();
      return;
    }

    if (prompt) {
      cli.run(prompt);
    }
  } catch (error) {
    logError(error.stack);
  }
}

program.parse(process.argv);

main();
