/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-23 15:23:42
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-23 16:11:34
 * @FilePath: \deepfish\src\cli\SkillConfigManager.js
 * @Description: Skill configuration manager
 */
const path = require('path')
const { GlobalVariable } = require('../core/globalVariable')
const { logError } = require('../core/utils/log')

// skill的数据结构: {name: string, enable: boolean, description: string}
class SkillConfigManager {
  constructor() {
    this.configManager = GlobalVariable.configManager
    // skill目录
    this.skillDir = path.join(this.configManager.configDir, './skills')
  }
  init() {
    const userConfig = this.configManager.config
    if (!userConfig.skills) {
      userConfig.skills = []
      this.configManager.writeConfig(userConfig)
    }
  }

  // 查看skills列表
  viewList() {
    const skills = this.configManager.config.skills
    if (skills && Array.isArray(skills)) {
      console.log('='.repeat(50))
      // 打印扩展列表，并加上索引
      if (skills.length === 0) {
        console.log(`No skills in config.`)
      } else {
        console.log('Skills in config:')
        skills.forEach((skill, index) => {
          console.log(`[${index}] ${skill.name}`)
        })
      }
      console.log('='.repeat(50))
    } else {
      logError(`No skills in config.`)
    }
  }

  check() {
    // 如果数组的数量与目录中的数量不一致，则自动同步
  }

  // 添加skills
  add(skillName) {
    // 从当前目录process.pwd()查询是否存在同名的skill
    // 如果存在则判断是否是目录=>1.如果是目录则拷贝到skills目录下，并添加到config中 2.如果是zip文件则解压到skills目录下，并添加到config中
    // 如果不存在则提示从ClawHub中下载https://clawhub.ai/
  }

  install(skillUrl) {
    // 从ClawHub下载skill并解压到skills目录下，并添加到config中
  }

  // 删除skills
  remove(skillName) {}

  // 启用skill
  enable(skillName) {}

  // 禁用skill
  disable(skillName) {}
}

module.exports = SkillConfigManager
