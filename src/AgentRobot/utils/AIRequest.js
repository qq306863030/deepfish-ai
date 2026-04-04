import { OpenAI } from 'openai'

function creatClient(aiConfig) {
  return new OpenAI({
    baseURL: aiConfig.baseUrl,
    apiKey: aiConfig.apiKey || '',
  })
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
async function think(
  openAiClient,
  aiConfig,
  messages,
  thinkBefore = () => {},
  thinkAfter = () => {},
  streamThinkOutput,
  streamContentOutput,
  streamToolCallsOutput,
  streamEnd,
) {
  try {
    const opt = {
      messages: messages,
      ...aiConfig,
    }
    await thinkBefore()
    const response = await openAiClient.chat.completions.create(opt)
    if (aiConfig.stream) {
      const messageRes = await _streamToNonStream(
        response,
        streamThinkOutput,
        streamContentOutput,
        streamToolCallsOutput,
        streamEnd,
      )
      await thinkAfter()
      return {
        content: messageRes.choices[0].message.content,
        message: messageRes.choices[0].message,
      }
    }
    await thinkAfter()
    return response.choices[0].message.content
  } catch (error) {
    return `AI response error: ${error.message}`
  }
}
/**
 * Ai携带工具请求
 * @param {*} openAiClient
 * @param {*} aiConfig {model, temperature, maxTokens}
 * @param {*} messages
 * @param {*} functionDescriptions
 * @returns
 */
async function thinkByTool(
  openAiClient,
  aiConfig,
  messages,
  functionDescriptions,
  thinkBefore = () => {},
  thinkAfter = () => {},
  streamThinkOutput,
  streamContentOutput,
  streamToolCallsOutput,
  streamEnd,
) {
  try {
    await thinkBefore()
    const response = await openAiClient.chat.completions.create({
      messages: messages,
      tools: functionDescriptions,
      tool_choice: 'auto',
      ...aiConfig,
    })
    if (aiConfig.stream) {
      const messageRes = await _streamToNonStream(
        response,
        streamThinkOutput,
        streamContentOutput,
        streamToolCallsOutput,
        streamEnd,
      )
      await thinkAfter()
      return {
        content: messageRes.choices[0].message.content,
        tool_calls: messageRes.choices[0].message.tool_calls,
        message: messageRes.choices[0].message,
      }
    }
    await thinkAfter()
    return {
      content: response.choices[0].message.content,
      tool_calls: response.choices[0].message.tool_calls,
      message: response.choices[0].message,
    }
  } catch (error) {
    return `AI response error: ${error.message}`
  }
}

// 流式输出结果转非流式输出
async function _streamToNonStream(
  stream,
  streamThinkOutput = () => {},
  streamContentOutput = () => {},
  streamToolCallsOutput = () => {},
  streamEnd = () => {},
) {
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
      if (!choice) {
        continue
      }
      const delta = choice.delta
      if (!delta) {
        continue
      }
      // 2. 处理普通文本内容
      const reasoning_content = delta.reasoning_content
      if (reasoning_content) {
        if (finalResponse.choices[0].message.reasoning_content.length === 0) {
          streamThinkOutput('[Thinking...]')
        }
        finalResponse.choices[0].message.reasoning_content += reasoning_content
        // 流式输出
        streamThinkOutput(reasoning_content)
      }
      const content = delta.content
      if (content) {
        if (finalResponse.choices[0].message.content.length === 0) {
          streamContentOutput('\r\n')
        }
        finalResponse.choices[0].message.content += content
        // 流式输出
        streamContentOutput(content)
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
              if (toolCall.function.arguments.length === 0) {
                streamToolCallsOutput('\r\n[ToolCalls...]')
              }
              toolCall.function.arguments += toolCallChunk.function.arguments
              streamToolCallsOutput(toolCallChunk.function.arguments)
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
    streamEnd()
    return finalResponse
  } catch (error) {
    console.error('流式数据转换失败：', error.message)
    throw error // 抛出错误让上层处理
  }
}


export { creatClient, think, thinkByTool }