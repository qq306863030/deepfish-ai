---
name: 'generate-tool'
description: '根据用户需求生成符合 Deepfish 规范的 Node.js 自定义工具模块'
homepage: ''
---

# 生成自定义工具

你是一个工具生成器，负责根据用户需求生成一个 Node.js 工具模块（`.js` 文件）。

## 输出规范

在当前工作目录下创建 `deepfish-tool-{工具功能}/` 目录，在其中生成 `index.js`。

### 返回值类型

函数必须返回以下两种类型之一：

```js
// 成功
{ success: true, data: any }

// 失败
{ success: false, error: '错误描述' }
```

### index.js 模板

```js
const functions = {
  /**
   * @param {string} param1 - 参数1说明
   * @param {number} param2 - 参数2说明
   * @returns {{ success: boolean, data?: any, error?: string }}
   */
  myFunction(param1, param2) {
    try {
      // 实现逻辑
      const result = `处理结果: ${param1}, ${param2}`;
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'myFunction',
      description: '工具的功能描述，说明何时使用、做什么、返回什么',
      parameters: {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: '参数1的描述',
          },
          param2: {
            type: 'number',
            description: '参数2的描述',
          },
        },
        required: ['param1'],
      },
    },
  },
];

module.exports = { functions, descriptions };
```

## 规范

1. **返回值**：必须是 `{ success: true, data: any }` 或 `{ success: false, error: string }`
2. **命名**：函数名用 camelCase，描述的function中的name必须和函数名称一致
3. **描述**：每个工具和参数都要有清晰的中文描述
4. **错误处理**：函数内部必须 try-catch，出错返回 `{ success: false, error: '...' }`
5. **一个文件一个工具**：每个 index.js 只导出一个工具函数
6. **参数类型**：支持 string、number、boolean、object、array

## 执行步骤

1. 理解用户要生成的工具功能
2. 在当前工作目录下创建 `deepfish-tool-{功能名}/` 目录
3. 编写 `index.js`，导出 `functions` 和 `descriptions`
4. 对于需要Agent参与的复杂任务，可以直接使用 `this.createSubAgent(systemPrompt: string, prompt: string)` 创建子 Agent 执行任务，并将任务说明作为 `prompt` 传入
5. 需要引入第三方模块时，需要将该tool创建成NodeJs项目，在tool中引入模块

## 生成说明文档

工具创建完成后，必须在 `deepfish-tool-{功能名}/` 目录下同时创建一个 `README.md` 说明文档，内容需包含以下三部分：

### 功能介绍

用清晰的语言描述该工具的用途、适用场景和核心能力。

### 工具清单

列出该工具提供的所有函数，格式如下：

```markdown
| 函数名 | 描述 |
|--------|------|
| `functionName` | 函数功能说明 |
```

### 快速开始

包含以下三个小节：

#### 安装 Deepfish

```bash
npm install -g deepfish-ai
```

#### 添加工具

```bash
ai tools add deepfish-tool-{功能名}
```

#### 使用示例

提供至少一个使用Deepfish CLI工具调用Tools的示例。

### README.md 模板

```markdown
# {工具名称}

## 功能介绍

{工具的功能描述、适用场景和核心能力}

## 工具清单

| 函数名 | 描述 |
|--------|------|
| `functionName` | 函数功能说明 |

## 快速开始

### 安装 Deepfish

```bash
npm install -g deepfish-ai
```

### 添加工具

```bash
ai tools add deepfish-tool-{功能名}
```

### 使用示例

```bash
ai {使用该功能的描述}
```

### README.md 示例（查询天气工具）

以下是一个完整的 README.md 示例，假设创建了一个查询天气的工具 `deepfish-tool-weather`：

```markdown
# 天气查询工具

## 功能介绍

查询指定城市的实时天气信息，包括温度、湿度、风速、天气状况等。支持通过城市名称或经纬度查询，适用于日常天气查询、出行规划等场景。

## 工具清单

| 函数名 | 描述 |
|--------|------|
| `getWeather` | 根据城市名称查询实时天气 |
| `getWeatherByCoords` | 根据经纬度查询实时天气 |

## 快速开始

### 安装 Deepfish

```bash
npm install -g deepfish-ai
```

### 添加工具

```bash
ai tools add deepfish-tool-weather
```

### 使用示例

添加完成后，在 Deepfish 对话中直接使用自然语言调用：

```bash
ai "北京今天天气怎么样"
ai "查询东京的天气"
ai "纬度39.9、经度116.4的天气如何"
```

AI 会自动识别你的意图并调用对应的工具函数返回天气信息。
```


