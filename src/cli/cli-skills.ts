import type { Command } from 'commander';
import {
  handleSkillsLs,
  handleSkillsAdd,
  handleSkillsDel,
  // handleSkillsInstall,
  handleSkillsEnable,
  handleSkillsDisable,
  handleSkillsDir,
  handleSkillsGenerate,
} from './cli-core/skills';

export function registerSkillsCommands(program: Command) {
  const skills = program.command('skills');
  skills.command('ls').description('列出所有技能').action(handleSkillsLs);
  skills.command('add <name>').description('添加本地技能目录').action(handleSkillsAdd);
  skills.command('del <index>').description('按索引删除技能').action(handleSkillsDel);
  // skills.command('install <url>').description('从 ClawHub 安装技能').action(handleSkillsInstall);
  skills.command('enable <index>').description('按索引启用技能').action(handleSkillsEnable);
  skills.command('use <index>').description('按索引启用技能（同 enable）').action(handleSkillsEnable);
  skills.command('disable <index>').description('按索引禁用技能').action(handleSkillsDisable);
  skills.command('dir').description('打开技能目录').action(handleSkillsDir);
  skills.command('generate <target>').description('生成技能').action(handleSkillsGenerate);
}
