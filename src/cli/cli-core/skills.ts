import { randomUUID } from 'crypto';
import inquirer from 'inquirer';
import { logError, logInfo, logSuccess, logWarning, logErrorMsg } from '../../utils/print';
import fs from 'fs-extra';
import path from 'path';
import { getHomePath, getScanSkillDirPaths, getWorkspacePath } from '../cli-utils/getGlobalPath';
import { openDirectory } from '@/utils/normal';
import { getConfig } from '../cli-utils/init-config';
import { initAgent, testServer } from '../cli-utils/init-agent';

export function handleSkillsLs() {
  const skills = _getAllSkills();
  logInfo('='.repeat(50));
  if (skills.length === 0) {
    logInfo('No skills registered yet');
  } else {
    skills.forEach((skill, index) => {
      if (skill.isEnabled) {
        logSuccess(`[${index}] ${skill.name} [√]`);
      } else {
        logInfo(`[${index}] ${skill.name} [×]`);
      }
    });
  }
  logInfo('='.repeat(50));
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
      type: 'select',
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

  const { action } = await inquirer.prompt([
    {
      type: 'select',
      name: 'action',
      message: 'Select add action:',
      choices: [
        { name: 'Move (cut)', value: 'move' },
        { name: 'Copy', value: 'copy' },
      ],
    },
  ]);

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

  // 移动或复制Skill目录到目标位置
  if (action === 'move') {
    fs.moveSync(skillDir, targetPath, { overwrite: true });
  } else {
    fs.copySync(skillDir, targetPath, { overwrite: true });
  }
  logSuccess(`Skill ${scope === 'local' ? 'locally' : 'globally'} ${action === 'move' ? 'moved' : 'copied'}: ${targetPath}`);

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
  const registerPath = _getRegisterPath(skillDir!);
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

function _toggleSkill(indexStr: string, enabled: boolean) {
  const skills = _getAllSkills();
  const indices = indexStr.split(',').map(s => s.trim()).filter(Boolean);
  let hasError = false;
  for (const part of indices) {
    const skillIndex = parseInt(part, 10);
    if (isNaN(skillIndex) || skillIndex < 0 || skillIndex >= skills.length) {
      logError(`Invalid skill index: ${part}`);
      hasError = true;
      continue;
    }
    const skill = skills[skillIndex];
    skill.isEnabled = enabled;
    const skillDir = skill.skillDir;
    const registerPath = _getRegisterPath(skillDir!);
    const scanDir = path.join(skillDir!, 'skills');
    const currentScanSkills = _getSkillList(scanDir);
    fs.writeJSONSync(
      registerPath,
      currentScanSkills.map(item => item.skillPath === skill.skillPath ? skill : item),
      { spaces: 2 },
    );
    const action = enabled ? 'enabled' : 'disabled';
    logSuccess(`Skill ${action}: ${skill.name}`);
  }
  return hasError;
}

export function handleSkillsEnable(...args: any[]) {
  // Commander variadic 可能传递数组或个人参数，flat 统一处理
  const indices = args.flat().filter((a): a is string => typeof a === 'string');
  if (indices.length === 0) return;
  _toggleSkill(indices.join(','), true);
}

export function handleSkillsDisable(...args: any[]) {
  const indices = args.flat().filter((a): a is string => typeof a === 'string');
  if (indices.length === 0) return;
  _toggleSkill(indices.join(','), false);
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
    const generateSkillPath = path.join(__dirname, './skills/generate-skill.md');
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
  const registerPath = _getRegisterPath(skillsDir);
  if (!fs.existsSync(skillsDir)) {
    return;
  }

  if (!fs.existsSync(registerPath)) {
    // 如果Skill目录存在但注册文件不存在，则确保目录存在并创建一个空的注册文件
    fs.ensureDirSync(path.dirname(registerPath));
    fs.writeJSONSync(registerPath, [], { spaces: 2 });
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
        skillPath: skillPath,
      });
    }
  });
  register = register.filter((item) => skills.includes(item.skillPath));
  register.push(...newRegister);
  fs.writeJSONSync(registerPath, register, { spaces: 2 });
}

// 获取已注册的Skill列表
export function getRegisteredSkills(): string[] {
  const scanPaths = getScanSkillDirPaths();
  const skills: string[] = [];
  scanPaths.forEach((scanPath) => {
    const scanDir = path.join(scanPath, 'skills')
    _updateRegister(scanDir);
    const registerPath = _getRegisterPath(scanDir);
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
  const registerPath = _getRegisterPath(skillsDir);
  if (fs.existsSync(registerPath)) {
    _updateRegister(skillsDir);
    const register = fs.readJSONSync(registerPath);
    allSkills = allSkills.concat(register);
  }
  return allSkills;
}

function _getAllSkills(): SkillRegisterItem[] {
  const scanPaths = getScanSkillDirPaths();
  let allSkills: SkillRegisterItem[] = [];
  scanPaths.forEach((scanPath) => {
    const scanDir = path.join(scanPath, 'skills')
    const skills = _getSkillList(scanDir);
    skills.map((item) => {
      item.skillDir = scanPath;
      return item;
    });
    allSkills = allSkills.concat(skills);
  });
  return allSkills;
}

function _getRegisterPath(skillsDir: string) {
  const normalizedDir = path.normalize(skillsDir);
  const baseName = path.basename(normalizedDir).toLowerCase();
  let resultPath = '';
  if (baseName === '@deepfish-ai' || baseName === 'skills') {
    resultPath = path.join(normalizedDir, 'register.json');
  } else {
    resultPath = path.join(normalizedDir, 'skills', 'register.json');
  }
  if (fs.existsSync(normalizedDir) && !fs.existsSync(resultPath)) {
    fs.ensureDirSync(path.dirname(resultPath));
    fs.writeJSONSync(resultPath, [], { spaces: 2 });
  }
  return resultPath;
}