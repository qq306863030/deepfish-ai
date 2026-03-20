/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-19 11:45:10
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-20 17:45:46
 * @FilePath: \deepfish\src\cli\ai-config.js
 * @Description: ai config 相关命令
 * @
 */
const { program } = require("commander");
const fs = require("fs");
const { getConfigPath, checkConfigFile, writeConfig, handleMissingConfig, getConfig } = require("./configTools");
const { logError, askConfirm, logSuccess } = require("../core/utils/log");
const configCommand = program
  .command("config")
  .description("Configure AI service settings");

configCommand
  .command("edit")
  .description("Edit configuration file with default editor")
  .action(async () => {
    const userConfigPath = getConfigPath();
    if (fs.existsSync(userConfigPath)) {
      const { exec } = require("child_process");
      const platform = process.platform;

      let openCommand;
      if (process.env.EDITOR) {
        openCommand = `${process.env.EDITOR} "${userConfigPath}"`;
      } else if (platform === "darwin") {
        openCommand = `open -e "${userConfigPath}"`;
      } else if (platform === "win32") {
        openCommand = `notepad "${userConfigPath}"`;
      } else {
        openCommand = `xdg-open "${userConfigPath}"`;
      }

      exec(openCommand, (error) => {
        if (error) {
          logError("Error opening configuration file:", error.message);
        }
      });
    } else {
      // File doesn't exist, prompt to create
      handleMissingConfig()
    }
  });

configCommand
  .command("clear")
  .description("Delete the configuration file")
  .action(async () => {
    const userConfigPath = getConfigPath();
    if (!fs.existsSync(userConfigPath)) {
      console.log("Configuration file does not exist");
      return;
    }

    const isClear = await askConfirm(
      "isClear",
      "Are you sure you want to delete the configuration file?",
      false,
    );

    if (isClear) {
      fs.unlinkSync(userConfigPath);
      logSuccess("Configuration file deleted successfully:", userConfigPath);
    } else {
      console.log("Operation cancelled");
    }
  });

configCommand
  .command("reset")
  .description("Reset configuration file")
  .action(async () => {
    const userConfigPath = getConfigPath();
    if (fs.existsSync(userConfigPath)) {
      const isReset = await askConfirm(
        "isReset",
        "Are you sure you want to reset the configuration file?",
        false
      );
      if (isReset) {
        console.log("Resetting configuration file:", userConfigPath);
        // Create new default configuration and overwrite existing file
        writeConfig();
        console.log("Configuration file has been reset to default settings.");
      } else {
        console.log("Operation cancelled");
        process.exit(0);
      }
    } else {
      // Create new configuration file with empty ai array
      writeConfig();
      console.log("Configuration file created with empty AI configurations.");
    }
  });

configCommand
  .command("add")
  .description("Add a new AI configuration")
  .action(async () => {
    await runSetupCommand(true);
  });

configCommand
  .command("ls")
  .description("List all AI configurations")
  .action(async () => {
    const userConfigPath = getConfigPath();
    if (!fs.existsSync(userConfigPath)) {
      await handleMissingConfig();
      return;
    }

    try {
      const currentConfig = getConfig();
      console.log("AI Configurations");
      console.log("=".repeat(50));

      if (currentConfig.ai && Array.isArray(currentConfig.ai)) {
        if (currentConfig.ai.length === 0) {
          logError("No AI configurations found.");
        } else {
          currentConfig.ai.forEach((config, index) => {
            const isCurrent = currentConfig.currentAi === config.name;
            console.log(`${config.name} ${isCurrent ? "(current)" : ""}`);
          });
        }
      } else {
        logError("No AI configurations found.");
      }

      console.log("=".repeat(50));
    } catch (error) {
      logError("Error loading configuration:", error.message);
    }
  });

configCommand
  .command("use <name>")
  .description("Set the specified AI configuration as current")
  .action(async (name) => {
    const userConfigPath = getConfigPath();
    if (!fs.existsSync(userConfigPath)) {
      await handleMissingConfig();
      return;
    }

    try {
      const currentConfig = getConfig();
      
      // Check if configuration with the specified name exists
      const aiConfig = currentConfig.ai.find((config) => config.name === name);
      if (!aiConfig) {
        logError(`Configuration with name "${name}" not found.`);
        return;
      }

      // Update current AI configuration
      currentConfig.currentAi = name;
      writeConfig(currentConfig);
      logSuccess(`Current AI configuration set to "${name}" successfully.`);
    } catch (error) {
      logError("Error loading configuration:", error.message);
    }
  });

configCommand
  .command("del <name>")
  .description("Delete the specified AI configuration")
  .action(async (name) => {
    const userConfigPath = getConfigPath();
    if (!fs.existsSync(userConfigPath)) {
      await handleMissingConfig();
      return;
    }

    try {
      const currentConfig = getConfig();

      // Check if configuration with the specified name exists
      const existingIndex = currentConfig.ai.findIndex(
        (config) => config.name === name,
      );
      if (existingIndex === -1) {
        console.log(`Configuration with name "${name}" not found.`);
        return;
      }

      // Check if it's the current configuration
      if (currentConfig.currentAi === name) {
        console.log(`Cannot delete current configuration "${name}".`);
        return;
      }

      // Remove the configuration
      currentConfig.ai.splice(existingIndex, 1);
      writeConfig(currentConfig);

      logSuccess(`AI configuration "${name}" deleted successfully!`);
    } catch (error) {
      logError("Error loading configuration:", error.message);
    }
  });

configCommand
  .command("view [name]")
  .description("View details of the specified AI configuration")
  .action(async (name) => {
    const userConfigPath = getConfigPath();
    if (!fs.existsSync(userConfigPath)) {
      handleMissingConfig()
      return;
    }

    try {
      const currentConfig = getConfig();

      let aiConfig;
      if (name) {
        // View specified configuration
        aiConfig = currentConfig.ai.find((config) => config.name === name);
        if (!aiConfig) {
          logError(`Configuration with name "${name}" not found.`);
          return;
        }
      } else {
        // 检查ai列表是否为空
        if (
          !currentConfig.ai ||
          !Array.isArray(currentConfig.ai) ||
          currentConfig.ai.length === 0
        ) {
          logError("No AI configurations found.");
          logError("Please use 'ai config add' to add a new AI configuration.");
          return;
        }
        // View current configuration
        const currentName = currentConfig.currentAi;
        if (!currentName || currentName.trim() === "") {
          logError("No current AI configuration set.");
          logError(
            "Please use 'ai config use <name>' to set a current configuration.",
          );
          return;
        }
        // Check if ai array exists and is not empty
        if (
          !currentConfig.ai ||
          !Array.isArray(currentConfig.ai) ||
          currentConfig.ai.length === 0
        ) {
          logError("No AI configurations found.");
          logError("Please use 'ai config add' to add a new AI configuration.");
          return;
        }
        aiConfig = currentConfig.ai.find(
          (config) => config.name === currentName,
        );
        if (!aiConfig) {
          logError(`Current AI configuration "${currentName}" not found.`);
          return;
        }
      }

      console.log("AI Configuration Details");
      console.log("=".repeat(50));
      console.log(`Name: ${aiConfig.name}`);
      console.log(`Type: ${aiConfig.type}`);
      console.log(`API Base URL: ${aiConfig.baseUrl}`);
      console.log(`Model: ${aiConfig.model}`);
      if (aiConfig.apiKey) {
        console.log(`API Key: ${aiConfig.apiKey.substring(0, 8)}...`);
      }
      console.log(`Temperature: ${aiConfig.temperature}`);
      console.log(`Max Tokens: ${aiConfig.maxTokens}`);
      console.log(
        `Streaming Output: ${aiConfig.stream ? "Enabled" : "Disabled"}`,
      );
      console.log(
        `Is Current: ${currentConfig.currentAi === aiConfig.name ? "Yes" : "No"}`,
      );
      console.log(`File Path: ${userConfigPath}`);
      console.log("=".repeat(50));
    } catch (error) {
      logError("Error loading configuration:", error.message);
    }
  });
