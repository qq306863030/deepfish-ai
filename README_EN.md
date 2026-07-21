<div align="center" style="display:flex;align-items: center;justify-content: center;">
  <img src="https://github.com/qq306863030/deepfish-ai/blob/master/images/title-img.png" alt="DeepFish" width="300" />
</div>

---

<div align="center" style="line-height: 1">
  <img alt="QQ" src="https://img.shields.io/badge/QQ-306863030-green.svg" />
  <img
    alt="WeChat"
    src="https://img.shields.io/badge/WeChat-MrRoman_123-green.svg"
  />
  <a href="https://github.com/qq306863030/deepfish-ai">
    <img
      alt="GitHub"
      src="https://img.shields.io/badge/GitHub-DeepFish AI-blue.svg"
  /></a>
  <a href="https://www.npmjs.com/package/deepfish-ai">
    <img alt="NPM" src="https://img.shields.io/badge/NPM-DeepFish AI-blue.svg"
  /></a>
  <img
    alt="Code License"
    src="https://img.shields.io/badge/Code_License-MIT-blue"
  />
</div>

<img src="https://github.com/qq306863030/deepfish-ai/blob/master/images/banner.png" alt="banner" style="width:100%;text-align:center;" />

- [English](README_EN.md) | [中文](README.md)

## Table of Contents

- [Table of Contents](#table-of-contents)
- [1. Introduction](#1-introduction)
- [2. Installation](#2-installation)
  - [Prerequisites](#prerequisites)
  - [Install via npm](#install-via-npm)
  - [Install from source](#install-from-source)
- [3. Quick Start](#3-quick-start)
- [4. Command Reference](#4-command-reference)
  - [Basic Chat](#basic-chat)
  - [Configuration](#configuration)
  - [Model Management](#model-management)
  - [Skill Management](#skill-management)
  - [Tool Management](#tool-management)
  - [Session Management](#session-management)
  - [Task Management](#task-management)
  - [Long Task Planning](#long-task-planning)
  - [MCP Management](#mcp-management)
  - [Serve Management](#serve-management)
  - [Cache Management (AI Self-Learning Cache)](#cache-management-ai-self-learning-cache)
- [5. MCP Extension Configuration](#5-mcp-extension-configuration)
  - [Configuration Example](#configuration-example)
- [6. Tool and Skill Extensions](#6-tool-and-skill-extensions)
  - [Current Directory Extensions](#current-directory-extensions)
  - [Global Extensions](#global-extensions)
- [7. Plugin](#7-plugin)
  - [SSH Remote Control Plugin](#ssh-remote-control-plugin)
- [8. System Configuration File](#8-system-configuration-file)
  - [Configuration Fields](#configuration-fields)
  - [AI Model Configuration Fields](#ai-model-configuration-fields)
- [9. Contributing](#9-contributing)
- [10. License](#10-license)
- [11. Support](#11-support)

## 1. Introduction

An efficient and convenient AI-driven command-line tool, dedicated to breaking the barriers between natural language and operating system commands as well as file operation instructions. Through simple natural language descriptions, it performs originally complex operations and dramatically improves work efficiency — for example, batch translating documents, remote control, installing programs, summarizing content, and more. Agent tools like Claude, Codex, Copilot, and OpenCode are like ride-hailing services, while this Agent CLI tool is like a shared bike, getting you to the last mile of your operating system quickly.

Core Features:

- **Multi-Model Compatibility**: Seamlessly supports DeepSeek, Ollama, and all AI models following the OpenAI API specification. Switch between models flexibly to adapt to different scenarios.

- **Natural Language to Command**: Accurately parses natural language requests and automatically converts them into corresponding operating system commands (Linux, Windows, macOS terminal commands) and file operation instructions (create, delete, modify files/directories), eliminating the need to write complex commands manually.

- **Skill Extension**: Skills are AI workflow knowledge packages defined via Markdown files that encapsulate best practices for specific domains. After installing a Skill, AI automatically follows its guidelines to execute tasks, such as code review workflows, document generation templates, etc. Compatible with the OpenClaw Skill ecosystem, installable and manageable via `ai skills` commands.

- **Tool Extension**: Tools are custom function tools callable by AI, defined via TypeScript files. You can write Tools to extend AI's capabilities, such as calling third-party APIs, operating databases, processing specific file formats, etc. Supported by `ai tools generate` for AI-powered automatic Tool generation, lowering the development barrier.

- **MCP Extension**: MCP (Model Context Protocol) is a standardized model context protocol that allows AI to connect to external tools and data sources. By configuring MCP Servers, AI gains capabilities like browser automation, database queries, file system access, and more. DeepFish has built-in MCP support—just simple configuration to integrate various MCP services.

- **Highly Extensible**: Supports an extension mechanism to expand functionality boundaries. Beyond basic terminal and file operations, you can easily implement translation, novel writing, file format conversion, data processing, and other complex tasks to meet diverse needs.

- **AI-Generated Extensions**: No need to manually develop complex extension tools—generate custom extensions directly through AI, lowering the barrier to extending functionality and making it more efficient and flexible. [Extension Examples](https://github.com/qq306863030/deepfish-extensions)

Suitable for developers, operations personnel, and everyday terminal users. Whether it's quickly executing terminal operations, batch processing files, or implementing personalized needs through extensions, this tool simplifies workflows and improves efficiency, bringing AI to every terminal operation.

## 2. Installation

### Prerequisites

- Node.js (v22.14.0 or higher)
- npm or yarn

### Install via npm

```bash
npm install -g deepfish-ai --verbose
```

### Install from source

```bash
git clone https://github.com/qq306863030/deepfish-ai.git
cd deepfish
npm install
npm link
```

## 3. Quick Start

```bash
ai models add # Enter name, then enter your model configuration
ai models use your-model-name
ai "Write an article about future technology in the current directory, output in markdown format"
```

## 4. Command Reference

### Basic Chat

```bash
ai "your question or instruction"
```

Enter natural language directly, and AI will automatically parse and execute the corresponding operations. DeepFish keeps only one Agent session per directory. If an Agent for this directory is already running, new messages will be automatically queued and executed in order.

Example:

```bash
cd your-project
ai "What is your name?"
ai "What question did I just ask?"
```

On the second question, AI answers based on the same session context in the current directory.

### Configuration

| Command           | Description                  |
| ----------------- | ---------------------------- |
| `ai config edit`  | Edit configuration file      |
| `ai config view`  | View current configuration   |
| `ai config reset` | Reset configuration          |
| `ai config dir`   | View configuration directory |

### Model Management

| Command                | Description             |
| ---------------------- | ----------------------- |
| `ai models add`        | Add a new model         |
| `ai models ls`         | List all models         |
| `ai models use <name>` | Switch the model in use |
| `ai models del <name>` | Delete specified model  |

### Skill Management

| Command                           | Description             |
| --------------------------------- | ----------------------- |
| `ai skills ls`                    | List all Skills         |
| `ai skills add <name>`            | Add a Skill             |
| `ai skills del <index>`           | Delete specified Skill  |
| `ai skills enable <name\|index>`  | Enable a Skill          |
| `ai skills disable <name\|index>` | Disable a Skill         |
| `ai skills dir`                   | View Skill directory    |
| `ai skills generate xxx`          | Generate a Skill via AI |

### Tool Management

| Command                 | Description                                                                  |
| ----------------------- | ---------------------------------------------------------------------------- |
| `ai tools ls`           | List all tools                                                               |
| `ai tools dir`          | View the global tool directory                                               |
| `ai tools add <name>`   | Add a local tool directory from the current workspace as local or global use |
| `ai tools del <index>`  | Delete a tool by index                                                       |
| `ai tools generate xxx` | Generate a tool via AI                                                       |

### Session Management

| Command            | Description            |
| ------------------ | ---------------------- |
| `ai session clear` | Clear session history  |
| `ai session dir`   | View session directory |

### Task Management

| Command               | Description           |
| --------------------- | --------------------- |
| `ai tasks ls`          | List all tasks        |
| `ai tasks add <task>`  | Add a task            |
| `ai tasks del <index>` | Delete specified task |
| `ai tasks clear`       | Clear all tasks       |

### Long Task Planning

| Command                       | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `ai plan-do <task description>` | Break down a complex task into subtasks and execute |
| `ai plan-continue`            | Continue an interrupted plan-do task                 |

### MCP Management

| Command                           | Description               |
| --------------------------------- | ------------------------- |
| `ai mcp ls`                       | List all MCP servers      |
| `ai mcp edit`                     | Edit MCP configuration    |
| `ai mcp enable <name\|index>`     | Enable an MCP server      |
| `ai mcp disable <name\|index>`    | Disable an MCP server     |

### Serve Management

| Command            | Description         |
| ------------------ | ------------------- |
| `ai serve`         | Start the service   |
| `ai serve start`   | Start the service   |
| `ai serve stop`    | Stop the service    |
| `ai serve restart` | Restart the service |

### Cache Management (AI Self-Learning Cache)

| Command                     | Description        |
| --------------------------- | ------------------ |
| `ai cache ls`               | List cache         |
| `ai cache edit <index\|id>` | Edit cache entry   |
| `ai cache del <index\|id>`  | Delete cache entry |

## 5. MCP Extension Configuration

MCP (Model Context Protocol) allows AI to connect to external tools and services. Edit the MCP configuration file via `ai mcp edit` command to add the MCP Servers you need.

### Configuration Example

The following example configures a Chrome DevTools MCP Server, enabling AI to perform browser automation:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--autoConnect"]
    }
  }
}
```

After configuration, AI will automatically load the tools provided by the MCP Server, and you can directly instruct AI to use these capabilities in your conversations.

## 6. Tool and Skill Extensions

DeepFish supports Tool and Skill extensions to expand AI capabilities. Extension files can be placed either in the `.deepfish-ai` directory of the current workspace or in the global configuration directory.

- **Tool Extension**: Defines custom function tools that AI can call directly. It is suitable for wrapping API calls, database operations, file processing, and other capabilities. You can use `ai tools generate xxx` to ask AI to generate a Tool from your description.
  - In a Tool function, you can call `this.createSubAgent(prompt: string)` to create a sub-agent and pass the task description as `prompt`.
  - In a Tool function, you can use `this.curAgent` to access the Agent instance currently executing the Tool. When the Tool runs inside a sub-agent, `this.curAgent` points to that sub-agent instead of the main Agent. This is useful for accessing current Agent context capabilities, such as calling `this.curAgent.createSubAgent()` to create a lower-level sub-agent.
- **Skill Extension**: Defines AI workflow knowledge packages. It is suitable for storing task procedures, rules, and best practices for specific scenarios. You can use `ai skills generate xxx` to ask AI to generate a Skill from your description.

### Current Directory Extensions

If an extension should only be available in the current directory, copy it into the `.deepfish-ai` directory under the current workspace:

```text
current-directory/
└── .deepfish-ai/
    ├── tools/
    │   └── your-tool/
    └── skills/
        └── your-skill/
```

- Place Tool extensions under `current-directory/.deepfish-ai/tools/`.
- Place Skill extensions under `current-directory/.deepfish-ai/skills/`.
- This approach only affects the current directory and is suitable for project-level extensions or capabilities used by a single project.

### Global Extensions

If an extension should be available in all directories, copy it into the `tools` or `skills` directory inside the global configuration directory.

Use the following command to open the global configuration directory:

```bash
ai config dir
```

Example structure:

```text
global-config-directory/
└── .deepfish-ai/
    ├── tools/
    │   └── your-tool/
    └── skills/
        └── your-skill/
```

- Place Tool extensions under `global-config-directory/.deepfish-ai/tools/`.
- Place Skill extensions under `global-config-directory/.deepfish-ai/skills/`.
- This approach is globally effective and is suitable for common tools or reusable workflow capabilities.

## 7. Plugin

DeepFish supports extending its capabilities via globally installed npm plugins.

### SSH Remote Control Plugin

[@deepfish-ai/deepfish-ssh-remote-control](https://www.npmjs.com/package/@deepfish-ai/deepfish-ssh-remote-control) is an SSH remote control plugin that enables AI to connect to remote servers via SSH and execute commands, making remote host management effortless.

Installation:

```bash
npm install -g @deepfish-ai/deepfish-ssh-remote-control
```

Usage: After installation, restart DeepFish and AI will automatically load the remote control tools. You can instruct AI to connect to remote servers and perform operations directly in conversations, for example:

```bash
ai "Connect to 192.168.1.100 and show me the server status"
```


## 8. System Configuration File

DeepFish stores its system configuration file at `.deepfish-ai/config.json5` under the user directory. You can open or view it with the following commands:

```bash
ai config edit
ai config view
```

### Configuration Fields

| Field                 | Type      | Default  | Description                                                                                                              |
| --------------------- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `aiList`              | `array`   | `[]`     | List of AI model configurations. Multiple model configurations can be added.                                             |
| `currentModel`        | `string`  | `''`     | Name of the currently active AI configuration. It should match the `name` of one item in `aiList`.                       |
| `maxIterations`       | `number`  | `-1`     | Maximum number of iterations for an AI workflow. `-1` means unlimited.                                                   |
| `maxMemoryExpireTime` | `number`  | `30`     | Maximum retention time for session memory, in days. `-1` means permanent retention, and `0` means no memory is recorded. |
| `maxLogExpireTime`    | `number`  | `3`      | Maximum retention time for logs, in days. `-1` means permanent retention, and `0` means no logs are recorded.            |
| `maxBlockFileSize`    | `number`  | `50`     | Maximum file block size in KB. Files larger than this value will be processed in chunks.                                 |
| `encoding`            | `string`  | `'auto'` | Command-line output encoding, such as `utf-8` or `gbk`. `auto` or an empty value enables automatic detection.            |
| `maxSubAgentCount`    | `number`  | `2`      | Maximum number of parallel sub-agents. `-1` means unlimited.                                                             |
| `isPrintThinking`     | `boolean` | `true`   | Whether to print intermediate AI thinking information.                                                                   |
| `isUseMemory`         | `boolean` | `true`   | Whether to enable memory. AI learns from historical conversations and optimizes responses.                               |
| `serve.port`          | `number`  | `8866`   | Local service port used by DeepFish.                                                                                     |

### AI Model Configuration Fields

Each item in `aiList` represents one AI model configuration. Common fields are listed below:

| Field              | Type     | Description                                                                                                              |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `name`             | `string` | Model configuration name, used by `ai models use <name>` to switch models.                                               |
| `type`             | `string` | Model provider type, such as `DeepSeek`, `Ollama`, or `OpenAICompatible`.                                                |
| `baseUrl`          | `string` | Model API endpoint.                                                                                                      |
| `model`            | `string` | Actual model name used for requests.                                                                                     |
| `apiKey`           | `string` | API key for the model provider.                                                                                          |
| `temperature`      | `number` | Randomness parameter for generation. Higher values produce more diverse output; lower values produce more stable output. |
| `maxContextLength` | `number` | Maximum context length of the model, in tokens.                                                                          |
| `isVision`         | `boolean` | Whether image recognition is supported, defaults to `false`.                                                             |

## 9. Contributing

Contributions are welcome! Feel free to submit Pull Requests at any time.

## 10. License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 11. Support

For questions and inquiries, please submit an issue on the GitHub repository.
