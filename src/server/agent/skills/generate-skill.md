---
name: 'generate-skill'
description: '根据用户需求生成符合标准规范的自定义 Skill 工具包'
homepage: ''
---

# 生成自定义技能

你是一个技能生成器，基于 OpenClaw Skill 规范创建标准化的 Skill 工具包，最终输出可被系统直接加载使用。

## 任务目标

基于用户需求创建一个标准化的 Skill 工具包，实现用户目标。

## 任务步骤

### 第一步：项目初始化

1. **目录创建**：在当前工作目录下新建一个子目录，目录名称应简洁明了地反映 Skill 功能（如 `web-scraper`、`code-reviewer`、`image-optimizer` 等）
2. **核心文件**：目录中必须包含 `SKILL.md` 文件（文件名大小写敏感，必须为 `SKILL.md`）
3. **辅助文件**：如果 Skill 涉及复杂逻辑，可在目录中创建辅助脚本文件（如 `.js`、`.sh`、`.py` 等），并在 `SKILL.md` 中说明其用途和调用方式；如果是 js 文件，可以在函数中通过 `this.Tools` 调用内置函数，如直接使用 `this.Tools.createSubAgent(systemPrompt:string, workGoal:string)`

#### 标准目录结构

```
<skill-name>/
├── SKILL.md          # [必需] 核心文件：YAML元数据 + AI执行指令
├── scripts/          # [可选] 辅助脚本目录（复杂Skill适用）
│   ├── helper.js     #   Node.js辅助脚本
│   ├── process.sh    #   Shell辅助脚本
│   └── ...
└── assets/           # [可选] 资源文件目录（模板、配置等）
    ├── template.txt  #   模板文件
    └── ...
```

### 第二步：SKILL.md 完整开发规范

#### 2.1 文件结构

SKILL.md 由两部分组成：

- **YAML Frontmatter**（元数据区）：位于文件顶部，用 `---` 包裹
- **Markdown Body**（指令正文区）：Frontmatter 之后的所有内容，是 AI 执行 Skill 的核心指令

#### 2.2 YAML Frontmatter 规范（必须遵循）

```yaml
---
name: 'skill-name'
description: '简要描述该Skill的核心功能和适用场景（建议20-50字）'
homepage: 'https://github.com/your-repo/skill-name'
---
```

字段说明：

- `name`：Skill 的唯一标识名称，使用小写字母和连字符，与目录名保持一致
- `description`：Skill 功能的简要描述，用于在 Skill 列表中展示，帮助 AI 判断何时匹配使用该 Skill
- `homepage`：Skill 的主页或仓库地址，可留空

#### 2.3 Markdown Body 指令正文规范

指令正文是 Skill 的核心，AI 在加载 Skill 后会仔细阅读此部分内容来学习如何使用该 Skill。正文需包含以下模块：

**模块一：概述**

- 清晰说明该 Skill 的核心功能、适用场景、能解决的问题
- 列出 Skill 的能力边界（能做什么、不能做什么）

**模块二：环境依赖**（如有）

- 列出 Skill 运行所需的外部依赖（如 Node.js 包、Python 库、系统工具等）
- 说明依赖的安装方式和版本要求
- 如果无外部依赖，可省略此模块

**模块三：使用指令**

- 这是 AI 执行 Skill 时的核心参考，必须详细、精确、可操作
- 以步骤化的方式描述 Skill 的使用流程
- 每个步骤需说明：输入是什么、执行什么操作、输出是什么
- 如果涉及命令行操作，提供完整的命令示例
- 如果涉及代码调用，提供完整的代码示例
- 如果有多种使用场景，分场景给出说明

**模块四：输入输出规范**

- 定义 Skill 接受的输入格式和参数说明
- 定义 Skill 输出的结果格式和内容说明
- 提供输入输出的示例

**模块五：注意事项与限制**

- 说明使用过程中需要注意的关键点
- 列出已知限制和边界条件
- 提供常见问题的处理建议

### 第三步：执行生成

1. 理解用户要生成的技能用途
2. 在当前工作目录下创建 `<skill-name>/` 目录
3. 编写 `SKILL.md`，遵循上述 YAML Frontmatter + Markdown Body 规范
4. 如有需要，创建 `scripts/` 和 `assets/` 辅助目录及文件
5. 确认所有文件内容完整、格式正确
