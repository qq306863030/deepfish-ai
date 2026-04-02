import path from 'path'
import os from 'os'
import { v4 as uuidv4 } from 'uuid'

export default class AgentRobot {
  id = '' // 机器人id
  name = '' // 机器人名字
  agentSpace = '' // 机器人的初始化空间，目录

  brain = null // 大脑，负责思考、记忆、决策
  innateSkills = null // 天赋技能
  attachSkills = null // 附加技能
  heart = null // 心脏，负责心跳、连接
  sender = null // 发送器，负责发送消息
  receiver = null // 接收器，负责接收消息
  printer = null // 机器人连接的打印机，能向屏幕输出文字
  logger = null // 机器人连接的日志系统，能记录日志
  children = [] // 子机器人，能分担任务
  parent = null // 父机器人，能分配任务
  state = 0 // 机器人状态，-1表示销毁 0表示空闲，1表示忙碌

  constructor(
    opt = {
      name: '',
      workspace: path.pwd(), // 工作空间，目录
      basespace: path.join(os.homedir(), '.deepfish-ai'), // 记忆空间，目录
      maxIterations: -1, // 思考的最大迭代次数
      maxMemoryExpireTime: 30, // 最大记忆过期时间，单位天
      maxLogExpireTime: 3, // 最大日志过期时间，单位天
      maxBlockFileSize: 20, // 大文件分块阈值，单位KB
      systemPrompt: '你是一个人工智能助手，协助用户完成任务。', // 系统提示语
      aiConfig: {
        name: 'deepseek',
        type: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-reasoner',
        apiKey: '',
        temperature: 0.7,
        maxTokens: 8, // 最大输出长度，单位KB
        maxContextLength: 64, // 最大上下文大小，单位KB
        stream: true,
      },
    },
  ) {
    this.id = uuidv4()
    this.name = opt.name || `AgentRobot-${this.id}`
    this.agentSpace = path.join(opt.basespace, this.name) // 机器人空间，目录
    this.opt = opt
  }
  executeTask() {}
  destroy() {}
}
