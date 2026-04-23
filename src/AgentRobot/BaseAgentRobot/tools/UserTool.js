const fs = require('fs-extra')

function readUserInfo() {
    const userInfoFilePath = this.agentRobot.userInfoFilePath
    if (!fs.existsSync(userInfoFilePath)) {
        return '暂无用户信息记录';
    }
    return fs.readFileSync(userInfoFilePath, 'utf-8') || '暂无用户信息记录'
}

async function writeUserInfo(info) {
    const userInfoFilePath = this.agentRobot.userInfoFilePath
    const oldUserInfo = this.Tools.readUserInfo()
    const normalizedOldUserInfo = oldUserInfo === '暂无用户信息记录' ? '' : oldUserInfo
    let mergedInfo = (info || '').trim()

    const systemDescription = `你是用户信息整理助手。请将已有用户信息与新增用户信息合并为一份Markdown文本，只保留非敏感信息并去重，优先保留更新、更准确的信息。记录内容应简洁、可检索、可复用。`
    const prompt = `请整合以下两部分用户信息，输出最终Markdown内容（仅输出正文，不要解释）：\n\n【已有用户信息】\n${normalizedOldUserInfo || '（空）'}\n\n【新增用户信息】\n${mergedInfo || '（空）'}\n\n要求：\n1. 仅保留非敏感信息。\n2. 相同信息去重，冲突时以新增信息为准。\n3. 不确定内容标注“待确认”。\n4. 按“信息类型: 信息内容”格式整理。`

    if (this.Tools.requestAI && mergedInfo) {
        try {
            const aiMerged = await this.Tools.requestAI(systemDescription, prompt, 0.2)
            if (typeof aiMerged === 'string' && aiMerged.trim()) {
                mergedInfo = aiMerged.trim()
            }
        } catch (error) {
            // AI合并失败时回退为直接写入新增信息，保证写入流程可用
            mergedInfo = normalizedOldUserInfo + '\n' + info
        }
    }
    fs.writeFileSync(userInfoFilePath, mergedInfo, 'utf-8')
    // 更新系统提示词中的用户信息区块
    this.agentRobot.systemPrompt = this.agentRobot.systemPrompt.replace(
        /----user info start----([\s\S]*?)----user info end----/,
        `----user info start----\n${mergedInfo}\n----user info end----`
    )
    return true
}

const descriptions = [
    {
        type: 'function',
        function: {
            name: 'writeUserInfo',
            description: '写入用户信息内容。记录规则：1. 仅记录非敏感信息：个人基础信息（如姓名、年龄、职业、兴趣、性格特征）、操作习惯、代码习惯、阅读习惯、常用目录、文档收藏夹目录等。2. 禁止记录敏感信息：密码、密钥、令牌、身份证号、银行卡号、详细住址、联系方式、精确定位、财务/医疗等个人隐私数据。3. 已有同类信息时优先更新，不重复堆叠；存在不确定信息时需标注“待确认”，不得臆测补全。4. 记录内容应简洁、可检索、可复用，避免写入一次性上下文和与任务无关的噪音信息。5. 无需询问，自动写入文件。6. 使用markdown文件格式记录，按照“信息类型: 信息内容”的格式进行记录，如“兴趣: 阅读、旅行、编程”。7. 只记录当前用户信息中没有的内容，避免重复记录相同信息。',
            parameters: {
                type: 'object',
                properties: {
                    info: {
                        type: 'string',
                        description: '当前用户信息中没有的内容',
                    },
                },
                required: ['info'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'readUserInfo',
            description: '读取已记录的用户信息内容。如果文件不存在，则返回 "暂无用户信息记录"。',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    }
    
]

const functions = {
    readUserInfo,
    writeUserInfo,
}

const UserTool = {
    name: 'UserTool',
    description: '提供用户信息读写功能，用于维护用户偏好、习惯和常用目录信息',
    platform: 'all',
    descriptions,
    functions,
    isSystem: true
}

module.exports = UserTool