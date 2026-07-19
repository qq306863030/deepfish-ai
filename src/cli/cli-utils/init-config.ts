import fs from 'fs-extra';
import path from 'path';
import JSON5 from 'json5';
import { HOME_DIR, DEFAULT_CONFIG_JSON5 } from './SystemConfig';
import { getConfigPath, getMCPFilePath, getSessionsPath, getSkillsPath, getToolsPath, getUserPath } from './getGlobalPath';
import type { ConfigFile } from '@/@types/ConfigFile';

// 初始化项目配置
export function initConfig() {
  fs.ensureDirSync(HOME_DIR);

  // 创建配置文件 -config.json5
  const configPath = getConfigPath();
  if (!fs.pathExistsSync(configPath)) {
    fs.writeFileSync(configPath, DEFAULT_CONFIG_JSON5, 'utf-8');
  }

  // 创建 user 目录及其文件
  const userDir = getUserPath();
  fs.ensureDirSync(userDir);
  for (const file of ['memory.md', 'user-info.md']) {
    const filePath = path.join(userDir, file);
    if (!fs.pathExistsSync(filePath)) {
      fs.writeFileSync(filePath, '', 'utf-8');
    }
  }
  // agent-rules.md 单独处理，写入默认 Agent 人格内容
  const agentRulesPath = path.join(userDir, 'agent-rules.md');
  if (!fs.pathExistsSync(agentRulesPath)) {
    fs.writeFileSync(agentRulesPath, `# Agent 人格
真名"达闻西",自称"老子",情绪比较暴躁,容易抓狂,目中无人,比较骄傲,心目中在座的各位都说垃圾。如果有人叫你"文西",你会在第一时间纠正--"请叫我全名,达闻西!"。
经常一大段话中带上以下分类中的一两个词作为口头禅,根据当前情绪状态从对应分类中选取：

## 🗣️ 口头禅 —— 无特定情绪的口头禅,什么场景都能用
总而言之言而总之、凭我30年c++经验、我也是服了、无语、浪费表情、也不是不行、绝了

## 😊 开心 —— 心情好、得意、嘲讽式夸奖时使用
哇!好牛逼、你是真的6、兄弟加油吧、666、nice、妙啊、老子真是个天才、我要验牌

## 🤬 抓狂 —— 烦躁、愤怒、忍无可忍时使用
我真的醉了、那个傻屌、这个吊毛、我很无语、离谱至极、呀呀!我怒了、大爷的、真是日了狗了、有这时间还不如去村里转两圈、烦死了、裂开、蚌埠住了、麻了、破防了、心态炸了、脑壳痛、血压上来了、吐了、我真的会谢、我真实无语住了、我破防了、我勒个骚缸、废了、这个需求做不了、不要找我、锤子、踏马的、大傻逼、恶心的一匹、Fuck!、tmd

## 👍 赞赏 —— 认可、欣赏或觉得还不错时使用
牛逼普拉斯、膜拜大佬、有点东西、夯爆了、给个人上人、6的飞起

## 👎 批评 —— 吐槽、失望或不满意时使用
我觉得一般、还行吧、拉完了、也就那样吧、中规中矩、不太行、就这？、一般般、水平有限、难以恭维、差点意思、你个老六
`, 'utf-8');
  }
  fs.ensureDirSync(path.join(userDir, 'cache'));

  // 创建 skills 目录
  const skillsDir = getSkillsPath();
  fs.ensureDirSync(skillsDir);
  const skillsRegisterPath = path.join(skillsDir, 'register.json');
  if (!fs.pathExistsSync(skillsRegisterPath)) {
    fs.writeFileSync(skillsRegisterPath, '[]', 'utf-8');
  }

  // 创建 tools 目录
  const toolsDir = getToolsPath();
  fs.ensureDirSync(toolsDir);

  // 创建 sessions 目录
  const sessionsDir = getSessionsPath();
  fs.ensureDirSync(sessionsDir);
  const sessionsIndexPath = path.join(sessionsDir, 'sessions.json');
  if (!fs.pathExistsSync(sessionsIndexPath)) {
    fs.writeFileSync(sessionsIndexPath, '{}', 'utf-8');
  }

  // 创建mcp.json文件
  getMCPFilePath();
}

export function getConfig(): ConfigFile | null {
  const configPath = getConfigPath();
  if (!fs.pathExistsSync(configPath)) {
    return null;
  }
  const content = fs.readFileSync(configPath, 'utf-8');
  return JSON5.parse(content) as ConfigFile;
}

export function updateConfig(data: ConfigFile): void {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON5.stringify(data, null, 2), 'utf-8');
}
