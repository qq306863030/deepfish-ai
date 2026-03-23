const ConfigManager = require('./ConfigManager');
const SkillConfigManager = require('./SkillConfigManager');

const configManager = new ConfigManager();
const skillConfigManager = new SkillConfigManager();
skillConfigManager.install('https://clawhub.ai/TheSethRose/agent-browser')