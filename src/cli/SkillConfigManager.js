/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-23 15:23:42
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-04-07 15:56:35
 * @FilePath: \deepfish\src\cli\SkillConfigManager.js
 * @Description: Skill configuration manager
 */
const path = require('path')
const fs = require('fs-extra')
const axios = require('axios')
const cheerio = require('cheerio')
const extract = require('extract-zip')
const { GlobalVariable } = require('./GlobalVariable.js')
const { parseSkillMetadataYaml } = require('./SkillParser.js')
const aiConsole = require('../AgentRobot/BaseAgentRobot/utils/aiConsole.js')
const { openDirectory } = require('../AgentRobot/BaseAgentRobot/utils/normal.js')

// skill的数据结构: {name: string, enable: boolean, description: string, baseDir: string, skillDirName: string, location: string, skillFilePath: string, homepage: string, metadata: object}
class SkillConfigManager {
  constructor() {
    this.configManager = GlobalVariable.configManager
    // skill目录
    this.skillDir = path.join(this.configManager.configDir, './clawSkills')
    this.skillFilePath = path.join( this.skillDir, './clawSkills.json')
    this.init()
    GlobalVariable.skillConfigManager = this
  }

  init() {
    // 自动创建skill目录
    fs.ensureDirSync(this.skillDir)
    // 判断是否存在clawSkills.json，如果不存在则创建
    if (!fs.existsSync(this.skillFilePath)) {
      fs.writeJsonSync(this.skillFilePath, { skills: [] }, { spaces: 2 })
    }
    this._check()
  }

  // 读取skill文件
  readSkills() {
    const skillsObj = fs.readJSONSync(this.skillFilePath, { throws: false }) || { skills: [] }
    return skillsObj.skills
  }

  // 写入skill文件
  writeSkills(skills) {
    fs.writeJSONSync(this.skillFilePath, { skills }, { spaces: 2 })
  }


  openDirectory() {
    // 打开目录
    openDirectory(this.skillDir)
  }

  // 预加载skills，拼接提示词
  preLoadSkills() {
    const skills = this.readSkills().filter((skill) => skill.enable)
    if (skills.length === 0) {
        return '### 暂无可以使用的Skill'
    }
    const table = skills
      .map((s) => `| ${s.name} | ${s.description} | ${s.location} | ${s.skillFilePath} |`)
      .join('\n')
    return (
`
### 可以使用的Skill
除了使用内置函数，还可以调用以下Skill来完成用户的请求，Skill的调用方式：当用户的请求匹配技能描述时，调用executeSkill函数加载对应Skill的SKILL.md说明文件，获取调用说明，通过仔细阅读说明文件学习Skill的使用方法，来完成任务。
## Available Skills

| Skill | Description | Location | SkillFilePath |
|-------|-------------|----------|---------------|
${table}

## Skills Policy
- 当用户请求匹配 skill description 时，调用 executeSkill 函数加载对应 SKILL.md
- 一次只加载一个Skill，优先匹配最具体的Skill
- 当用户请求不匹配任何Skill描述时，不加载任何Skill
- Skill即你可以使用的技能`
    )
  }

  // 调用skill，传入参数，返回结果
  loadSkill(skillFilePath) {
    // 读取skill的SKILL.md，获取调用说明
    if (!fs.existsSync(skillFilePath)) {
        aiConsole.logError(`Skill file "${skillFilePath}" does not exist.`)
        return null
    }
    return fs.readFileSync(skillFilePath, 'utf-8')
  }

  // 解析skill文件，写入到json中，获取名称、版本、作者、元数据、描述等信息
  _parseSkill(skillDirPath) {
    const skillMdPath = ['SKILL.md', 'skill.md']
      .map((name) => path.join(skillDirPath, name))
      .find((filePath) => fs.existsSync(filePath))
    if (!skillMdPath) {
      return {}
    }
    const parsed = parseSkillMetadataYaml(skillMdPath)
    return parsed
  }

  // 查看skills列表
  viewList() {
    const skills = this.readSkills()
    if (skills && Array.isArray(skills)) {
      console.log('='.repeat(50))
      // 打印扩展列表，并加上索引
      if (skills.length === 0) {
        console.log(`No skills in config.`)
      } else {
        console.log('Skills in config:')
        skills.forEach((skill, index) => {
          console.log(`[${index}] ${skill.name} (${skill.enable ? 'Enabled' : 'Disabled'})`)
        })
      }
      console.log('='.repeat(50))
    } else {
      aiConsole.logError(`No skills in config.`)
    }
  }
  _check() {
    // 如果数组的数量与目录中的数量不一致，则自动同步
    const skills = this.readSkills()
    const skillDirs = fs.readdirSync(this.skillDir).filter((file) => {
      return fs.statSync(path.join(this.skillDir, file)).isDirectory()
    })
    if (skills.length === skillDirs.length) {
      return
    }
    if (skills.length !== skillDirs.length) {
      // 查询未被注册的skill，自动注册
      skillDirs.forEach((skillDir) => {
        if (
          !skills.some(
            (skill) => skill.skillDirName === skillDir || skill.name === skillDir,
          )
        ) {
          this._registerSkill(skillDir, false)
        }
      })
      // 查询已注册但目录不存在的skill，自动从列表中删除
      skills.forEach((skill) => {
        if (!skillDirs.includes(skill.skillDirName)) {
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
      const baseDir = path.join(process.cwd(), file)
      if (fs.statSync(baseDir).isDirectory()) {
        // 如果是目录，则拷贝到skills目录下，并添加到config中
        fs.copySync(baseDir, path.join(this.skillDir, file))
        this._registerSkill(baseName)
      } else if (path.extname(file) === '.zip') {
        // 如果是zip文件，则解压到skills目录下，并添加到config中
        const extractPath = path.join(this.skillDir, baseName)
        await extract(baseDir, { dir: extractPath })
        this._registerSkill(baseName)
      } else {
        aiConsole.logError(`File "${file}" is not a directory or a zip file.`)
      }
    } else {
      aiConsole.logError(
        `No skill named "${skillName}" found in current directory. Please download it from ClawHub (https://clawhub.ai/) and place it in the current directory.`,
      )
    }
  }

  // install('https://clawhub.ai/TheSethRose/agent-browser')
  async install(skillUrl) {
    // 从ClawHub下载zip并解压到skills目录下，并添加到config中
    if (!skillUrl || typeof skillUrl !== 'string') {
      aiConsole.logError('Invalid skill URL. Please provide a valid ClawHub URL.')
      return
    }

    let parsedUrl
    try {
      parsedUrl = new URL(skillUrl)
    } catch (error) {
      aiConsole.logError('Invalid skill URL format.')
      return
    }

    const host = parsedUrl.hostname.toLowerCase()
    if (host !== 'clawhub.ai' && host !== 'www.clawhub.ai') {
      aiConsole.logError(
        'Only ClawHub URLs are supported, e.g. https://clawhub.ai/author/skill-name',
      )
      return
    }

    const segments = parsedUrl.pathname.split('/').filter(Boolean)
    if (segments.length < 2) {
      aiConsole.logError(
        'Invalid ClawHub URL. Expected format: https://clawhub.ai/<author>/<skill-name>',
      )
      return
    }

    const skillName = path.basename(segments[1], '.zip')
    const skills = this.readSkills()
    if (skills.some((skill) => skill.name === skillName)) {
      aiConsole.logError(`Skill with name "${skillName}" already exists in config.`)
      return
    }
    // 查看目录是否存在当前的skill
    const skillPath = path.join(this.skillDir, skillName)
    if (fs.existsSync(skillPath)) {
      aiConsole.logError(`Skill "${skillName}" already exists in the skills directory.`)
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
        aiConsole.logError(`No download link found for skill "${skillName}".`)
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
      aiConsole.logSuccess(`Skill "${skillName}" installed successfully!`)
    } catch (error) {
      aiConsole.logError(`Failed to install skill "${skillName}": ${error.message}`)
    } finally {
      fs.removeSync(zipFilePath)
    }
  }

  // 根据名称或索引 删除skills
  remove(skillName) {
    const skills = this.readSkills()
    const skillObj = this._getSkill(skills, skillName)
    if (!skillObj) {
      return
    }
    const { skill, index } = skillObj
    let skillPath = skill.location
    if (!skillPath) {
      skillPath = path.join(this.skillDir, skill.skillDirName)
    }
    skills.splice(index, 1)
    this.writeSkills(skills)
    if (fs.existsSync(skillPath)) {
      fs.removeSync(skillPath)
    }
    aiConsole.logSuccess(`Skill "${skill.name}" removed successfully!`)
  }

  // 根据名称或索引 启用skill-限制最大启用100个
  enable(skillName) {
    const skills = this.readSkills()
    const enabledCount = skills.filter((skill) => skill.enable).length
    if (enabledCount >= 100) {
      aiConsole.logError('Cannot enable more than 100 skills.')
      return
    }
    const skillObj = this._getSkill(skills, skillName)
    if (!skillObj) {
      return
    }
    const { skill } = skillObj
    skill.enable = true
    this.writeSkills(skills)
    aiConsole.logSuccess(`Skill "${skill.name}" enabled successfully!`)
  }

  // 根据名称或索引 禁用skill
  disable(skillName) {
    const skills = this.readSkills()
    const skillObj = this._getSkill(skills, skillName)
    if (!skillObj) {
      return
    }
    const { skill } = skillObj
    skill.enable = false
    this.writeSkills(skills)
    aiConsole.logSuccess(`Skill "${skill.name}" disabled successfully!`)
  }

  // 解析skill的描述文件，获取name、description
  _registerSkill(skillDirName, enable = true) {
    const skills = this.readSkills()
    // 同名检测
    if (skills.some((skill) => skill.name === skillDirName)) {
      throw new Error(
        `Skill with name "${skillDirName}" already exists in config.`,
      )
    }
    const skillDirPath = path.join(this.skillDir, skillDirName)
    // 获取name、description
    const skillInfo = this._parseSkill(skillDirPath)
    const name = skillInfo.name || skillDirName
    const description = skillInfo.description || ''
    skills.push({
      name,
      description,
      enable,
      baseDir: this.skillDir,
      skillDirName: skillDirName,
      ...skillInfo,
    })
    this.writeSkills(skills)
  }

  _getSkill(skills, skillName) {
    let index = parseInt(skillName, 10)
    let skill = null
    if (!isNaN(index)) {
      if (index < 0 || index >= skills.length) {
        aiConsole.logError(`Skill index "${index}" is out of range.`)
      } else {
        skill = skills[index]
      }
    } else {
      index = skills.findIndex((skill) => skill.name === skillName)
      if (index === -1) {
        aiConsole.logError(`Skill with name "${skillName}" not found in config.`)
        return
      }
      skill = skills[index]
    }
    return {
      skill,
      index,
    }
  }
}

module.exports = SkillConfigManager
