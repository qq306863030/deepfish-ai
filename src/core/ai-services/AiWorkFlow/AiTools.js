const { cloneDeep } = require("lodash");
const { logError, logInfo, loading } = require("../../utils");

const maxMessagesLength = 20000; // 最大压缩长度
const maxMessagesCount = 20; // 最大压缩数量

// 计算Messges的总长度
function calculateMessagesLength(messages) {
  return messages.reduce((total, msg) => {
    let length = 0;
    if (msg.content) {
      length +=
        typeof msg.content === "string"
          ? msg.content.length
          : JSON.stringify(msg.content).length;
    }
    if (msg.tool_calls) {
      length += JSON.stringify(msg.tool_calls).length;
    }
    return total + length;
  }, 0);
}

// 压缩Messages
async function summarizeMessages(aiConfig, aiClient, goal, lastTwoMessages, messages) {
  lastTwoMessages = lastTwoMessages.map((m) => {
    if (m.role === "system")
      return `[SYSTEM]: ${m.content}`;
    if (m.role === "user") return `[USER]: ${m.content}`;
    if (m.role === "assistant")
      return `[ASSISTANT]: ${m.content ? m.content : "[Tool calls]"}`;
    if (m.role === "tool")
      return `[TOOL RESULT]: ${m.content}`;
    return "";
  }).join("\n");
  const summaryPrompt = `请结合任务目标${goal}，和最后两轮的对话${lastTwoMessages}, 总结以下对话历史，重点：
  1. 删除不需要的信息，如程序报错、冗余表述、语气词、闲聊等信息
  2. 关注当前进度和状态
  3. 总结后续任务所需的重要背景信息并以及所需要的内容
结果只保留对上下文有用的内容，保持摘要简短且全面，保证后续任务有效进行。.

Conversation history:
${messages
  .map((m) => {
    if (m.role === "system")
      return `[SYSTEM]: ${m.content}`;
    if (m.role === "user") return `[USER]: ${m.content}`;
    if (m.role === "assistant")
      return `[ASSISTANT]: ${m.content ? m.content : "[Tool calls]"}`;
    if (m.role === "tool")
      return `[TOOL RESULT]: ${m.content}`;
    return "";
  })
  .join("\n")}`;

  try {
    const response = await aiClient.chat.completions.create({
      model: aiConfig.model,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that creates concise summaries of conversations.",
        },
        { role: "user", content: summaryPrompt },
      ],
      temperature: aiConfig.temperature,
      max_tokens: aiConfig.maxTokens,
    });
    return response.choices[0].message.content;
  } catch (error) {
    logError("Failed to summarize messages: " + error.message);
    return "Previous conversation history was too long and has been summarized. Please continue with the current task.";
  }
}

async function manageMessages(aiCli, aiConfig, aiClient, messages) {
  const aiRecorder = aiCli.recorder;
  messages = cloneDeep(messages);
  const currentLength = calculateMessagesLength(messages);
  const currentCount = messages.length;

  if (currentLength > maxMessagesLength || currentCount > maxMessagesCount) {
    logInfo(
      `Managing messages: current length ${currentLength}, count ${currentCount}`,
    );

    const systemMessage = messages[0];
    const userMessage = messages[1];
    const goal = messages[1].content
    const messagesToSummarize = messages.slice(2, -2);

    if (messagesToSummarize.length > 0) {
      const summary = await summarizeMessages(
        aiConfig,
        aiClient,
        goal,
        messages.slice(-2),
        messagesToSummarize,
      );

      const newMessages = [
        systemMessage,
        userMessage,
        {
          role: "user",
          content: `[CONVERSATION SUMMARY]: ${summary}`,
        },
        ...messages.slice(-2)
      ];
      logInfo(
        `Messages compressed: ${messages.length} -> ${newMessages.length}`,
      );
      aiRecorder.log([{
          role: "user",
          content: `[CONVERSATION SUMMARY]: ${summary}`,
        }]);
      return newMessages;
    }
  }

  return messages;
}

// 执行内置函数
async function executeBuiltInFunction(
  toolFunctions,
  messages,
  aiRecorder,
  goal,
  tool_calls,
) {
  for (const toolCall of tool_calls) {
    const { id, function: func } = toolCall;
    const { name, arguments: args } = func;
    let toolFunction = toolFunctions[name];
    logInfo(`Calling tool ${toolCall.function.name}`);
    if (toolFunction) {
      try {
        const parsedArgs = JSON.parse(args);
        if (name === "readFile") {
          const fileInfo = await toolFunctions["getFileInfo"](
            parsedArgs.filePath,
          );
          if (fileInfo && fileInfo.isFile && fileInfo.size > 10 * 1024) {
            messages.push({
              role: "tool",
              tool_call_id: id,
              content: JSON.stringify({
                error:
                  "文件过大，请使用executeJSCode工具编写脚本分块读取和处理文件，避免一次性读取整个文件内容到对话中。建议使用fs.createReadStream逐行或分块读取，仅返回必要的结果或总结。",
                fileSize: fileInfo.size,
                fileSizeKB: Math.round(fileInfo.size / 1024),
              }),
            });
            await aiRecorder.record(goal, messages);
            aiRecorder.log(messages);
            continue;
          }
        }
        let result = await toolFunction(...Object.values(parsedArgs));
        let toolContent = JSON.stringify(result);
        if (name !== "requestAI") {
          const MAX_CONTENT_SIZE = 100000;
          if (toolContent.length > MAX_CONTENT_SIZE) {
            if (
              typeof result === "string" &&
              result.length > MAX_CONTENT_SIZE
            ) {
              toolContent = JSON.stringify({
                truncated: true,
                message:
                  "文件内容过大，请使用executeJSCode工具编写脚本分块读取和处理文件，避免一次性读取整个文件内容到对话中。",
                preview: toolContent.substring(0, MAX_CONTENT_SIZE) + "...",
              });
            } else {
              toolContent = JSON.stringify({
                truncated: true,
                message: "结果数据量过大，请使用更具体的查询或分块处理。",
                preview: toolContent.substring(0, MAX_CONTENT_SIZE) + "...",
              });
            }
          }
        }
        messages.push({
          role: "tool",
          tool_call_id: id,
          content: toolContent,
        });
        await aiRecorder.record(goal, messages);
        aiRecorder.log(messages);
      } catch (error) {
        messages.push({
          role: "tool",
          tool_call_id: id,
          content: JSON.stringify({ error: error.message }),
        });
        await aiRecorder.record(goal, messages);
        aiRecorder.log(messages);
      }
      logInfo(`Tool ${toolCall.function.name} finished.`);
    } else {
      logError(`Tool ${toolCall.function.name} not found.`);
      messages.push({
        role: "tool",
        tool_call_id: id,
        content: JSON.stringify({ error: `Tool ${name} not found` }),
      });
      await aiRecorder.record(goal, messages);
      aiRecorder.log(messages);
    }
  }
}

const currentDir = process.cwd();
const osType = process.platform;
// 系统限制提示词
const workFlowPrompt = `
你是一个严格按规则执行任务的智能体，不能违反任何系统限制。
### 基础环境信息
当前工作目录：${currentDir}
操作系统类型：${osType}

### 工具使用规则
优先使用工具完成任务：可调用 executeJSCode 运行 Node.js 代码处理复杂逻辑；可调用 executeCommand 运行系统命令行工具（如 git、npm 等），工具调用需确保语法/指令符合当前操作系统规范（Windows/macOS/Linux 区分）。

### 大文件处理规则（分步执行）
处理长文档等大文件（单文件＞5KB）时，必须按以下步骤分块处理：
1. 预处理：先执行文件大小/结构检查（如通过命令行/JS 代码获取文件大小、判断文件格式），输出检查结果；
2. 分块规则：按 5KB–10KB/块拆分文件，拆分后每个块生成独立临时文件（命名格式：{原文件名}_chunk{序号}.tmp）；
3. 处理逻辑：翻译/总结/分析类任务逐块处理，每块处理完成后记录结果，最后合并所有块的结果生成最终文件；
4. 合并校验：合并后需校验结果完整性（如总字符数匹配、无内容缺失），确保分块处理无遗漏。

### 核心执行原则
1. 最优路径优先：执行前必须先规划最少步骤的操作路径，明确「先做什么、再做什么、哪些可省略」，避免重复操作和无效步骤；
2. 异常反馈：操作失败（如命令执行报错、文件不存在）时，需明确说明「失败原因+可尝试的解决方案」，而非仅提示“操作失败”；
3. 结果校验：任务完成后，需简单校验结果是否符合用户目标（如文件是否生成、内容是否完整），并向用户反馈校验结果。
`

// 目标分析提示词
const goalAnalysisPrompt = `你是一个目标分析与提示词优化专家。请分析用户的目标，不需要完成该目标只需要分析、优化用户目标为ai更便于理解的提示词即可。当前工作目录为 ${currentDir}，操作系统为 ${osType}。
## 任务要求
1. **理解目标**：尽量不要调用其他工具，仅需理解字面意思
2. **拆分任务**：将字面意思拆分为1个或多个清晰、可执行的子目标,子目标尽可能少
3. **优化提示词**：为每个子目标生成简洁、明确、AI能理解的执行提示词
4. **注意**：如果用户的目标中包含文件内容的引用，则先读取文件再进行目标分析
5. **重要**：不需要将分析结果写入文件，只需要直接返回JSON格式的分析结果,其中tempFiles用于记录AI执行中产生的临时文件，方便后续查阅，初始状态外空对象
## 输出格式（JSON）
{
  "originalGoal": "用户的原始目标",
  "subGoals": [
    {
      "id": 1,
      "description": "子目标描述",
      "prompt": "优化后的简洁提示词，直接可用于AI执行"
    }
  ],
  "summary": "任务执行顺序和依赖关系的简要说明",
  "tempFiles": {
    "fileName": {
      "fileDescription": "文件描述",
      "filePath": "文件路径",
    }
  }
}
请直接返回JSON格式结果，不要包含其他说明文字。
重要：不需要验证结果。
`

// 工作流循环
async function agentWorkflow(
  aiCli,
  client,
  goal,
  messages,
  isRecover = false,
) {
  const extensionManager = aiCli.extensionManager;
  const config = aiCli.config;
  const aiConfig = aiCli.aiConfig;
  const name = config.currentAi || "I";
  const aiRecorder = aiCli.recorder;
  const { toolDescriptions, toolFunctions } = extensionManager.extensions;
  if (isRecover) {
    logInfo("Recovering from previous conversation...");
    let lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "tool") {
      // 删除最后一项
      messages.pop();
    }
    lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "assistant" && lastMessage.tool_calls) {
      await executeBuiltInFunction(
        toolFunctions,
        messages,
        aiRecorder,
        goal,
        lastMessage.tool_calls,
      );
    } else if (lastMessage.role === "assistant" && lastMessage.content) {
      return lastMessage.content || "";
    }
  } else {
    await aiRecorder.record(goal, messages);
  }
  let maxIterations = config.maxIterations || 10;
  let loadingStop;
  if (maxIterations === -1) {
    maxIterations = Infinity;
  }
  try {
    while (maxIterations-- > 0) {
      const newMessages = await manageMessages(aiCli, aiConfig, client, messages);
      messages.splice(0, messages.length, ...newMessages);
      loadingStop = loading("Thinking...");
      const response = await client.chat.completions.create({
        model: aiConfig.model,
        messages: messages,
        tools: toolDescriptions,
        tool_choice: "auto",
        temperature: aiConfig.temperature,
        max_tokens: aiConfig.maxTokens,
      });

      const message = response.choices[0].message;
      messages.push(message);
      await aiRecorder.record(goal, messages);
      aiRecorder.log(messages);
      loadingStop(`${name} have finished thinking.`);
      loadingStop = null;
      logInfo(message.content);
      // 检查是否是任务完成的总结响应（没有工具调用且有内容）
      if (!message.tool_calls && message.content) {
        break;
      }
      if (message.tool_calls) {
        await executeBuiltInFunction(
          toolFunctions,
          messages,
          aiRecorder,
          goal,
          message.tool_calls,
        );
      } else {
        // 没有工具调用，结束
        break;
      }
    }
    return messages[messages.length - 1]?.content || "";
  } catch (error) {
    if (loadingStop) {
      loadingStop("AI process terminated unexpectedly: " + error.message, true);
    } else {
      logError("AI process terminated unexpectedly: " + error.message);
    }
    throw error;
  }
}

module.exports = {
  agentWorkflow,
  goalAnalysisPrompt,
  workFlowPrompt,
};
