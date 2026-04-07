import fs from 'fs-extra'
import path from 'path'
import { getPath, importModule } from './normal.js'

export class AttachmentToolType {
  static BASE_SKILL = 'BaseSkill' // 基础技能，提供技能定义的基本结构
  static CLAW_SKILL = 'ClawSkill' // 爪子技能，提供技能执行的基本结构
}

export default class AttachmentToolScanner {
  // 获取附加工具
  static getToolCollection(workspace) {
    // 从文件中加载附加技能
    // 1.搜索程序所在目录下的以deepfish-ai-开头的文件夹
    // 2.搜索程序所在目录下以@deepfish-ai开头的文件夹里的目录
    // 3.工作目录下node_modules目录下以deepfish-ai-开头的文件夹
    // 4.工作目录下node_modules目录下以@deepfish-ai开头的文件夹里的目录
    // 5.工作目录下以deepfish-ai-开头的文件夹
    // 6.工作目录下以@deepfish-ai开头的文件夹里的目录
    // 7.工作目录下的js文件

    /**
     * 附加工具结构：
     * name: 'BaseSkill',
     * description: '基础扩展模板，提供扩展的基本结构定义',
     * location: currentDir, // 扩展文件路径，默认为当前文件所在目录
     * platform: 'all', // 扩展支持的平台(process.platform)，all或空表示所有平台, win32表示仅支持 Windows, darwin表示仅支持MacOS, linux表示仅支持Linux
     * descriptions,
     * functions,
     */
    // 1. 子agent创建时，不能拥有其他附加能力
    // 2. 使用platform过滤
    const { fileDir } = getPath(import.meta.url)
    const dir1 = path.resolve(fileDir, '../../../../') // 程序所在目录
    const dir2 = path.resolve(workspace, './node_modules') // 工作目录下node_modules目录
    const dir3 = path.resolve(workspace, './') // 工作目录
    const result = []
    const searchDirs = [...new Set([dir1, dir2, dir3])]
    for (const dirPath of searchDirs) {
      if (!fs.existsSync(dirPath)) {
        continue
      }
      const fileNames = fs.readdirSync(dirPath)
      // 查询目录下是否有@deepfish-ai目录
      fileNames.forEach((dirName) => {
        if (dirName === '@deepfish-ai') {
          const deepFishPath = path.resolve(dirPath, '@deepfish-ai')
          const packageNames = fs.readdirSync(deepFishPath)
          packageNames.forEach((packageName) => {
            const mainFile = AttachmentToolScanner._scanDeepFishPackage(
              deepFishPath,
              packageName,
            )
            if (mainFile) {
              result.push(mainFile)
            }
          })
        } else if (
          dirName.startsWith('deepfish-') &&
          dirName !== 'deepfish-ai'
        ) {
          const mainFile = AttachmentToolScanner._scanDeepFishPackage(dirPath, dirName)
          if (mainFile) {
            result.push(mainFile)
          }
        }
      })
    }
    const fileNames = fs.readdirSync(dir3)
    fileNames.forEach((fileName) => {
      if (fileName.endsWith('.js') || fileName.endsWith('.mjs')) {
        const mainFile = AttachmentToolScanner._scanDeepFishJsFile(dir3, fileName)
        if (mainFile) {
          result.push(mainFile)
        }
      }
    })
    // 动态加载这些文件，获取工具对象
    const attachTools = []
    for (const filePath of result) {
      try {
        const tool = importModule(filePath)
        if (tool) {
          tool.type = AttachmentToolType.BASE_SKILL
          tool.location = tool.location || path.dirname(filePath)
          tool.filePath = tool.filePath || filePath 
          attachTools.push(tool)
        }
      } catch (error) {
        console.error(`加载附加工具失败: ${filePath}`, error)
      }
    }
    return attachTools
  }

  static getClawSkillCollection(basespace) {
    const skillFilePath = path.join(basespace, './clawSkills/clawSkills.json')
    if (!fs.pathExistsSync(skillFilePath)) {
      return []
    } else {
      const skillJson = fs.readJSONSync(skillFilePath)
      return (skillJson.skills || []).filter(skill => skill.enable).map((skill) => {
        return {
          ...skill,
          type: AttachmentToolType.CLAW_SKILL
        }
      })
    }
  }

  static getAttachToolPrompt(toolCollection, clawSkillCollection) {
    const table = ([].concat(toolCollection).concat(clawSkillCollection))
      .map(
        (s) =>
          `| ${s.name} | ${s.type} | ${s.description || s.extensionDescription} | ${s.location} | ${s.filePath || s.skillFilePath} |`,
      )
      .join('\n')
    if (!table) {
      return '### 暂无可用的Skills'
    }
    return `
### 可以使用的Skills
可以调用以下Skill来完成用户的请求，Skill的调用方式：
- 使用用户请求匹配 skill description，
- 一次只加载一个Skill，优先匹配最具体的Skill
- 当用户请求不匹配任何Skill描述时，不加载任何Skill
- 调用 createSubSkillAgent 函数创建子Agent来执行任务
## Available Skills

| Skill | Type | Description | Location | FilePath |
|-------|------|-------------|----------|----------|
${table}
|-------|------|-------------|----------|----------|
`
  }

  static getClawSkillPrompt(clawSkills) {
    const table = clawSkills
      .map(
        (s) =>
          `| ${s.name} | ${s.type} | ${s.description} | ${s.location} | ${s.skillFilePath} |`,
      )
      .join('\n')
    return `
    ### 可以使用的Skills
可以调用以下Skill来完成用户的请求，Skill的调用方式：
- 使用用户请求匹配 skill description，
- 一次只加载一个Skill，优先匹配最具体的Skill
- 当用户请求不匹配任何Skill描述时，不加载任何Skill
- 使用Skill前先使用readFile函数读取SKILL.md文件获取调用说明，通过仔细阅读说明文件学习Skill的使用方法，来完成任务 
## Available Skills

| Skill | Type | Description | Location | SkillFilePath |
|-------|------|-------------|----------|---------------|
${table}
|-------|------|-------------|----------|---------------|
`
  }

  // 扫描包
  static _scanDeepFishPackage(parentDir, packageName) {
    const dirPath = path.resolve(parentDir, packageName)
    const packageJsonPath = path.resolve(dirPath, 'package.json')
    if (fs.pathExistsSync(packageJsonPath)) {
      const packageJson = fs.readJsonSync(packageJsonPath)
      if (packageJson.main) {
        return AttachmentToolScanner._scanDeepFishJsFile(dirPath, packageJson.main)
      }
    }
    return null
  }
  // 扫描文件
  static _scanDeepFishJsFile(parentDir, fileName) {
    const filePath = path.resolve(parentDir, fileName)
    if (fs.pathExistsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      if (
        fileContent.includes('module.exports') &&
        fileContent.includes('descriptions') &&
        fileContent.includes('functions')
      ) {
        return filePath
      }
    }
    return null
  }
}
