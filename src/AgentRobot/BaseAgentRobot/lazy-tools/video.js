function videoReadme() {
  return `【VIDEO 工具使用说明】
1. 优先尝试使用 FFmpeg 命令行。
3. 在调用 FFmpeg 前，先检测系统是否已安装 FFmpeg：
   - 已安装：直接使用 FFmpeg 命令行继续处理。
   - 未安装：询问用户是否允许安装。
4. 若用户同意安装：引导完成安装后继续执行原任务。
5. 若用户拒绝安装：明确告知当前能力限制，并终止该操作。`
}

const descriptions = [
  {
    type: 'function',
    function: {
      name: 'videoReadme',
      description: '获取 VIDEO 工具集的使用说明, 在处理音频、视频文件前必须先查看本说明。',
      parameters: {},
    },
  },
]

const functions = {
    videoReadme,
}

const VideoTool = {
  name: 'VideoTool',
  description: '提供音频、视频处理能力说明',
  platform: 'all',
  descriptions,
  functions,
  isSystem: true
}

module.exports = VideoTool

