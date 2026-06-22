import { randomUUID } from 'crypto';
import inquirer from 'inquirer';
import { logError, logInfo, logSuccess, logWarning, logErrorMsg } from '../../utils/print';
import fs from 'fs-extra';
import path from 'path';
import { getHomePath, getScanDirPaths, getWorkspacePath } from '../cli-utils/getGlobalPath';
import { openDirectory } from '@/utils/normal';
import { getConfig } from '../cli-utils/init-config';
import { initAgent, testServer } from '../cli-utils/init-agent';

export function handleSkillsLs() {
  const skills = _getAllSkills();
  console.log('='.repeat(50));
  if (skills.length === 0) {
    logInfo('No skills registered yet');
  } else {
    skills.forEach((skill, index) => {
      console.log(`[${index}] ${skill.name} (${skill.isEnabled ? 'enabled' : 'disabled'})`);
    });
  }
  console.log('='.repeat(50));
}

export async function handleSkillsAdd(name: string) {
  logInfo(`Adding skill: ${name}`);
  const workspace = getWorkspacePath();
  const skillDir = path.join(workspace, name);
  if (!fs.existsSync(skillDir)) {
    logError(`Skill directory does not exist: ${skillDir}`);
    return;
  }

  // 询问用户将Skill添加在locally还是globally
  const { scope } = await inquirer.prompt([
    {
      type: 'list',
      name: 'scope',
      message: 'Select skill scope:',
      choices: [
        { name: 'Local (current workspace only)', value: 'local' },
        { name: 'Global (available to all workspaces)', value: 'global' },
      ],
    },
  ]);
  const homePath = getHomePath();
  const globalSkillDir = path.join(homePath, 'skills');
  const localSkillDir = path.join(workspace, '.deepfish-ai', 'skills');
  if (scope === 'local') {
    fs.ensureDirSync(localSkillDir);
  } else {
    fs.ensureDirSync(globalSkillDir);
  }

  const targetDir = scope === 'local' ? localSkillDir : globalSkillDir;
  const targetPath = path.join(targetDir, name);

  // 检查目标位置是否已存在同名Skill
  if (fs.existsSync(targetPath)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `A skill named "${name}" already exists at the target location. Overwrite?`,
        default: false,
      },
    ]);
    if (!overwrite) {
      logWarning('Add cancelled');
      return;
    }
    fs.removeSync(targetPath);
  }

  // 移动Skill目录到目标位置
  fs.moveSync(skillDir, targetPath, { overwrite: true });
  logSuccess(`Skill ${scope === 'local' ? 'locally' : 'globally'} added: ${targetPath}`);

  // 更新注册文件
  _updateRegister(targetDir);
}

export function handleSkillsDel(index: string) {
  // 获取所有Skill列表
  const skills = _getAllSkills();
  const skillIndex = parseInt(index, 10);
  if (isNaN(skillIndex) || skillIndex < 0 || skillIndex >= skills.length) {
    logError('Invalid skill index');
    return;
  }
  const skill = skills[skillIndex];
  // 删除Skill目录
  fs.removeSync(skill.skillPath);
  // 更新注册文件
  const skillDir = skill.skillDir;
  const registerPath = path.join(skillDir!, 'skills', 'register.json');
  if (fs.existsSync(registerPath)) {
    let register: SkillRegisterItem[] = fs.readJSONSync(registerPath);
    register = register.filter((item) => item.skillPath !== skill.skillPath);
    fs.writeJSONSync(registerPath, register, { spaces: 2 });
  }
  logSuccess(`Skill deleted: ${skill.name}`);
}

export function handleSkillsInstall(url: string) {
  logInfo(`Installing skill: ${url}`);
}

export function handleSkillsEnable(index: string) {
  const skills = _getAllSkills();
  const skillIndex = parseInt(index, 10);
  if (isNaN(skillIndex) || skillIndex < 0 || skillIndex >= skills.length) {
    logError('Invalid skill index');
    return;
  }
  const skill = skills[skillIndex];
  skill.isEnabled = true;
  const skillDir = skill.skillDir;
  const registerPath = path.join(skillDir!, 'skills', 'register.json');
  fs.writeJSONSync(
    registerPath,
    skills.filter((item) => item.skillDir === skillDir),
    { spaces: 2 },
  );
  logSuccess(`Skillenabled: ${skill.name}`);
}

export function handleSkillsDisable(index: string) {
  const skills = _getAllSkills();
  const skillIndex = parseInt(index, 10);
  if (isNaN(skillIndex) || skillIndex < 0 || skillIndex >= skills.length) {
    logError('Invalid skill index');
    return;
  }
  const skill = skills[skillIndex];
  skill.isEnabled = false;
  const skillDir = skill.skillDir;
  const registerPath = path.join(skillDir!, 'skills', 'register.json');
  fs.writeJSONSync(
    registerPath,
    skills.filter((item) => item.skillDir === skillDir),
    { spaces: 2 },
  );
  logSuccess(`Skilldisabled: ${skill.name}`);
}

export function handleSkillsDir() {
  logInfo('Opening skills directory');
  const homePath = getHomePath();
  const globalSkillDir = path.join(homePath, 'skills');
  openDirectory(globalSkillDir);
}

export async function handleSkillsGenerate(target: string) {
  if (!target.trim()) {
    logError('Please provide a skill description, e.g.: ai skills generate "a code review skill"');
    return;
  }

  const config = getConfig();
  if (!config) {
    logError('Config file not found, please run init first');
    return;
  }

  const currentModelName = config.currentModel;
  if (!currentModelName) {
    logError('No AI model configured, please run ai model use <name>');
    return;
  }

  try {
    const isServerRunning = await testServer();
    if (!isServerRunning) {
      logError('Failed to start service, please check config or port availability');
      return;
    }

    // 创建 agent，注入 generate-skill skill
    const generateSkillPath = path.join(__dirname, './generate-skill.md');
    const agent = await initAgent(config, [generateSkillPath]);

    const prompt = `请根据以下需求生成一个Skill模块：${target}

要求：
1. 在当前工作目录下（${getWorkspacePath()}）创建以Skill功能命名的子目录（如"code-reviewer"、"image-optimizer"等，简洁明了）
2. 按照 generate-skill 规范生成 SKILL.md（含YAML Frontmatter + Markdown Body）
3. SKILL.md 需包含：概述、环境依赖、使用指令、输入输出规范、注意事项与限制
4. 内容使用中文，结构清晰、步骤可执行`;

    await agent.execute(prompt);
    logSuccess(`Skill "${target}" generated successfully`);
    process.exit(0);
  } catch (error: any) {
    logErrorMsg(error as Error);
  }
}

// 扫描Skill目录
function _scanSkills(skillsDir: string) {
  const skills: string[] = [];
  // 扫描里面的目录（如果目录中包含SKILL.md文件则认为这是一个skill）
  if (fs.existsSync(skillsDir)) {
    const files = fs.readdirSync(skillsDir);
    files.forEach((file) => {
      const filePath = path.resolve(skillsDir, file);
      if (fs.statSync(filePath).isDirectory()) {
        const skillMdPath = path.resolve(filePath, 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
          skills.push(filePath);
        }
      }
    });
  }
  return skills;
}

type SkillRegisterItem = {
  id: string;
  name: string;
  isEnabled: boolean;
  skillPath: string;
  skillDir?: string;
};

function _updateRegister(skillsDir: string) {
  // 更新Skill注册文件
  const registerPath = path.resolve(skillsDir, 'register.json');
  if (fs.existsSync(skillsDir) && !fs.existsSync(registerPath)) {
    // 如果Skill目录存在但注册文件不存在，则创建一个空的注册文件
    fs.writeJSONSync(registerPath, [], { spaces: 2 });
  } else if (!fs.existsSync(skillsDir)) {
    return;
  }
  const skills = _scanSkills(skillsDir);
  // 读取已注册的Skill
  let register: SkillRegisterItem[] = fs.readJSONSync(registerPath);
  // 将已有的skills和注册文件进行对比，添加新的Skill，移除不存在的Skill
  const newRegister: SkillRegisterItem[] = [];
  skills.forEach((skillPath) => {
    const skillName = path.basename(skillPath);
    const existItem = register.find((item) => item.skillPath === skillPath);
    if (!existItem) {
      newRegister.push({
        id: randomUUID(),
        name: skillName,
        isEnabled: true,
        skillPath,
      });
    }
  });
  register = register.filter((item) => skills.includes(item.skillPath));
  register.push(...newRegister);
  fs.writeJSONSync(registerPath, register, { spaces: 2 });
}

// 获取已注册的Skill列表
export function getRegisteredSkills(): string[] {
  const scanPaths = getScanDirPaths();
  const skills: string[] = [];
  scanPaths.forEach((scanPath) => {
    _updateRegister(scanPath);
    const registerPath = path.join(scanPath, 'skills', 'register.json');
    if (fs.existsSync(registerPath)) {
      const register = fs.readJSONSync(registerPath);
      register.forEach((item: SkillRegisterItem) => {
        if (item.isEnabled) {
          skills.push(item.skillPath);
        }
      });
    }
  });
  return skills;
}

function _getSkillList(skillsDir: string): SkillRegisterItem[] {
  let allSkills: SkillRegisterItem[] = [];
  const registerPath = path.join(skillsDir, 'skills', 'register.json');
  if (fs.existsSync(registerPath)) {
    _updateRegister(skillsDir);
    const register = fs.readJSONSync(registerPath);
    allSkills = allSkills.concat(register);
  }
  return allSkills;
}

function _getAllSkills(): SkillRegisterItem[] {
  const scanPaths = getScanDirPaths();
  let allSkills: SkillRegisterItem[] = [];
  scanPaths.forEach((scanPath) => {
    const skills = _getSkillList(scanPath);
    skills.map((item) => {
      item.skillDir = scanPath;
      return item;
    });
    allSkills = allSkills.concat(skills);
  });
  return allSkills;
}
