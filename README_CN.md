# AI 命令行工具

一个AI命令行工具，通过自然语言处理操作系统命令和操作文件，支持Ollama、DeepSeek、OpenAI。

## 语言

- [English](README.md) | [中文](README_CN.md)

## 截图

![AI 命令行工具截图](https://raw.githubusercontent.com/qq306863030/ai-cmd-tool/main/screenshot/2.png)

## 仓库

[GitHub: qq306863030/ai-cmd-tool](https://github.com/qq306863030/ai-cmd-tool)

## 安装

### 前置要求

- Node.js（v22.14.0或更高版本）
- npm或yarn

### 通过npm安装

```bash
npm install -g ai-cmd-tool
```

### 从源码安装

```bash
git clone https://github.com/qq306863030/ai-cmd-tool.git
cd ai-cmd-tool
npm install
npm link
```

## 配置

### 初始设置

运行配置向导来设置您的AI服务：

```bash
ai config add
```

这将提示你配置以下内容：

- **AI服务类型**：选择Ollama、DeepSeek或OpenAI
- **API基础URL**：为每个服务提供默认URL
- **模型名称**：选择要使用的AI模型
- **API密钥**：DeepSeek和OpenAI需要
- **Temperature**：控制响应随机性（0-2）
- **Max Tokens**：最大响应长度
- **Streaming Output**：启用/禁用流式响应

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
  maxIterations: 10, // 代理工作流的最大迭代次数
  extensions: [], // 扩展文件路径列表
  file: {
    encoding: "utf8", // 文件编码
  },
};
```

### 配置命令

添加新的AI配置：

```bash
ai config add
```

列出所有AI配置：

```bash
ai config ls
```

设置指定的AI配置为当前配置：

```bash
ai config use <name>
```

删除指定的AI配置：

```bash
ai config del <name>
```

查看指定AI配置的详细信息：

```bash
ai config view [name]
```

编辑配置文件：

```bash
ai config edit
```

重置配置：

```bash
ai config reset
```

清除配置：

```bash
ai config clear
```

## 使用方法

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

**媒体处理：**

```bash
ai "我的系统上安装了ffmpeg5，帮我将目录中的所有MP4文件转换为AVI格式"
```

**文件组织：**

```bash
ai "将model目录下的所有文件按月份分类到model2目录中，日期格式为YYYY-MM"
```

## 建议

### AI服务选择

**建议：使用在线AI服务（DeepSeek/OpenAI）以获得最佳效果**

虽然本地AI服务（如Ollama）提供隐私保护和离线能力，但它们可能存在以下限制：

- **响应准确性**：本地模型可能不如在线模型严谨和精确
- **代码质量**：生成的代码可能需要更多的人工审查和修正
- **复杂任务处理**：在多步骤或复杂操作上可能遇到困难
- **语言理解**：在线服务提供更好的语言模型

对于生产环境或复杂任务，我们建议使用DeepSeek或OpenAI服务，或Ollama中的云端服务，以获得更可靠和准确的结果。

## 扩展开发

扩展允许您添加AI可以在其工作流中使用的自定义函数。

### 创建扩展

扩展应导出包含 `toolDescriptions`（工具描述数组）和 `toolFunctions`（函数对象）的对象。

```javascript
// 示例扩展：天气扩展
const axios = require('axios');

const toolDescriptions = [
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

const toolFunctions = {
  async getWeather(city) {
    // 实现天气API调用
    const response = await axios.get(`https://api.weatherapi.com/v1/current.json?key=YOUR_KEY&q=${city}`);
    return `${city}的天气：${response.data.current.temp_c}°C，${response.data.current.condition.text}`;
  }
};

module.exports = {
  toolDescriptions,
  toolFunctions
};
```

#### 注册扩展

1. 将扩展保存到文件中（例如`weather-extension.js`）
2. 将其添加到您的配置中：

```javascript
module.exports = {
  // ... 其他配置
  extensions: [
    '/path/to/weather-extension.js'
  ],
};
```

## 高级用法

### 使用相对路径

AI始终使用相对于当前工作目录的相对路径。这确保了跨不同系统的可移植性。

## 故障排除

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

## 贡献

欢迎贡献！请随时提交Pull Request。

## 许可证

本项目采用MIT许可证 - 详见[LICENSE](LICENSE)文件。

## 支持

如有问题和疑问，请在GitHub仓库上提交issue。
