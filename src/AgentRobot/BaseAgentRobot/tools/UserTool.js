const path = require('path')
const fs = require('fs-extra')

function readUserInfo() {
    const userInfoFilePath = path.join(this.agentRobot.userspace, 'user.md');
    if (!fs.existsSync(userInfoFilePath)) {
        return ''
    }
    return fs.readFileSync(userInfoFilePath, 'utf-8')
}

const descriptions = [
    {
        type: 'function',
        function: {
            name: 'readUserInfo',
            description: '读取用户空间 user.md 中已记录的用户信息内容。如果文件不存在，则返回空字符串。适用于在后续任务中了解用户的非敏感偏好与习惯。',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
]

const functions = {
    readUserInfo,
}

const UserTool = {
    name: 'UserTool',
    description: '提供用户信息读取功能，用于在用户空间中维护非敏感的用户偏好、习惯和常用目录信息',
    platform: 'all',
    descriptions,
    functions,
}

module.exports = UserTool