<div align="center" style="display:flex;align-items: center;justify-content: center;">
  <img src="./images/title-img.png" alt="DeepFish" style="width:300px;" />
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

<img src="./images/banner.png" alt="AI 命令行工具截图" style="width:100%;text-align:center;" />




- [English](README.md) | [中文](README_CN.md)

[TOC]


## 1. 介绍

一款高效便捷的AI驱动命令行工具，致力于打破自然语言与操作系统指令、文件操作指令之间的壁垒，让非专业开发者也能通过简单的自然语言描述，快速生成可直接执行的操作指令，大幅提升终端操作效率。
核心特性：

- 多模型兼容：无缝支持DeepSeek、Ollama，以及所有遵循OpenAI API规范的AI模型，可根据需求灵活切换，适配不同场景下的指令生成需求。

- 自然语言转指令：精准解析自然语言需求，自动转换为对应的操作系统命令（如Linux、Windows、macOS终端指令）和文件操作指令（如创建、删除、修改文件/目录），无需手动编写复杂命令。

- 高度可扩展：支持通过扩展机制拓展功能边界，除基础的终端、文件操作外，可轻松实现翻译、小说创作、文件格式转换、数据处理等复杂任务，满足多样化使用需求。

- AI自动生成扩展：无需手动开发复杂扩展工具，可通过AI直接生成自定义扩展，降低扩展开发门槛，让功能拓展更高效、更灵活。[扩展示例](https://github.com/qq306863030/deepfish-extensions)

适用于开发者、运维人员、日常终端使用者等各类人群，无论是快速执行终端操作、批量处理文件，还是通过扩展实现个性化需求，都能通过该工具简化操作流程，提升工作效率，让AI赋能每一次终端操作。

## 2. 安装

### 前置要求

- Node.js（v22.14.0或更高版本）
- npm或yarn

### 通过npm安装

```bash
npm install -g deepfish-ai
```

### 从源码安装

```bash
git clone https://github.com/qq306863030/deepfish.git
cd deepfish
npm install
npm link
```

## 3. 快速使用

```bash
ai config add # 输入名称, 然后选择deepseek，并输入你的deepseek api key
ai use 你输入的名称
ai ”帮我在当前目录写一篇关于未来科技的文章，用markdown格式输出“
```

## 4. 配置

### 初始设置

运行配置向导来设置您的AI服务：

```bash
ai config add
```

这将提示你配置以下内容：

- **AI服务类型**：选择DeepSeek、Ollama或OpenAI
- **API基础URL**：为每个服务提供默认URL
- **模型名称**：选择要使用的AI模型
- **API密钥**：DeepSeek和OpenAI需要
- **Temperature**：控制响应随机性（0-2）
- **Max Tokens**：最大响应长度
- **Streaming Output**：启用/禁用流式响应

### 配置命令

```bash
# 配置命令
ai config add # 添加新的AI配置
ai config ls # 列出所有AI配置
ai config use <name> # 设置指定的AI配置为当前配置
ai config del <name> # 删除指定的AI配置
ai config view [name] # 查看指定AI配置的详细信息
ai config edit # 编辑配置文件手动编辑配置文件
ai config reset # 重置配置
ai config clear # 删除配置文件

# 扩展命令
ai ext add <filename> # 添加扩展工具
ai ext del <filepath> # 通过文件路径移除扩展工具
ai ext del <index> # 通过索引移除扩展工具
ai ext ls # 列出所有扩展工具
```

### 配置文件结构

配置文件 (`~/.ai-cmd.config.js`) 具有以下结构：

```javascript
module.exports = {
  ai: [
    {
      name: "default", // AI配置名称
      type: "deepseek", // AI服务类型："ollama"、"deepseek"或"openai"
      baseUrl: "https://api.deepseek.com", // API基础URL
      model: "deepseek-reasoner", // AI模型名称
      apiKey: "", // API密钥（DeepSeek和OpenAI需要）
      temperature: 1, // 响应随机性（0-2）
      maxTokens: 8192, // 最大响应长度
      stream: true, // 启用/禁用流式输出
    }
  ],
  currentAi: "default", // 当前活动的AI配置名称
  maxIterations: -1, // 代理工作流的最大迭代次数，-1为不限制迭代次数
  maxMessagesLength: 50000, // 最大压缩长度
  maxMessagesCount: 40, // 最大压缩数量
  extensions: [], // 扩展文件路径列表
  isRecordHistory: false, // 是否创建工作流执行记录文件
  isLog: false // 是否创建工作流执行日志
};
```

## 5. 使用方法

### 交互模式

启动交互式会话（多轮对话）：

```bash
ai
```

或显式指定：

```bash
ai -i 或 ai -interactive
```

### 直接命令模式

执行单个命令：

```bash
ai "创建一个名为hello.txt的文件，内容为'Hello World'"
```

### 使用示例

**文件操作：**

```bash
ai "创建10个文本文档，分别输入100个随机文本"
ai "清空当前目录"
```

**代码生成：**

```bash
ai "创建一个带有/hello端点的简单Express服务器"
ai "创建一个基于浏览器的飞机大战游戏"
```

**系统命令：**

```bash
ai "列出当前目录中所有文件及其大小"
ai "检查当前目录的磁盘使用情况"
```

**扩展工具生成：**

```bash
ai "创建一个用于查询天气的扩展工具weather.js"
ai ext add weather.js
```

**媒体处理：**

```bash
ai "我的系统上安装了ffmpeg5，帮我将目录中的所有MP4文件转换为AVI格式"
```

**文件组织：**

```bash
ai "将model目录下的所有文件按月份分类到model2目录中，日期格式为YYYY-MM"
```

## 6. 扩展开发

扩展允许您添加AI可以在其工作流中使用的自定义函数, 对于复杂的流程也可以自行开发或尝试使用本程序生成扩展，然后将扩展注册到程序中，在使用命令行来完成任务。

### 创建扩展

1. 扩展应导出包含 `descriptions`（工具描述数组）和 `functions`（函数对象）的对象。
2. 提示：可以通过AI生成扩展，例如"ai "创建一个用于查询天气的扩展工具weather.js"
3. 可查看[示例扩展](https://github.com/qq306863030/deepfish-extensions)。

```javascript
// 示例扩展：天气扩展
const axios = require('axios');

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'getWeather',
      description: '获取城市的当前天气信息',
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
    // 实现天气API调用
    const response = await axios.get(`https://api.weatherapi.com/v1/current.json?key=YOUR_KEY&q=${city}`);
    return `${city}的天气：${response.data.current.temp_c}°C，${response.data.current.condition.text}`;
  }
};

module.exports = {
  descriptions,
  functions
};
```

#### 注册扩展

**方法1：使用命令行**

```bash
ai ext add <filename> # ai ext add weather.js
ai ext add . # 遍历当前目录，自动扫描并添加扩展
```

**方法2：手动配置**

1. ai config edit
2. 将其添加到您的配置中：

```javascript
module.exports = {
  // ... 其他配置
  extensions: [
    '/path/to/weather-extension.js'
  ],
};
```

**方法3：自动扫描**

程序启动时会自动扫描以下目录中以“deepfish-”开头的目录。
1.程序npm全局node_modules目录(扩展可通过"npm install -g deepfish-xxx" 安装)
2.当前工作目录中的node_modules目录
3.当前工作目录

## 7. 建议

### AI服务选择

**建议：使用在线AI服务（DeepSeek/OpenAI）以获得最佳效果**

虽然本地AI服务（如Ollama）提供隐私保护和离线能力，但它们可能存在以下限制：

- **响应准确性**：本地模型可能不如在线模型严谨和精确
- **代码质量**：生成的代码可能需要更多的人工审查和修正
- **复杂任务处理**：在多步骤或复杂操作上可能遇到困难
- **语言理解**：在线服务提供更好的语言模型

对于生产环境或复杂任务，我们建议使用DeepSeek或OpenAI服务，或Ollama中的云端服务，以获得更可靠和准确的结果。

## 8. 使用说明

### 使用相对路径

AI始终使用相对于当前工作目录的相对路径。

## 9. 故障排除

### 配置问题

如果遇到配置错误，请尝试重置：

```bash
ai config reset
```

### AI服务连接

- **Ollama**：确保Ollama在本地11434端口上运行
- **DeepSeek/OpenAI**：验证您的API密钥是否正确，并且您有足够的额度

### 扩展未加载

- 检查配置中的文件路径
- 确保文件导出正确的对象
- 验证文件没有语法错误

## 10. 贡献

欢迎贡献！请随时提交Pull Request。

## 11. 许可证

本项目采用MIT许可证 - 详见[LICENSE](LICENSE)文件。

## 12. 支持

如有问题和疑问，请在GitHub仓库上提交issue。
