const path = require('path')

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'generateExtensionRule',
      description:
        '如果用户需要为本程序ai工作流生成一个或多个工具函数作为一个工作流执行过程中调用的扩展工具，则需要先调用此函数获取生成扩展文件的规则;示例：生成一个扩展工具: 能够产生一个随机数的函数;',
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
      name: 'generateSkillPackageRule',
      description:
        '如果用户需要生成一个兼容OpenClaw规范的Skill工具包，则先调用此函数获取生成Skill工具包的完整规则和提示词;示例：生成一个Skill工具包: 能够抓取网页内容并提取关键信息;',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string' },
        },
        required: ['goal'],
      },
    },
  },
]

// 生成一个扩展工具
async function generateExtensionRule(goal) {
  const packagePath = path.resolve(__dirname, '../../../index.js')
  const newGoal = `
### 任务目标
基于指定规则创建一个标准化的Node.js NPM项目，实现用户目标：${goal}，最终输出符合AI工作流调用规范的函数模块，并配套中英文说明文档。

### 第一步：项目初始化
1. 目录创建：新建目录，目录名称以"deepfish-"开头,如"deepfish-「项目功能名称」"，作为NPM项目根目录，并作为当前项目的名称
2. package.json配置：
   - name字段值：与项目名称一致，即"deepfish-「项目功能名称」"
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
   - 主测试文件：test.js

### 第二步：index.js 完整开发规范
#### 2.1 核心输出要求
文件需输出四个核心字段，且代码逻辑清晰、可运行：
- name：字符串类型，扩展的名称标识
- extensionDescription：字符串类型，扩展功能的简要描述，说明该扩展提供的核心能力
- descriptions：数组类型，每个元素为OpenAI可识别的函数描述对象
- functions：对象类型，key为函数名称，value为函数方法体

#### 2.2 开发强制规则
1. 参数一致性：functions中函数的入参，必须与descriptions中对应函数声明的parameters完全一致
2. 命名规范：
   - 函数名称前缀：「领域用途+分隔符」（如systemFileManagement_）
   - 函数描述开头：统一格式「领域用途+分隔符+功能描述」（如系统文件管理:重命名文件）
3. 内置工具函数调用：函数内部会自动注入所有内置工具函数，可以通过this.aiCli.Tools获取，示例：
   - this.aiCli.Tools.requestAI(systemDescription, prompt, temperature)
   - this.aiCli.Tools.readFile(filePath)
   - 其他文件处理类内置函数（运行时自动注入）
4. 函数数量：至少包含1个可被AI工作流调用的函数
5. 函数中的this.aiCli在运行时指向DeepFish AI的运行时环境，可以通过this.aiCli访问到AI配置、工具函数等资源
6. 尽量保持代码思路清晰，避免过度复杂的逻辑嵌套，必要时可以适当拆分函数、添加注释说明或拆分成多个文件
7. 需要创建的是DeepFish AI的扩展工具，并非创建Skill工具包，因此不需要编写SKILL.md文件
8. 对于大于5个的扩展功能，需要在functions中输出一个说明函数，只需返回一个markdown类型的英文字符串，专门用于解释当前扩展工具的使用方法、参数说明、示例等内容，函数名称为「extensionRule」，如「systemFileManagement_extensionRule」；函数描述需要强调调用该扩展模块前必须先阅读该规则文档。

#### 2.3 基础代码模板（必须遵循）
const descriptions = []
const functions = {}
module.exports = {
  name: '扩展名称',
  extensionDescription: '扩展功能的简要描述',
  descriptions,
  functions,
}

#### 2.4 参考示例（可参考格式，展示多文件拆分结构）

##### index.js（主文件）
const descriptions = require('./descriptions')
const functions = require('./functions')
module.exports = {
  name: 'systemFileManagement',
  extensionDescription: '提供文件管理相关功能，包括文件重命名、复制等操作',
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
    return this.aiCli.Tools.rename(oldPath, newPath)
  },
  systemFileManagement_copyFile: function(srcPath, destPath) {
    return this.aiCli.Tools.copyFile(srcPath, destPath)
  },
}
module.exports = functions

### 第三步：测试规则
1. 测试目标：至少覆盖扩展中的核心函数（建议覆盖每个对外函数），验证“正常输入可用、关键边界可处理、异常输入有明确反馈”。
2. 测试文件：统一在 test.js 编写可直接运行的测试脚本，结构清晰，包含“准备数据 → 执行函数 → 断言结果 → 输出结论”。
3. 测试文件：必须确保函数可正确使用 this.aiCli 上下文。
   - 环境创建方式：
     "const { AICLI } = require('${packagePath}')\nconst aiCli = new AICLI();"
   - 调用方式：为模块导出的functions绑定aiCli上下文，示例：functions.aiCli = aiCli;
4. 断言与输出规范：每个用例需打印“用例名称、输入、期望、实际、是否通过（PASS/FAIL）”；全部执行后输出汇总（总数、通过数、失败数）。
5. 失败处理：出现异常时不得静默吞错，需捕获并输出可定位信息（错误消息、对应用例、关键参数）。
6. 副作用控制：测试过程中创建的临时文件必须使用 tmp_test_ 前缀，并在测试结束后清理。
7. 执行方式：test.js 不需要导出模块，支持通过 node test.js 直接运行并看到结果。

### 第四步：README文档规范
#### 4.1 通用要求
- 两个文档需在标题下方包含「中英文切换标签」（如文档顶部标注「English | 中文」/「中文 | English」）
- 结构保持一致，仅语言不同，核心模块顺序不可调整
- 文件名称README_CN.md（中文）、README.md（英文）
- 链接使用相对路径，如[中文](./README_CN.md)

#### 4.2 核心模块
1. 总体功能描述：
   - 清晰说明当前NPM包的核心定位、整体功能价值、适用场景
   - 语言简洁易懂，无需技术细节，聚焦「做什么」而非「怎么做」
2. 快速开始：
   - 明确说明安装步骤：
     ① 全局安装deepfish-ai：npm install deepfish-ai -g
     ② 全局安装当前项目：npm install @deepfish-ai/项目功能名称 -g
     ③ 在命令行中输入：ai 「扩展的某一个功能」。如：添加了一个查询天气的扩展。则输入：ai 查询一下今天的天气
3. 函数列表及功能描述：
   - 列出当前项目中所有函数名称
   - 对应说明每个函数的核心功能
   - 无需编写各个函数的具体使用方法
  `
  return newGoal
}

// 生成一个Skill工具包
async function generateSkillPackageRule(goal) {
  const newGoal = `
### 任务目标
基于OpenClaw Skill规范创建一个标准化的Skill工具包，实现用户目标：${goal}，最终输出可被DeepFish AI直接加载使用。

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

#### 2.4 SKILL.md 参考示例
\`\`\`markdown
---
name: "file-translator"
description: "将指定文件翻译为目标语言，支持多种文件格式的智能翻译"
homepage: "https://github.com/example/file-translator"
---

# File Translator Skill

## 概述
本Skill提供文件翻译能力，能够将指定文件内容翻译为目标语言。支持 .txt、.md、.json 等文本格式文件。

### 能力范围
- ✅ 支持文本文件的全文翻译
- ✅ 支持保留原文件格式结构
- ✅ 支持中、英、日、韩等主流语言互译
- ❌ 不支持二进制文件（如图片、视频）
- ❌ 不支持超过100MB的大文件

## 使用指令

### 步骤1：读取源文件
通过 readFile 工具函数读取需要翻译的源文件内容。

### 步骤2：执行翻译
调用 requestAI 工具函数，将文件内容和目标语言作为参数，获取翻译结果。

提示词模板：
"请将以下内容翻译为{目标语言}，保持原有格式不变：\\n{文件内容}"

### 步骤3：写入结果
将翻译结果写入目标文件。目标文件命名规则：{原文件名}_{语言代码}.{扩展名}

## 输入输出
- 输入：源文件路径、目标语言
- 输出：翻译后的文件路径

## 注意事项
- 大文件需按分块规则处理，避免超出上下文长度限制
- 翻译完成后需校验文件完整性
\`\`\`

#### 2.5 开发强制规则
1. SKILL.md 的指令正文必须足够详细，使AI仅通过阅读该文件即可完全理解并执行Skill的所有功能
2. 避免使用模糊描述（如"适当处理"、"合理配置"），所有操作步骤必须明确、具体、可执行
3. 如果Skill依赖辅助脚本文件，必须在指令正文中说明文件路径和调用方式
4. Skill的指令中可以引导AI使用以下内置工具函数完成任务：
   - executeCommand(command)：执行系统命令
   - executeJSCode(code)：执行Node.js代码
   - requestAI(systemDescription, prompt, temperature)：调用AI进行文本处理
   - readFile(filePath)：读取文件内容
   - writeFile(filePath, content)：写入文件内容
   - 其他文件处理类内置函数（运行时自动注入）
5. description字段的描述至关重要，它决定了AI何时选择加载该Skill，必须准确反映Skill的核心能力
6. 需要创建的是Skill工具包，并非创建Extension扩展，因此核心文件是SKILL.md而非index.js
7. 工具包创建在当前工作目录下，完成后不需要自动安装到全局

### 第三步：辅助脚本文件规范（如需要）
1. 如果Skill的功能较复杂，无法仅通过纯文本指令描述完成，可以创建辅助脚本文件
2. 辅助脚本可以是任意可执行格式（.js、.sh、.py、.bat等），需确保与目标操作系统兼容
3. 脚本文件放置在Skill目录中，SKILL.md中通过相对路径引用
4. 脚本需要有良好的注释和错误处理
5. 如果脚本依赖第三方库，需要在SKILL.md的环境依赖模块中明确说明安装方式

### 第四步：README文档规范
#### 4.1 通用要求
- 两个文档需在标题下方包含「中英文切换标签」（如文档顶部标注「English | 中文」/「中文 | English」）
- 结构保持一致，仅语言不同，核心模块顺序不可调整
- 文件名称README_CN.md（中文）、README.md（英文）
- 链接使用相对路径，如[中文](./README_CN.md)

#### 4.2 核心模块
1. 总体功能描述：
   - 清晰说明当前Skill工具包的核心定位、整体功能价值、适用场景
   - 语言简洁易懂，无需技术细节，聚焦「做什么」而非「怎么做」
2. 快速开始：
   - 明确说明安装步骤，顺序不可颠倒：
     ① 先安装deepfish-ai全局库：npm install deepfish-ai -g
     ② 将Skill目录拷贝到当前工作目录，执行：ai skill add <skill-name>
     ③ 启用Skill：ai skill enable <skill-name>
   - 也可以从ClawHub安装（如已发布）：ai skill install <clawhub-url>
3. Skill能力说明：
   - 列出该Skill提供的所有能力
   - 对应说明每项能力的使用场景和效果
4. 使用示例：
   - 提供2-3个典型的使用场景示例
   - 说明用户输入和预期输出
  `
  return newGoal
}

const functions = {
  generateExtensionRule,
  generateSkillPackageRule,
}

module.exports = {
  name: 'GenerateExtension',
  extensionDescription: '提供扩展工具与Skill工具包生成规则能力，用于辅助AI构建标准化扩展项目模板',
  descriptions,
  functions,
}