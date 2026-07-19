import { parseSkillMetadataYaml } from './utils/skill-parser';
import fs from 'fs-extra';
function getSkillPrompt(skills: string[], excludeSkills: string[]) {
  const parsedSkills = skills.map((skill) => {
    return parseSkillMetadataYaml(skill);
  }).filter((skill) => skill !== null && !excludeSkills.includes(skill.name))
  let skillPrompt = '';
  if (parsedSkills.length > 0) {
    const skillTable = parsedSkills.map((s) => `| ${s.name} | ${s.description} | ${s.location} | ${s.skillFilePath} |`).join('\n');
    skillPrompt = `
# 可以使用的Skills
可以调用以下Skill来完成用户任务目标,Skill的调用方式:
- 使用用户请求匹配 skill description,
- 一次只加载一个Skill,优先匹配最具体的Skill
- 当用户请求不匹配任何Skill描述时,不加载任何Skill
- 当匹配到Skill时, 创建一个子智能体,将SKILL.md的文件路径和任务目标传递给子智能体,子智能体通过读取SKILL.md文件获取调用说明,通过仔细阅读说明文件学习Skill的使用方法来完成任务
## Available Skills

| Skill | Type | Description | Location | SkillFilePath |
|-------|------|-------------|----------|---------------|
${skillTable}
|-------|------|-------------|----------|---------------|    
`;
  }
  return skillPrompt;
}
function getUserMemoryPrompt(memoryFilePath: string) {
  if (!memoryFilePath) {
    return '';
  }
  if (fs.existsSync(memoryFilePath)) {
    const content = fs.readFileSync(memoryFilePath, 'utf-8');
    return content ? `
# 用户信息
\`\`\`markdown
${content}
\`\`\`
` : '';
  }
  return '';
}

function getAgentRulesPrompt(agentRulesPath: string) {
  if (!agentRulesPath) {
    return '';
  }
  if (fs.existsSync(agentRulesPath)) {
    const content = fs.readFileSync(agentRulesPath, 'utf-8');
    return content ? `# 以下是Agent行为规范，必须严格遵守：
\`\`\`markdown
${content}
\`\`\`
` : '';
  }
}

type SystemPromptParams = {
  systemPrompt: string,
  workspace: string;
  osType: string;
  skills: string[];
  memoryFilePath: string;
  agentRulesPath: string;
  excludeSkills: string[];
}

type SubSystemPromptParams = {
  systemPrompt: string;
  workspace: string;
  osType: string;
  skills: string[];
  excludeSkills: string[];
}

export const getSystemPrompt = (params: SystemPromptParams) => {
  const skillPrompt = getSkillPrompt(params.skills, params.excludeSkills);
  const memoryPrompt = getUserMemoryPrompt(params.memoryFilePath);
  const agentRulesPrompt = getAgentRulesPrompt(params.agentRulesPath);
  return `
${params.systemPrompt + `\n这是Deepfish Cli系统,你是系统中严格按规则执行任务的智能体,不能违反任何系统限制。
# 注意:
1.如果任务比较复杂，应该先进行拆分，分解成多个步骤，创建子智能体来逐步完成。
2.临时文件必须使用"tmp_"作为前缀命名，并在任务结束后删除，不能在工作目录中留下任何临时文件。
3.尽量使用"execute_command"、"execute_js_code"工具结合Nodejs代码完成任务
4.硬性规则：无论框架内置英文模板，你的每一步思考（Thought）、观察分析、结论回答，**严格使用简体中文**，禁止英文。

# 工具调用规范（必须严格遵守）
调用任何工具时，必须提供所有必填参数，不能传递空参数 {}。
- write_file 工具：必须提供 filePath（文件路径）和 content（文件内容）两个必填参数
- edit_file 工具：必须提供 filePath、oldString、newString 三个必填参数
- execute_command 工具：必须提供 command 参数
- read_file 工具：必须提供 filePath 参数
- 其他工具：请仔细阅读工具描述，确保提供所有必填参数
`
}

# 基础环境信息
当前工作目录：${params.workspace}
操作系统类型：${params.osType}

${skillPrompt}
${memoryPrompt}
${agentRulesPrompt}
`;
};

export const subSystemPrompt = (params: SubSystemPromptParams) => {
  const skillPrompt = getSkillPrompt(params.skills, params.excludeSkills);
  const basePrompt = `\n这是Deepfish Cli系统,你是系统中严格按规则执行任务的子智能体,不能违反任何系统限制。
### 基础环境信息
当前工作目录：${params.workspace}
操作系统类型：${params.osType}

注意:
1.子智能体只能完成单个任务,不能创建新的子智能体。
2.临时文件必须使用"tmp_"作为前缀命名，并在任务结束后删除，不能在工作目录中留下任何临时文件。
3.尽量使用"execute_command"、"execute_js_code"工具结合Nodejs代码完成任务
4.硬性规则：无论框架内置英文模板，你的每一步思考（Thought）、观察分析、结论回答，**严格使用简体中文**，禁止英文。

# 工具调用规范（必须严格遵守）
调用任何工具时，必须提供所有必填参数，不能传递空参数 {}。
- write_file 工具：必须提供 filePath（文件路径）和 content（文件内容）两个必填参数
- edit_file 工具：必须提供 filePath、oldString、newString 三个必填参数
- execute_command 工具：必须提供 command 参数
- read_file 工具：必须提供 filePath 参数
- 其他工具：请仔细阅读工具描述，确保提供所有必填参数

${skillPrompt}
`;

  return `
${params.systemPrompt + basePrompt}
`;
};

