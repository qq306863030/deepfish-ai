/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-17 09:12:22
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-26 11:40:54
 * @FilePath: \deepfish\src\core\ai-services\AiWorker\AiTools.js
 * @Description: 对话初始化、对话请求
 * @
 */
const { OpenAI } = require('openai')
const { AiAgentSystemPrompt, SkillAiAgentSystemPrompt, TestAiAgentSystemPrompt, TaskAiAgentSystemPrompt } = require('./AiPrompt')
const { streamOutput, streamLineBreak, logError } = require('../../utils/log')
const { GlobalVariable } = require('../../globalVariable')

// 创建client
function createOpenAiClient(aiConfig) {
  return new OpenAI({
    baseURL: aiConfig.baseUrl,
    apiKey: aiConfig.apiKey || '',
  })
}

// 获取初始的message
function getInitialMessages(goal) {
  // 合并系统描述
  return [
    {
      role: 'system',
      content: getSystemPrompt(),
    },
    {
      role: 'user',
      content: goal,
    },
  ]
}

function getSystemPrompt() {
  const config = GlobalVariable.aiCli.config
  const skillPrompt = GlobalVariable.skillConfigManager.preLoadSkills()
  const systemDescription = `${AiAgentSystemPrompt.replace('20KB', `${config.maxBlockFileSize}KB`)}\n\n${skillPrompt}`
  return systemDescription
}

// 获取调用skill的初始message
function getInitialMessagesForSkill(skillContent, goal) {
  const config = GlobalVariable.aiCli.config
  const systemDescription = `
${SkillAiAgentSystemPrompt.replace('20KB', `${config.maxBlockFileSize}KB`)}
### 以下是加载完成的Skill.md文件的内容：
${skillContent}`
  return [
    {
      role: 'system',
      content: systemDescription,
    },
    {
      role: 'user',
      content: goal,
    },
  ]
}

function getInitialMessagesForTest(goal) {
  return [
    {
      role: 'system',
      content: TestAiAgentSystemPrompt.replace('20KB', `${GlobalVariable.aiCli.config.maxBlockFileSize}KB`),
    },
    {
      role: 'user',
      content: goal,
    },
  ]
}

// 获取子任务初始化message
async function getInitialMessagesForTask(mainMessages, goal) {
  // 对主任务的上下文进行摘要总结，生成总体任务规划、当前进度、待办事项等，作为子任务的一部分系统提示词，能够指导子任务更好地完成目标
  const summary = await _mainTaskSummary(mainMessages)
  return [
    {
      role: 'system',
      content: TaskAiAgentSystemPrompt.replace('20KB', `${GlobalVariable.aiCli.config.maxBlockFileSize}KB`) + '\n\n' + summary,
    },
    {
      role: 'user',
      content: goal,
    },
  ]
}

async function _mainTaskSummary(mainMessages) {
  mainMessages = mainMessages.slice(1) // 去掉system消息
  if (mainMessages.length === 0) {
    return ''
  }
  // 对主任务的上下文进行摘要总结，生成总体任务规划、当前进度、待办事项等，作为子任务的一部分系统提示词，能够指导子任务更好地完成目标
  const summaryPrompt = `你是“子任务上下文整理器”。
请基于下面的主任务对话历史，生成一个可直接提供给子任务使用的“执行摘要”。

摘要目标：
1. 明确主任务的最终目标与验收标准；
2. 提炼当前进度：已完成内容、关键结论、已验证结果；
3. 列出仍需推进的事项（按优先级）；
4. 提取对子任务有约束作用的信息：技术栈、文件路径、接口约定、用户偏好、限制条件；
5. 标注风险与未决问题（如有）。

输出要求：
- 只保留与后续执行直接相关的信息；
- 删除闲聊、重复表达、无关报错细节、无价值过程噪音；
- 不要编造对话中不存在的信息；
- 用尽可能简洁的语言输出；
- 严格按以下结构输出：

【主任务目标】
...

【当前进度】
- 已完成：...
- 关键结论：...

【待办事项】
1. ...
2. ...

【关键约束与上下文】
- ...

Conversation history:
${mainMessages
  .map((m) => {
    if (m.role === 'system') return `[SYSTEM]: ${m.content}`
    if (m.role === 'user') return `[USER]: ${m.content}`
    if (m.role === 'assistant')
      return `[ASSISTANT]: ${m.content ? m.content : '[Tool calls]'}`
    if (m.role === 'tool') return `[TOOL RESULT]: ${m.content}`
    return ''
  })
  .join('\n')}`
    try {
      const summary = await aiRequestSingle(
        this.aiClient,
        this.aiConfig,
        summaryPrompt,
      )
      return summary
    } catch (error) {
      logError('Failed to summarize messages to sub task: ' + error.message)
      return ''
    }
}


/**
 * Ai单轮问答
 * @param {*} openAiClient OpenAI客户端
 * @param {*} aiConfig {model, temperature, maxTokens, stream}
 * @param {*} systemDescription
 * @param {*} prompt
 * @param {*} temperature
 * @returns
 */
async function aiRequestSingle(
  openAiClient,
  aiConfig,
  systemDescription,
  prompt,
  isOnline = false,
) {
  const messages = []
  messages.push({
    role: 'system',
    content: systemDescription,
  })
  messages.push({
    role: 'user',
    content: prompt,
  })
  const opt = {
    messages: messages,
    ...aiConfig,
    stream: false,
  }
  const response = await openAiClient.chat.completions.create(opt)
  return response.choices[0].message.content
}
/**
 * Ai携带工具请求
 * @param {*} openAiClient
 * @param {*} aiConfig {model, temperature, maxTokens}
 * @param {*} messages
 * @param {*} functionDescriptions
 * @returns
 */
async function aiRequestByTools(
  openAiClient,
  aiConfig,
  messages,
  functionDescriptions,
) {
  const response = await openAiClient.chat.completions.create({
    messages: messages,
    tools: functionDescriptions,
    tool_choice: 'auto',
    ...aiConfig,
  })
  if (aiConfig.stream) {
    const messageRes = await _streamToNonStream(response)
    return {
      content: messageRes.choices[0].message.content,
      tool_calls: messageRes.choices[0].message.tool_calls,
      message: messageRes.choices[0].message,
    }
  }
  return {
    content: response.choices[0].message.content,
    tool_calls: response.choices[0].message.tool_calls,
    message: response.choices[0].message,
  }
}

// 流式输出结果转非流式输出
async function _streamToNonStream(stream) {
  // 初始化最终响应结构（对齐 OpenAI 非流式响应格式）
  const finalResponse = {
    id: '',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000), // 生成时间戳
    model: '',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: '',
          reasoning_content: '',
          tool_calls: [], // 存储完整的工具调用列表
        },
        finish_reason: null,
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  }

  // 工具调用缓冲区：处理多工具调用 + 分段参数拼接
  const toolCallBuffers = new Map() // key: tool_call_id, value: toolCall object
  const toolCallIndexMap = new Map() // key: index, value: tool_call_id
  try {
    // 遍历所有流式数据块
    for await (const chunk of stream) {
      // 1. 填充全局信息（仅首次获取）
      if (!finalResponse.id) {
        finalResponse.id = chunk.id || `chatcmpl-${Date.now()}`
      }
      if (!finalResponse.model) {
        finalResponse.model = chunk.model || 'deepseek-reasoner'
      }

      const choice = chunk.choices[0]
      const delta = choice.delta
      if (!delta) {
        continue
      }
      // 2. 处理普通文本内容
      const reasoning_content = delta.reasoning_content
      if (reasoning_content) {
        finalResponse.choices[0].message.reasoning_content += reasoning_content
        // 流式输出
        streamOutput(reasoning_content, '#47854a')
      }
      const content = delta.content
      if (content) {
        finalResponse.choices[0].message.content += content
        // 流式输出
        streamOutput(content, '#68e46e')
      }
      // 3. 处理工具调用（核心逻辑）
      if (delta.tool_calls && delta.tool_calls.length > 0) {
        delta.tool_calls.forEach((toolCallChunk) => {
          const index = toolCallChunk.index
          if (toolCallChunk.id) {
            const id = toolCallChunk.id
            toolCallIndexMap.set(index, id)
            let toolCall = toolCallBuffers.get(id)
            if (!toolCall) {
              toolCall = {
                id: id,
                type: toolCallChunk.type || 'function',
                function: {
                  name: toolCallChunk.function.name,
                  arguments: '',
                },
              }
              toolCallBuffers.set(id, toolCall)
            }
          } else {
            const id = toolCallIndexMap.get(index)
            const toolCall = toolCallBuffers.get(id)
            if (toolCall && toolCallChunk.function?.arguments) {
              toolCall.function.arguments += toolCallChunk.function.arguments
              streamOutput(toolCallChunk.function.arguments, '#47854a')
            }
          }
        })
      }

      // 4. 处理结束标记
      if (choice.finish_reason) {
        finalResponse.choices[0].finish_reason = choice.finish_reason

        // 工具调用结束：将缓冲区数据写入最终响应
        if (choice.finish_reason === 'tool_calls' && toolCallBuffers.size > 0) {
          finalResponse.choices[0].message.content = '' // 工具调用时 content 为 null
          finalResponse.choices[0].message.tool_calls = Array.from(
            toolCallBuffers.values(),
          )
        } else {
          finalResponse.choices[0].message.tool_calls = undefined
        }
      }
    }
    streamLineBreak()
    return finalResponse
  } catch (error) {
    console.error('流式数据转换失败：', error.message)
    throw error // 抛出错误让上层处理
  }
}

module.exports = {
  createOpenAiClient,
  aiRequestSingle,
  aiRequestByTools,
  getInitialMessages,
  getInitialMessagesForSkill,
  getInitialMessagesForTest,
  getInitialMessagesForTask,
  getSystemPrompt,
}
