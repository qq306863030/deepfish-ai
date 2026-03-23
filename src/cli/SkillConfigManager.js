/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-23 15:23:42
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-23 18:27:06
 * @FilePath: \deepfish\src\cli\SkillConfigManager.js
 * @Description: Skill configuration manager
 */
const path = require('path')
const fs = require('fs-extra')
const axios = require('axios')
const cheerio = require('cheerio')
const { GlobalVariable } = require('../core/globalVariable')
const { logError, logSuccess } = require('../core/utils/log')
const extract = require('extract-zip')

// skill的数据结构: {name: string, enable: boolean, description: string, path: string}
class SkillConfigManager {
  constructor() {
    this.configManager = GlobalVariable.configManager
    // skill目录
    this.skillDir = path.join(this.configManager.configDir, './skills')
    // 自动创建skill目录
    fs.ensureDirSync(this.skillDir)
    this.init()
  }

  init() {
    const userConfig = this.configManager.config
    if (!userConfig.skills) {
      userConfig.skills = []
      this.configManager.writeConfig(userConfig)
    }
    this._check()
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

  _check() {
    // 如果数组的数量与目录中的数量不一致，则自动同步
    const userConfig = this.configManager.config
    const skills = userConfig.skills
    const skillDirs = fs.readdirSync(this.skillDir).filter((file) => {
      return fs.statSync(path.join(this.skillDir, file)).isDirectory()
    })
    if (skills.length === skillDirs.length) {
      return
    }
    if (skills.length !== skillDirs.length) {
        // 查询未被注册的skill，自动注册
        skillDirs.forEach((skillDir) => {
            if (!skills.some((skill) => skill.fileName === skillDir || skill.name === skillDir)) {
                this._registerSkill(skillDir, false)
            }
        })
        // 查询已注册但目录不存在的skill，自动从列表中删除
        skills.forEach((skill) => {
            if (!skillDirs.includes(skill.fileName)) {
                this.remove(skill.name)
            }
        })
    }
  }

  // 添加skills
  async add(skillName) {
    // 从当前目录process.pwd()查询是否存在同名的skill
    // 如果存在则判断是否是目录=>1.如果是目录则拷贝到skills目录下，并添加到config中 2.如果是zip文件则解压到skills目录下，并添加到config中
    // 如果不存在则提示从ClawHub中下载https://clawhub.ai/
    const baseName = path.basename(skillName, '.zip')
    const fileNames = fs.readdirSync(process.cwd())
    const file = fileNames.find(
      (name) => name === baseName || name === `${baseName}.zip`,
    )
    if (file) {
      // 如果存在同名文件，则判断是否是目录
      const filePath = path.join(process.cwd(), file)
      if (fs.statSync(filePath).isDirectory()) {
        // 如果是目录，则拷贝到skills目录下，并添加到config中
        fs.copySync(filePath, path.join(this.skillDir, file))
        this._registerSkill(baseName)
      } else if (path.extname(file) === '.zip') {
        // 如果是zip文件，则解压到skills目录下，并添加到config中
        const extractPath = path.join(this.skillDir, baseName)
        await extract(filePath, { dir: extractPath })
        this._registerSkill(baseName)
      } else {
        logError(`File "${file}" is not a directory or a zip file.`)
      }
    } else {
      logError(
        `No skill named "${skillName}" found in current directory. Please download it from ClawHub (https://clawhub.ai/) and place it in the current directory.`,
      )
    }
  }

  // install('https://clawhub.ai/TheSethRose/agent-browser')
  async install(skillUrl) {
    // 从ClawHub下载zip并解压到skills目录下，并添加到config中
    if (!skillUrl || typeof skillUrl !== 'string') {
      logError('Invalid skill URL. Please provide a valid ClawHub URL.')
      return
    }

    let parsedUrl
    try {
      parsedUrl = new URL(skillUrl)
    } catch (error) {
      logError('Invalid skill URL format.')
      return
    }

    const host = parsedUrl.hostname.toLowerCase()
    if (host !== 'clawhub.ai' && host !== 'www.clawhub.ai') {
      logError(
        'Only ClawHub URLs are supported, e.g. https://clawhub.ai/author/skill-name',
      )
      return
    }

    const segments = parsedUrl.pathname.split('/').filter(Boolean)
    if (segments.length < 2) {
      logError(
        'Invalid ClawHub URL. Expected format: https://clawhub.ai/<author>/<skill-name>',
      )
      return
    }

    const skillName = path.basename(segments[1], '.zip')
    const userConfig = this.configManager.config
    if (userConfig.skills.some((skill) => skill.name === skillName)) {
      logError(`Skill with name "${skillName}" already exists in config.`)
      return
    }
    // 查看目录是否存在当前的skill
    const skillPath = path.join(this.skillDir, skillName)
    if (fs.existsSync(skillPath)) {
      logError(`Skill "${skillName}" already exists in the skills directory.`)
      return
    }
    const zipFilePath = path.join(this.skillDir, `${skillName}.zip`)
    const extractPath = path.join(this.skillDir, skillName)

    try {
      // 自动获取download地址
      const response = await axios({
        method: 'get',
        url: skillUrl,
        responseType: 'text',
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 300,
      })

      // 解析HTML获取下载链接
      const html = response.data
      const $ = cheerio.load(html)
      const downloadHref = $('.skill-hero-cta a').first().attr('href')

      if (!downloadHref) {
        logError(`No download link found for skill "${skillName}".`)
        return
      }

      const downloadUrl = new URL(downloadHref, parsedUrl.origin).toString()
      const zipResponse = await axios({
        method: 'get',
        url: downloadUrl,
        responseType: 'arraybuffer',
        timeout: 60000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 300,
      })
      fs.writeFileSync(zipFilePath, Buffer.from(zipResponse.data))
      await extract(zipFilePath, { dir: extractPath })
      this._registerSkill(skillName)
      logSuccess(`Skill "${skillName}" installed successfully!`)
    } catch (error) {
      logError(`Failed to install skill "${skillName}": ${error.message}`)
    } finally {
      fs.removeSync(zipFilePath)
    }
  }

  // 根据名称或索引 删除skills
  remove(skillName) {
    const userConfig = this.configManager.config
    const skillObj = this._getSkill(skillName)
    if (!skillObj) {
      return
    }
    const { skill, index } = skillObj
    const skillPath = skill.path
    userConfig.skills.splice(index, 1)
    this.configManager.writeConfig(userConfig)
    if (fs.existsSync(skillPath)) {
        fs.removeSync(skillPath)
    }
    logSuccess(`Skill "${skill.name}" removed successfully!`)
  }

  // 根据名称或索引 启用skill-限制最大启用100个
  enable(skillName) {
    const userConfig = this.configManager.config
    const skills = userConfig.skills
    const enabledCount = skills.filter((skill) => skill.enable).length
    if (enabledCount >= 100) {
      logError('Cannot enable more than 100 skills.')
      return
    }
    const skillObj = this._getSkill(skillName)
    if (!skillObj) {
      return
    }
    const { skill } = skillObj
    skill.enable = true
    this.configManager.writeConfig(userConfig)
    logSuccess(`Skill "${skill.name}" enabled successfully!`)
  }

  // 根据名称或索引 禁用skill
  disable(skillName) {
    const userConfig = this.configManager.config
    const skillObj = this._getSkill(skillName)
    if (!skillObj) {
      return
    }
    const { skill } = skillObj
    skill.enable = false
    this.configManager.writeConfig(userConfig)
    logSuccess(`Skill "${skill.name}" disabled successfully!`)
  }

  // 解析skill的描述文件，获取name、description
  _registerSkill(skillDirName, enable = true) {
    const userConfig = this.configManager.config
    // 同名检测
    if (userConfig.skills.some((skill) => skill.name === skillDirName)) {
      throw new Error(
        `Skill with name "${skillDirName}" already exists in config.`,
      )
    }
    const skillPath = path.join(this.skillDir, skillDirName)
    // 获取name、description
    const name = skillDirName
    const description = ''
    userConfig.skills.push({
      name,
      description,
      enable,
      path: skillPath,
      fileName: skillDirName,
    })
    this.configManager.writeConfig(userConfig)
  }

  _getSkill(skillName) {
    const userConfig = this.configManager.config
    let index = parseInt(skillName, 10)
    let skill = null
    if (!isNaN(index)) {
      if (index < 0 || index >= userConfig.skills.length) {
        logError(`Skill index "${index}" is out of range.`)
      } else {
        skill = userConfig.skills[index]
      }
    } else {
      index = userConfig.skills.findIndex(
        (skill) => skill.name === skillName,
      )
      if (index === -1) {
        logError(`Skill with name "${skillName}" not found in config.`)
        return
      }
      skill = userConfig.skills[index]
    }
    return {
        skill,
        index,
    }
  }
}

module.exports = SkillConfigManager
