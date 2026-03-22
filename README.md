<div align="center" style="display:flex;align-items: center;justify-content: center;">
  <img src="./images/title-img.png" alt="DeepFish" width="300" />
</div>

---

<div align="center" style="line-height: 1">
  <img alt="QQ" src="https://img.shields.io/badge/QQ-306863030-green.svg" />
  <img
    alt="WeChat"
    src="https://img.shields.io/badge/WeChat-MrRoman_123-green.svg"
  />
  <a href="https://github.com/qq306863030/deepfish">
    <img
      alt="GitHub"
      src="https://img.shields.io/badge/GitHub-DeepFish-blue.svg"
  /></a>
  <a href="https://www.npmjs.com/package/deepfish">
    <img alt="NPM" src="https://img.shields.io/badge/NPM-DeepFish-blue.svg"
  /></a>
  <img
    alt="Code License"
    src="https://img.shields.io/badge/Code_License-MIT-blue"
  />
</div>

<img src="./images/banner.png" alt="banner" style="width:100%;text-align:center;" />



- [English](README.md) | [中文](README_CN.md)

## Table of Contents

- [Table of Contents](#table-of-contents)
- [1. Introduction](#1-introduction)
- [2. Installation](#2-installation)
  - [Prerequisites](#prerequisites)
  - [Installation via npm](#installation-via-npm)
  - [Installation from Source](#installation-from-source)
- [3. Quick Start](#3-quick-start)
- [4. Configuration](#4-configuration)
  - [Initial Setup](#initial-setup)
  - [Configuration Commands](#configuration-commands)
  - [Configuration File Structure](#configuration-file-structure)
- [5. Usage](#5-usage)
  - [Interactive Mode](#interactive-mode)
  - [Direct Command Mode](#direct-command-mode)
  - [Usage Examples](#usage-examples)
- [6. Extension Development](#6-extension-development)
  - [Creating an Extension](#creating-an-extension)
  - [Registering Extensions](#registering-extensions)
- [7. Recommendations](#7-recommendations)
  - [AI Service Selection](#ai-service-selection)
- [8. Usage Notes](#8-usage-notes)
  - [Using Relative Paths](#using-relative-paths)
- [9. Troubleshooting](#9-troubleshooting)
  - [Configuration Issues](#configuration-issues)
  - [AI Service Connection](#ai-service-connection)
  - [Extension Not Loading](#extension-not-loading)
- [10. Contributing](#10-contributing)
- [11. License](#11-license)
- [12. Support](#12-support)



## 1. Introduction

An efficient and convenient AI-driven command-line tool designed to break down the barrier between natural language and operating system commands or file operation instructions. It enables non-professional developers to quickly generate directly executable operation instructions through simple natural language descriptions, significantly improving terminal operation efficiency.
Core Features:

- Multi-model Compatibility: Seamlessly supports DeepSeek, Ollama, and all AI models that comply with the OpenAI API specification. It can be flexibly switched according to needs to adapt to instruction generation requirements in different scenarios.

- Natural Language to Instructions: Precisely parses natural language requirements and automatically converts them into corresponding operating system commands (such as Linux, Windows, and macOS terminal commands) and file operation instructions (such as creating, deleting, and modifying files/directories), eliminating the need to manually write complex commands.

- Highly Extensible: Supports expanding functional boundaries through an extension mechanism. In addition to basic terminal and file operations, it can easily implement complex tasks such as translation, novel writing, file format conversion, and data processing to meet diverse usage needs.

- AI Automatic Extension Generation: There is no need to manually develop complex extension tools. Custom extensions can be directly generated through AI, reducing the threshold for extension development and making function expansion more efficient and flexible.[Extensions-Example](https://github.com/qq306863030/deepfish-extensions)

Suitable for various groups such as developers, operation and maintenance personnel, and daily terminal users. Whether it is quickly executing terminal operations, batch processing files, or realizing personalized needs through extensions, this tool can simplify the operation process, improve work efficiency, and empower every terminal operation with AI.


## 2. Installation

### Prerequisites

- Node.js (v22.14.0 or higher)
- npm or yarn

### Installation via npm

```bash
npm install -g deepfish-ai
```

### Installation from Source

```bash
git clone https://github.com/qq306863030/deepfish-ai.git
cd deepfish
npm install
npm link
```

## 3. Quick Start

```bash
ai config add # Enter a name, then select deepseek, and enter your DeepSeek API key
ai use [the_name_you_entered]
ai "Help me write an article about future technology in the current directory, output in markdown format"
```

## 4. Configuration

### Initial Setup

Run the configuration wizard to set up your AI service:

```bash
ai config add
```

This will prompt you to configure the following:

- **AI Service Type**: Choose DeepSeek, Ollama, or OpenAI
- **API Base URL**: Default URL provided for each service
- **Model Name**: Choose the AI model to use
- **API Key**: Required for DeepSeek and OpenAI
- **Temperature**: Controls response randomness (0-2)
- **Max Tokens**: Maximum response length
- **Streaming Output**: Enable/disable streaming response

### Configuration Commands

```bash
# Configuration commands
ai config add # Add a new AI configuration
ai config ls # List all AI configurations
ai config use <name> # Set the specified AI configuration as the current one
ai config del <name> # Delete the specified AI configuration
ai config view [name] # View details of the specified AI configuration
ai config edit # Edit the configuration file manually
ai config reset # Reset configuration
ai config clear # Delete the configuration file

# Extension commands
ai ext add <filename> # Add an extension tool
ai ext del <filepath> # Remove an extension tool by file path
ai ext del <index> # Remove an extension tool by index
ai ext ls # List all extension tools
```

### Configuration File Structure

The configuration file (`~/.deepfish-ai/config.js`) has the following structure:

```javascript
module.exports = {
  ai: [
    {
      name: "default", // AI configuration name
      type: "deepseek", // AI service type: "ollama", "deepseek", or "openai"
      baseUrl: "https://api.deepseek.com", // API base URL
      model: "deepseek-reasoner", // AI model name
      apiKey: "", // API key (required for DeepSeek and OpenAI)
      temperature: 1, // Response randomness (0-2)
      maxTokens: 8192, // Maximum response length
      stream: true, // Enable/disable streaming output
    }
  ],
  currentAi: "default", // Name of the currently active AI configuration
  maxIterations: -1, // Maximum iterations for agent workflow, -1 for unlimited
  maxMessagesLength: 50000, // Maximum compression length
  maxMessagesCount: 40, // Maximum compression count
  extensions: [], // List of extension file paths
  isRecordHistory: false, // Whether to create workflow execution record files
  isLog: false // Whether to create workflow execution logs
};
```

## 5. Usage

### Interactive Mode

Start an interactive session (multi-turn dialogue):

```bash
ai
```

Or explicitly specify:

```bash
ai -i or ai -interactive
```

### Direct Command Mode

Execute a single command:

```bash
ai "Create a file named hello.txt with the content 'Hello World'"
```

### Usage Examples

**File Operations:**

```bash
ai "Create 10 text documents, each with 100 random characters"
ai "Clear the current directory"
```

**Code Generation:**

```bash
ai "Create a simple Express server with a /hello endpoint"
ai "Create a browser-based airplane shooting game"
```

**System Commands:**

```bash
ai "List all files in the current directory with their sizes"
ai "Check disk usage for the current directory"
```

**Extension Tool Generation:**

```bash
ai "Create a weather.js extension tool for querying weather"
ai ext add weather.js
```

**Media Processing:**

```bash
ai "I have ffmpeg5 installed on my system, help me convert all MP4 files in the directory to AVI format"
```

**File Organization:**

```bash
ai "Classify all files under the 'model' directory into the 'model2' directory by month, date format YYYY-MM"
```

## 6. Extension Development

Extensions allow you to add custom functions that AI can use in its workflows. For complex processes, you can develop them yourself or try generating extensions using this program, then register the extension with the program and use the command line to complete tasks.

### Creating an Extension

1. Extensions should export an object containing `descriptions` (an array of tool descriptions) and `functions` (an object of functions).
2. Tip: You can generate extensions via AI, e.g., `ai "Create a weather.js extension tool for querying weather"`
3. View [example extensions](https://github.com/qq306863030/deepfish-extensions).

```javascript
// Example extension: Weather Extension
const axios = require('axios');

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'getWeather',
      description: 'Get current weather information for a city',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' }
        },
        required: ['city']
      }
    }
  }
];

const functions = {
  async getWeather(city) {
    // Implement weather API call
    const response = await axios.get(`https://api.weatherapi.com/v1/current.json?key=YOUR_KEY&q=${city}`);
    return `${city} weather: ${response.data.current.temp_c}°C, ${response.data.current.condition.text}`;
  }
};

module.exports = {
  descriptions,
  functions
};
```

### Registering Extensions

**Method 1: Using Command Line**

```bash
ai ext add <filename> # ai ext add weather.js
ai ext add . # Traverse the current directory, automatically scan and add extensions
```

**Method 2: Manual Configuration**

1. ai config edit
2. Add it to your configuration:

```javascript
module.exports = {
  // ... other configurations
  extensions: [
    '/path/to/weather-extension.js'
  ],
};
```

**Method 3: Automatic Scanning**

Rules for automatic scanning of extension modules upon program startup:

1. Scanning locations:
   - node_modules in the root directory
   - node_modules in the command execution directory
   - the command execution directory itself

2. Scanned files:
   - Extension packages under the @deepfish-ai directory
   - Extension packages starting with "deepfish-"
   - JavaScript extension files in the command execution directory, which are automatically loaded if they contain the strings 'module.exports', 'descriptions', and 'functions'
  
## 7. Recommendations

### AI Service Selection

**Recommendation: Use online AI services (DeepSeek/OpenAI) for best results**

While local AI services (like Ollama) offer privacy and offline capabilities, they may have the following limitations:

- **Response Accuracy**: Local models may not be as rigorous and precise as online models
- **Code Quality**: Generated code may require more manual review and correction
- **Complex Task Handling**: May encounter difficulties with multi-step or complex operations
- **Language Understanding**: Online services provide better language models

For production environments or complex tasks, we recommend using DeepSeek, OpenAI services, or cloud services within Ollama for more reliable and accurate results.

## 8. Usage Notes

### Using Relative Paths

AI always uses paths relative to the current working directory.

## 9. Troubleshooting

### Configuration Issues

If you encounter configuration errors, try resetting:

```bash
ai config reset
```

### AI Service Connection

- **Ollama**: Ensure Ollama is running locally on port 11434
- **DeepSeek/OpenAI**: Verify your API key is correct and you have sufficient quota

### Extension Not Loading

- Check the file path in the configuration
- Ensure the file exports the correct object
- Verify the file has no syntax errors

## 10. Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 11. License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 12. Support

For issues and questions, please submit an issue on the GitHub repository.