// 执行测试任务
function executeTestTask(subGoalPrompt = "") {
  // 调用子工作流完成目标
  return this.aiService.subTestWorkflow(subGoalPrompt)
}

// 生成测试任务
function generateTestTaskRule(goal) {
  return `
用户测试任务：${goal}。
请在当前目录下生成一个Markdown格式的程序功能测试说明文档，文档标题固定为“xxx测试任务”（其中“xxx”替换为具体的程序功能测试任务名称，需与我提供的程序功能测试目标完全一致）。生成文档前，请先仔细研读我给出的程序功能测试任务目标，明确程序待测试的功能模块、核心测试需求、测试范围及测试重点，精准理解每个功能的预期表现，确保完全掌握测试任务要求后再进行文档撰写。

文档核心内容需围绕程序功能测试任务目标，针对程序的每个待测试功能，制定**可逐条执行、无歧义、覆盖全面**的功能测试用例，每个测试用例需明确对应程序功能模块、具体测试场景、详细测试步骤（步骤需具体可操作，可直接供测试人员执行，明确操作路径、输入数据、操作顺序，避免模糊表述）；同时，为每个测试用例对应明确、可验证的测试期望结果，期望结果需与测试步骤一一对应，清晰界定程序功能正常运行的标准，明确功能执行后应呈现的具体效果、输出结果或状态，无模糊不清的表述。

补充要求：1. 测试用例需按程序功能模块分类、按测试优先级排序，每个测试用例标注唯一编号，便于区分、执行和追溯；2. 文档格式需符合Markdown规范，标题层级清晰（文档标题为一级标题，功能模块分组用二级标题，测试用例用三级标题或有序列表），排版整洁，便于阅读、编辑和后续维护；3. 严格贴合程序功能测试任务目标，聚焦程序功能的正确性、完整性，不添加无关内容，不遗漏核心功能测试场景，不规避边界场景，确保测试用例的针对性、完整性和有效性，能充分验证程序各功能是否符合预期。
`}

const descriptions = [
  {
    type: "function",
    function: {
      name: "generateTestTaskRule",
      description:
        "根据用户提供的程序功能测试目标，生成一份标准化的Markdown格式功能测试说明文档的规则提示词。返回的提示词将指导AI生成包含完整测试用例（测试步骤、期望结果、用例编号）的测试文档。适用于用户需要对程序进行功能测试、回归测试、验收测试等场景。",
      parameters: {
        type: "object",
        properties: {
          goal: {
            type: "string",
            description: "程序功能测试目标描述，需明确待测试的功能模块、测试范围和测试重点",
          },
        },
        required: ["goal"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "executeTestTask",
      description:
        "执行测试任务，启动一个专用的AI子工作流来完成指定的测试目标。子工作流将根据测试任务描述，自动执行测试步骤并验证测试结果。适用于需要AI自动化执行功能测试的场景。",
      parameters: {
        type: "object",
        properties: {
          subGoalPrompt: {
            type: "string",
            description: "测试子工作流需要完成的目标描述，描述具体的测试任务内容",
          },
        },
        required: ["subGoalPrompt"],
      },
    },
  },
];

const functions = {
  executeTestTask,
  generateTestTaskRule,
};

module.exports = {
  descriptions,
  functions,
};