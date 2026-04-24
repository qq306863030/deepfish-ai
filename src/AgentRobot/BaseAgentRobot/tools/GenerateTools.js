const descriptions = [
  {
    type: 'function',
    function: {
      name: 'getGenerateSkillRules',
      description:
        '根据用户目标生成扩展工具的完整开发规则与提示词，返回可直接执行的规则文本。注意是扩展工具，并非ClawSkill工具包。',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string' },
        },
        required: ['goal'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generateSkill',
      description:
        '基于已准备好的扩展工具规则文本执行任务清单，自动生成扩展工具项目文件。调用前应先通过 getGenerateSkillRules 获取规则。',
      parameters: {
        type: 'object',
        properties: {
          rules: { type: 'string' },
        },
        required: ['rules'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getGenerateClawSkillRules',
      description:
        '根据用户目标生成兼容 OpenClaw 规范的 Skill 工具包开发规则与提示词，返回可直接执行的规则文本。注意是ClawSkill工具包，与扩展工具不同。',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string' },
        },
        required: ['goal'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generateClawSkill',
      description:
        '基于已准备好的 OpenClaw Skill 规则文本执行任务清单，自动生成 Skill 工具包文件。调用前应先通过 getGenerateClawSkillRules 获取规则。',
      parameters: {
        type: 'object',
        properties: {
          rules: { type: 'string' },
        },
        required: ['rules'],
      },
    },
  },
]

async function getGenerateSkillRules(goal) {
  const newGoal = `
## 任务目标
基于指定规则创建一个标准化的Node.js NPM项目，实现用户目标：${goal}，最终输出符合AI工作流调用规范的函数模块，并配套中英文说明文档。

## 任务步骤

### 第一步：项目初始化
1. 目录创建：新建目录，目录名称以"deepfish-ai-"开头,如"deepfish-ai-「项目功能名称」"，作为NPM项目根目录，并作为当前项目的名称
2. package.json配置：
   - name字段值：与项目名称一致，即"deepfish-ai-「项目功能名称」"
   - version字段值：初始版本设置为1.0.0
   - description字段值：用专业英文简要描述该项目的核心功能和价值, 以"A DeepFish AI extension tool for"开头
   - git仓库地址：固定为 https://github.com/qq306863030/deepfish-extensions.git
   - author设置为"DeepFish AI"
   - type字段设置为"commonjs"，确保模块系统兼容
3. 文件结构
   - 主文件：项目入口文件必须命名为index.js
   - 子文件：复杂的逻辑可以拆分到其他.js文件中;将descriptions、functions拆分到子文件;
   - 文档文件：项目根目录需新增2个文档文件：
    - README_CN.md（中文说明文档）
    - README.md（英文说明文档）

### 第二步：核心代码开发
#### 2.1 核心输出要求
文件需输出四个核心字段，且代码逻辑清晰、可运行：
- name：字符串类型，扩展的名称标识
- description：字符串类型，扩展功能的简要描述，说明该扩展提供的核心能力
- descriptions：数组类型，每个元素为OpenAI可识别的函数描述对象
- platform：字符串类型，扩展支持的平台(process.platform)，all或空表示所有平台, win32表示仅支持Windows, darwin表示仅支持MacOS, linux表示仅支持Linux:
- functions：对象类型，key为函数名称，value为函数方法体

#### 2.2 开发强制规则
1. 参数一致性：functions中函数的入参，必须与descriptions中对应函数声明的parameters完全一致
2. 命名规范：
   - 函数名称前缀：「领域用途+分隔符」（如systemFileManagement_）
   - 函数描述开头：统一格式「领域用途+分隔符+功能描述」（如系统文件管理:重命名文件）
3. 内置工具函数调用：函数内可以使用内置工具函数requestAI来获取AI请求结果，在环境中通过this.Tools注入，必要时也可以使用其他函数，示例：
   - this.Tools.requestAI(systemDescription, prompt, temperature)
   - this.Tools.executeCommand(command)
4. 函数数量：至少包含1个可被AI工作流调用的函数
5. 拆分成多个文件,保持文件结构清晰
6. 对于大于5个的扩展功能，需要在functions中输出一个说明函数，只需返回一个markdown类型的英文字符串，专门用于解释当前扩展工具的使用方法、参数说明、示例等内容，函数名称为「readme」，如「systemFileManagement_readme」；函数描述需要强调调用该扩展模块前必须先阅读该规则文档。
7. 仅进行简单逻辑性检查，不需要测试。

#### 2.3 基础代码模板（必须遵循）
const descriptions = []
const functions = {}
module.exports = {
  name: '扩展名称',
  description: '扩展功能的简要描述',
  platform: "all",
  descriptions,
  functions,
}

#### 2.4 参考示例（可参考格式，展示多文件拆分结构）

##### index.js（主文件）
const descriptions = require('./descriptions')
const functions = require('./functions')
module.exports = {
  name: 'systemFileManagement',
  description: '提供文件管理相关功能，包括文件重命名、复制等操作',
  platform: "all",
  descriptions,
  functions,
}

##### descriptions.js（描述子文件）
const descriptions = [
  {
    name: 'systemFileManagement_renameFile',
    description: '系统文件管理:重命名文件',
    parameters: {
      type: 'object',
      properties: {
        oldPath: { type: 'string', description: '旧文件路径' },
        newPath: { type: 'string', description: '新文件路径' },
      },
    },
  },
  {
    name: 'systemFileManagement_copyFile',
    description: '系统文件管理:复制文件',
    parameters: {
      type: 'object',
      properties: {
        srcPath: { type: 'string', description: '源文件路径' },
        destPath: { type: 'string', description: '目标文件路径' },
      },
    },
  },
]
module.exports = descriptions

##### functions.js（函数子文件）
const functions = {
  systemFileManagement_renameFile: function(oldPath, newPath) {
    try {
      const fullOldPath = path.resolve(process.cwd(), oldPath)
      const fullNewPath = path.resolve(process.cwd(), newPath)
  
      if (fs.existsSync(fullOldPath)) {
        fs.renameSync(fullOldPath, fullNewPath)
      }
      return true
    } catch (error) {
      return false
    }
  },
  systemFileManagement_copyFile: function(srcPath, destPath) {
    try {
        const fullSourcePath = path.resolve(process.cwd(), srcPath)
        const fullDestPath = path.resolve(process.cwd(), destPath)
        const destDirPath = path.dirname(fullDestPath)
    
        fs.ensureDirSync(destDirPath)
    
        if (fs.existsSync(fullSourcePath)) {
          fs.copyFileSync(fullSourcePath, fullDestPath)
        } else {
          return 'Source file does not exist'
        }
        return true
      } catch (error) {
        return false
      }
  }
}
module.exports = functions

### 第三步：输出README文档
#### 3.1 通用要求
- 两个文档需在标题下方包含「中英文切换标签」（如文档顶部标注「English | 中文」/「中文 | English」）
- 结构保持一致，仅语言不同，核心模块顺序不可调整
- 文件名称README_CN.md（中文）、README.md（英文）
- 链接使用相对路径，如[中文](./README_CN.md)

#### 3.2 核心模块
1. 总体功能描述：
   - 清晰说明当前NPM包的核心定位、整体功能价值、适用场景
   - 语言简洁易懂，无需技术细节，聚焦「做什么」而非「怎么做」
2. 快速开始：
   - 明确说明安装步骤：
     ① 全局安装deepfish-ai：npm install deepfish-ai -g
     ② 全局安装当前项目：npm install deepfish-ai-「项目功能名称」 -g
     ③ 在命令行中输入：ai 「扩展的某一个功能」。如：添加了一个查询天气的扩展。则输入：ai 查询一下今天的天气
3. 函数列表及功能描述：
   - 列出当前项目中所有函数名称
   - 对应说明每个函数的核心功能
   - 无需编写各个函数的具体使用方法
  `
  return newGoal
}

// 生成一个Skill工具包
async function generateSkill(rules) {
  await this.Tools.createTaskList(rules)
  return this.Tools.executeTaskList(rules)
}

async function getGenerateClawSkillRules(goal) {
   const newGoal = `
## 任务目标
基于OpenClaw Skill规范创建一个标准化的Skill工具包，实现用户目标：${goal}，最终输出可被你直接加载使用。

## 任务步骤

### 第一步：项目初始化
1. 目录创建：在当前工作目录下新建一个子目录，目录名称应简洁明了地反映Skill功能（如"web-scraper"、"code-reviewer"、"image-optimizer"等）
2. 核心文件：目录中必须包含 SKILL.md 文件（文件名大小写敏感，必须为 SKILL.md）
3. 文档文件：目录中需新增2个说明文档：
   - README_CN.md（中文说明文档）
   - README.md（英文说明文档）
4. 辅助文件：如果Skill涉及复杂逻辑，可在目录中创建辅助脚本文件（如 .js、.sh、.py 等），并在 SKILL.md 中说明其用途和调用方式

#### 标准目录结构
\`\`\`
<skill-name>/
├── SKILL.md          # [必需] 核心文件：YAML元数据 + AI执行指令
├── README.md         # [必需] 英文说明文档
├── README_CN.md      # [必需] 中文说明文档
├── scripts/          # [可选] 辅助脚本目录（复杂Skill适用）
│   ├── helper.js     #   Node.js辅助脚本
│   ├── process.sh    #   Shell辅助脚本
│   └── ...
└── assets/           # [可选] 资源文件目录（模板、配置等）
    ├── template.txt  #   模板文件
    └── ...
\`\`\`

### 第二步：SKILL.md 完整开发规范
#### 2.1 文件结构
SKILL.md 由两部分组成：
- **YAML Frontmatter**（元数据区）：位于文件顶部，用 \`---\` 包裹
- **Markdown Body**（指令正文区）：Frontmatter之后的所有内容，是AI执行Skill的核心指令

#### 2.2 YAML Frontmatter 规范（必须遵循）
\`\`\`yaml
---
name: "skill-name"
description: "简要描述该Skill的核心功能和适用场景（建议20-50字）"
homepage: "https://github.com/your-repo/skill-name"
---
\`\`\`

字段说明：
- name：Skill的唯一标识名称，使用小写字母和连字符，与目录名保持一致
- description：Skill功能的简要描述，用于在Skill列表中展示，帮助AI判断何时匹配使用该Skill
- homepage：Skill的主页或仓库地址，可留空

#### 2.3 Markdown Body 指令正文规范
指令正文是Skill的核心，AI在加载Skill后会仔细阅读此部分内容来学习如何使用该Skill。正文需包含以下模块：

**模块一：概述**
- 清晰说明该Skill的核心功能、适用场景、能解决的问题
- 列出Skill的能力边界（能做什么、不能做什么）

**模块二：环境依赖（如有）**
- 列出Skill运行所需的外部依赖（如Node.js包、Python库、系统工具等）
- 说明依赖的安装方式和版本要求
- 如果无外部依赖，可省略此模块

**模块三：使用指令**
- 这是AI执行Skill时的核心参考，必须详细、精确、可操作
- 以步骤化的方式描述Skill的使用流程
- 每个步骤需说明：输入是什么、执行什么操作、输出是什么
- 如果涉及命令行操作，提供完整的命令示例
- 如果涉及代码调用，提供完整的代码示例
- 如果有多种使用场景，分场景给出说明

**模块四：输入输出规范**
- 定义Skill接受的输入格式和参数说明
- 定义Skill输出的结果格式和内容说明
- 提供输入输出的示例

**模块五：注意事项与限制**
- 说明使用过程中需要注意的关键点
- 列出已知限制和边界条件
- 提供常见问题的处理建议

### 第三步：输出README文档
#### 3.1 通用要求
- 两个文档需在标题下方包含「中英文切换标签」（如文档顶部标注「English | 中文」/「中文 | English」）
- 结构保持一致，仅语言不同，核心模块顺序不可调整
- 文件名称README_CN.md（中文）、README.md（英文）
- 链接使用相对路径，如[中文](./README_CN.md)

#### 3.2 核心模块
1. 总体功能描述：
   - 清晰说明当前SKILL包的核心定位、整体功能价值、适用场景
   - 语言简洁易懂，无需技术细节，聚焦「做什么」而非「怎么做」
2. 快速开始：
   - 明确说明安装步骤：
     ① 全局安装deepfish-ai：npm install deepfish-ai -g
     ② 全局安装当前项目：ai skill add <skill-name>;ai skill ls;ai skill enable <skill-name|skill-index>
     ③ 在命令行中输入：ai 「skill功能」。如：添加了一个查询天气的扩展。则输入：ai 查询一下今天的天气
  `
  return newGoal
}
// 生成一个Skill工具包
async function generateClawSkill(rules) {
  await this.Tools.createTaskList(rules)
  return this.Tools.executeTaskList(rules)
}

const functions = {
  getGenerateClawSkillRules,
  getGenerateSkillRules,
  generateClawSkill,
  generateSkill,
}

const GenerateTools = {
  name: 'GenerateTools',
  description: '提供扩展工具与Skill工具包生成规则能力，用于辅助AI构建标准化扩展项目模板',
  descriptions,
  functions,
  isSystem: true
}

module.exports = GenerateTools