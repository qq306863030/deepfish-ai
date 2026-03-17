#!/usr/bin/env node
const { program } = require("commander");
const inquirer = require("inquirer");
const fs = require("fs");
const AICLI = require("./core/AICLI");
const { logSuccess, logError } = require("./core/utils");
const { getDefaultConfig, addExtensionToConfig, removeExtensionFromConfig, viewExtensionsFromConfig, getConfigPath } = require("./core/config");
const userConfigPath = getConfigPath()

async function handleMissingConfig() {
  logError("Configuration file not initialized");
  
  // Create new configuration file with empty ai array
  console.log("Creating new configuration file:", userConfigPath);
  const configContent = `module.exports = ${JSON.stringify(getDefaultConfig(), null, 2)}`;
  fs.writeFileSync(userConfigPath, configContent);
  console.log("Configuration file created with empty AI configurations.");
}

async function runSetupCommand(isAdd = false) {
  console.log("AI Service Configuration");
  console.log("=".repeat(50));

  let currentConfig = {};
  if (fs.existsSync(userConfigPath)) {
    try {
      currentConfig = require(userConfigPath);
    } catch (error) {
      logError(
        "Warning: Could not load existing configuration:",
        error.message,
      );
    }
  } else {
    currentConfig = getDefaultConfig();
  }

  const questions = [
    {
      type: "input",
      name: "name",
      message: "Enter AI configuration name:",
      when: () => isAdd,
      validate: (value) => {
        if (value.trim() === "") {
          return "Configuration name cannot be empty";
        }
        // Check if configuration with the same name already exists
        if (fs.existsSync(userConfigPath)) {
          try {
            const existingConfig = require(userConfigPath);
            if (existingConfig.ai && Array.isArray(existingConfig.ai)) {
              const existingIndex = existingConfig.ai.findIndex(config => config.name === value.trim());
              if (existingIndex !== -1) {
                return "Configuration with this name already exists. Please enter a different name.";
              }
            }
          } catch (error) {
            // Ignore error if config file cannot be loaded
          }
        }
        return true;
      },
    },
    {
      type: "list",
      name: "type",
      message: "Select AI service type:",
      choices: [
        { name: "Ollama (Local)", value: "ollama" },
        { name: "DeepSeek (Online)", value: "deepseek" },
        { name: "OpenAI (Online)", value: "openai" },
      ],
      default: currentConfig.ai?.[0]?.type || "ollama",
    },
    {
      type: "input",
      name: "otherType",
      message: "Enter custom AI service type:",
      when: (answers) => answers.type === "other",
      default: currentConfig.ai?.[0]?.type || "custom",
    },
    {
      type: "input",
      name: "baseUrl",
      message: "Enter API base URL:",
      when: (answers) => answers.type !== "other",
      default: (answers) => {
        switch (answers.type) {
          case "ollama":
            return "http://localhost:11434/v1";
          case "deepseek":
            return "https://api.deepseek.com";
          case "openai":
            return "https://api.openai.com/v1";
          default:
            return currentConfig.ai?.[0]?.baseUrl || "";
        }
      },
    },
    {
      type: "input",
      name: "otherBaseUrl",
      message: "Enter API base URL:",
      when: (answers) => answers.type === "other",
      default: currentConfig.ai?.[0]?.baseUrl || "",
    },
    {
      type: "list",
      name: "model",
      message: "Select DeepSeek model:",
      when: (answers) => answers.type === "deepseek",
      choices: [
        { name: "deepseek-chat", value: "deepseek-chat" },
        { name: "deepseek-reasoner", value: "deepseek-reasoner" },
        { name: "Other", value: "other" },
      ],
      default: "deepseek-reasoner",
    },
    {
      type: "input",
      name: "model",
      message: "Enter model name:",
      when: (answers) => answers.type !== "other" && answers.type !== "deepseek",
      default: (answers) => {
        switch (answers.type) {
          case "ollama":
            return "deepseek-v3.2:cloud";
          case "openai":
            return "gpt-4";
          default:
            return currentConfig.ai?.[0]?.model || "";
        }
      },
    },
    {
      type: "input",
      name: "deepseekOtherModel",
      message: "Enter DeepSeek model name:",
      when: (answers) => answers.type === "deepseek" && answers.model === "other",
      default: currentConfig.ai?.[0]?.model || "",
    },
    {
      type: "input",
      name: "otherModel",
      message: "Enter model name:",
      when: (answers) => answers.type === "other",
      default: currentConfig.ai?.[0]?.model || "",
    },
    {
      type: "input",
      name: "apiKey",
      message: "Enter API key:",
      when: (answers) =>
        answers.type === "deepseek" || answers.type === "openai",
      default: "",
    },
    {
      type: "input",
      name: "otherApiKey",
      message: "Enter API key:",
      when: (answers) => answers.type === "other",
      default: currentConfig.ai?.[0]?.apiKey || "",
    },
    {
      type: "number",
      name: "temperature",
      message: "Enter temperature (0-2):",
      default: 0.7,
      validate: (value) =>
        (value >= 0 && value <= 2) || "Temperature must be between 0 and 2",
    },
    {
      type: "number",
      name: "maxTokens",
      message: "Enter max tokens:",
      default: 8192,
      validate: (value) => value > 0 || "Max tokens must be greater than 0",
    },
    {
      type: "confirm",
      name: "stream",
      message: "Enable streaming output:",
      default: true,
    },
  ];

  const answers = await inquirer.default.prompt(questions);
  
  // Check if name is empty when adding new configuration
  if (isAdd && (!answers.name || answers.name.trim() === "")) {
    console.log("Configuration name cannot be empty");
    process.exit(1);
  }
  
  // Check if configuration with the same name already exists
  if (isAdd && fs.existsSync(userConfigPath)) {
    try {
      const existingConfig = require(userConfigPath);
      if (existingConfig.ai && Array.isArray(existingConfig.ai)) {
        const existingIndex = existingConfig.ai.findIndex(config => config.name === answers.name.trim());
        if (existingIndex !== -1) {
          console.log(`Configuration with name "${answers.name}" already exists. Please enter a different name.`);
          await runSetupCommand(isAdd);
          return;
        }
      }
    } catch (error) {
      // Ignore error if config file cannot be loaded
    }
  }
  
  const aiConfig = {
    name: answers.name || "default",
    type: answers.type === "other" ? answers.otherType : answers.type,
    baseUrl: answers.type === "other" ? answers.otherBaseUrl : answers.baseUrl,
    model: answers.type === "other" ? answers.otherModel : (answers.type === "deepseek" && answers.model === "other" ? answers.deepseekOtherModel : answers.model),
    apiKey: answers.type === "ollama" ? 'ollama' : answers.apiKey,
    temperature: answers.temperature,
    maxTokens: answers.maxTokens,
    stream: answers.stream,
  };

  if (isAdd) {
    // Add new AI configuration
    const existingConfig = fs.existsSync(userConfigPath) ? require(userConfigPath) : getDefaultConfig();
    
    // Check if configuration with the same name already exists
    const existingIndex = existingConfig.ai.findIndex(config => config.name === aiConfig.name);
    if (existingIndex !== -1) {
      logError(`Configuration with name "${aiConfig.name}" already exists.`);
      return;
    }
    
    existingConfig.ai.push(aiConfig);
    const configContent = `module.exports = ${JSON.stringify(existingConfig, null, 2)}`;
    fs.writeFileSync(userConfigPath, configContent);
    
    logSuccess(`AI configuration "${aiConfig.name}" added successfully!`);
  } else {
    // Update default configuration
    const existingConfig = fs.existsSync(userConfigPath) ? require(userConfigPath) : getDefaultConfig();
    
    // Add the new configuration to the array
    existingConfig.ai.push(aiConfig);
    existingConfig.currentAi = aiConfig.name;
    
    const configContent = `module.exports = ${JSON.stringify(existingConfig, null, 2)}`;
    fs.writeFileSync(userConfigPath, configContent);
    
    logSuccess("\nConfiguration saved successfully to:", userConfigPath);
  }

  console.log("=".repeat(50));
  console.log("AI configuration details:");
  console.log(`Name: ${aiConfig.name}`);
  console.log(`Type: ${aiConfig.type}`);
  console.log(`API Base URL: ${aiConfig.baseUrl}`);
  console.log(`Model: ${aiConfig.model}`);
  if (aiConfig.apiKey) {
    console.log(`API Key: ${aiConfig.apiKey.substring(0, 8)}...`);
  }
  console.log(`Temperature: ${aiConfig.temperature}`);
  console.log(`Max Tokens: ${aiConfig.maxTokens}`);
  console.log(`Streaming Output: ${aiConfig.stream ? 'Enabled' : 'Disabled'}`);
  console.log("=".repeat(50));
}

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

const extCommand = program
  .command("ext")
  .description("Extension management commands");

extCommand
  .command("add <filename>")
  .description("Add extension tool to the configuration")
  .action((filename) => {
    addExtensionToConfig(filename);
  });

extCommand
  .command("del <filename>")
  .description("Remove extension tool from the configuration")
  .action((filename) => {
    removeExtensionFromConfig(filename);
  });

extCommand
  .command("ls")
  .description("List all extension tools in the configuration")
  .action(() => {
    viewExtensionsFromConfig();
  });

const configCommand = program
  .command("config")
  .description("Configure AI service settings");


configCommand
  .command("edit")
  .description("Edit configuration file with notepad")
  .action(async () => {
    if (fs.existsSync(userConfigPath)) {
      // File exists, open for editing
      const { exec } = require("child_process");
      exec(`notepad "${userConfigPath}"`, (error) => {
      if (error) {
        logError("Error opening configuration file:", error.message);
      }
    });
    } else {
      // File doesn't exist, prompt to create
      logError("Configuration file not initialized");

      const { createConfig } = await inquirer.default.prompt([
        {
          type: "confirm",
          name: "createConfig",
          message: "Would you like to create a configuration file now?",
          default: true,
        },
      ]);

      if (createConfig) {
        // Create new configuration file with empty ai array
        console.log("Creating new configuration file:", userConfigPath);
        const newConfig = getDefaultConfig();
        const configContent = `module.exports = ${JSON.stringify(newConfig, null, 2)}`;
        fs.writeFileSync(userConfigPath, configContent);
        console.log("Configuration file created with empty AI configurations.");
      }
      // Don't open the file after creating it
    }
  });

configCommand
  .command("clear")
  .description("Delete the configuration file")
  .action(async () => {
    if (!fs.existsSync(userConfigPath)) {
      console.log("Configuration file does not exist");
      return;
    }

    const { confirm } = await inquirer.default.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "Are you sure you want to delete the configuration file?",
        default: false,
      },
    ]);

    if (confirm) {
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
    if (fs.existsSync(userConfigPath)) {
      const { confirm } = await inquirer.default.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: "Are you sure you want to reset the configuration file?",
          default: false,
        },
      ]);

      if (confirm) {
        console.log("Resetting configuration file:", userConfigPath);
        // Create new default configuration and overwrite existing file
        const configContent = `module.exports = ${JSON.stringify(getDefaultConfig(), null, 2)}`;
        fs.writeFileSync(userConfigPath, configContent);
        console.log("Configuration file has been reset to default settings.");
      } else {
        console.log("Operation cancelled");
        process.exit(0);
      }
    } else {
      // Create new configuration file with empty ai array
      const newConfig = getDefaultConfig();
      const configContent = `module.exports = ${JSON.stringify(newConfig, null, 2)}`;
      fs.writeFileSync(userConfigPath, configContent);
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
    if (!fs.existsSync(userConfigPath)) {
      await handleMissingConfig();
      return;
    }

    try {
      const currentConfig = require(userConfigPath);
      console.log("AI Configurations");
      console.log("=".repeat(50));
      
      if (currentConfig.ai && Array.isArray(currentConfig.ai)) {
        if (currentConfig.ai.length === 0) {
          logError("No AI configurations found.");
        } else {
          currentConfig.ai.forEach((config, index) => {
            const isCurrent = currentConfig.currentAi === config.name;
            console.log(`${config.name} ${isCurrent ? '(current)' : ''}`);
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
    if (!fs.existsSync(userConfigPath)) {
      await handleMissingConfig();
      return;
    }

    try {
      const currentConfig = require(userConfigPath);
      
      // Check if configuration with the specified name exists
      const aiConfig = currentConfig.ai.find(config => config.name === name);
      if (!aiConfig) {
          logError(`Configuration with name "${name}" not found.`);
          return;
        }
      
      // Update current AI configuration
      currentConfig.currentAi = name;
      const configContent = `module.exports = ${JSON.stringify(currentConfig, null, 2)}`;
      fs.writeFileSync(userConfigPath, configContent);
      
      logSuccess(`Current AI configuration set to "${name}" successfully.`);
    } catch (error) {
      logError("Error loading configuration:", error.message);
    }
  });

configCommand
  .command("del <name>")
  .description("Delete the specified AI configuration")
  .action(async (name) => {
    if (!fs.existsSync(userConfigPath)) {
      await handleMissingConfig();
      return;
    }

    try {
      const currentConfig = require(userConfigPath);
      
      // Check if configuration with the specified name exists
      const existingIndex = currentConfig.ai.findIndex(config => config.name === name);
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
      const configContent = `module.exports = ${JSON.stringify(currentConfig, null, 2)}`;
      fs.writeFileSync(userConfigPath, configContent);
      
      logSuccess(`AI configuration "${name}" deleted successfully!`);
    } catch (error) {
      logError("Error loading configuration:", error.message);
    }
  });

configCommand
  .command("view [name]")
  .description("View details of the specified AI configuration")
  .action(async (name) => {
    if (!fs.existsSync(userConfigPath)) {
      logError("Configuration file not initialized");

      const { createConfig } = await inquirer.default.prompt([
        {
          type: "confirm",
          name: "createConfig",
          message: "Would you like to create a configuration file now?",
          default: true,
        },
      ]);

      if (createConfig) {
        // Create new configuration file with empty ai array
        console.log("Creating new configuration file:", userConfigPath);
        const newConfig = getDefaultConfig();
        const configContent = `module.exports = ${JSON.stringify(newConfig, null, 2)}`;
        fs.writeFileSync(userConfigPath, configContent);
        console.log("Configuration file created with empty AI configurations.");
      }
      return;
    }

    try {
      const currentConfig = require(userConfigPath);
      
      let aiConfig;
      if (name) {
        // View specified configuration
        aiConfig = currentConfig.ai.find(config => config.name === name);
        if (!aiConfig) {
          logError(`Configuration with name "${name}" not found.`);
          return;
        }
      } else {
        // 检查ai列表是否为空
        if (!currentConfig.ai || !Array.isArray(currentConfig.ai) || currentConfig.ai.length === 0) {
          logError("No AI configurations found.");
          logError("Please use 'ai config add' to add a new AI configuration.");
          return;
        }
        // View current configuration
        const currentName = currentConfig.currentAi;
        if (!currentName || currentName.trim() === "") {
          logError("No current AI configuration set.");
          logError("Please use 'ai config use <name>' to set a current configuration.");
          return;
        }
        // Check if ai array exists and is not empty
        if (!currentConfig.ai || !Array.isArray(currentConfig.ai) || currentConfig.ai.length === 0) {
          logError("No AI configurations found.");
          logError("Please use 'ai config add' to add a new AI configuration.");
          return;
        }
        aiConfig = currentConfig.ai.find(config => config.name === currentName);
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
      console.log(`Streaming Output: ${aiConfig.stream ? 'Enabled' : 'Disabled'}`);
      console.log(`Is Current: ${currentConfig.currentAi === aiConfig.name ? 'Yes' : 'No'}`);
      console.log(`File Path: ${userConfigPath}`);
      console.log("=".repeat(50));
    } catch (error) {
      logError("Error loading configuration:", error.message);
    }
  });



async function main() {
  try {
    if (program.args && (program.args[0] === "config" || program.args[0] === "ext")) {
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
    if (!fs.existsSync(userConfigPath)) {
      await handleMissingConfig();
      return;
    }
    const config = require(userConfigPath);
    // 判断当前列表是否为空
    if (!config.ai || !Array.isArray(config.ai) || config.ai.length === 0) {
      logError("No AI configurations found.");
      logError("Please use 'ai config add' to add a new AI configuration.");
      return;
    }
    // 判断当前是否有设置当前配置
    if (!config.currentAi || config.currentAi.trim() === "") {
      logError("No current AI configuration set.");
      logError("Please use 'ai config use <name>' to set a current configuration.");
      return;
    }
    const cli = new AICLI(config);
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
