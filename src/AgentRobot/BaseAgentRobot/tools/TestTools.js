// 执行测试任务
function executeTestTask(subGoalPrompt = "") {
  // 调用子工作流完成目标
  return this.Tools.createSubAgent(subGoalPrompt)
}

// 生成测试任务
function generateTestTaskRule(goal) {
  return `
你是资深测试工程师。用户测试任务目标如下：${goal}

请在当前目录下生成一个 Markdown 格式的“程序功能测试说明文档”，并严格遵循以下要求：
1. 文档标题
- 一级标题固定格式：# xxx测试任务
- 其中“xxx”必须与用户提供的测试任务名称保持一致，不得改写。
2. 先分析再输出
- 在正文最前面先给出“测试范围与模块拆分”小节，明确：
  - 待测功能模块
  - 核心测试点
  - 不在本轮测试范围的内容（如有）
- 然后再输出详细测试用例。
3. 测试用例组织方式
- 按“功能模块”分组（每个模块一个二级标题）。
- 模块内按优先级排序：P0 > P1 > P2。
- 每个用例必须有唯一编号，建议格式：TC-模块缩写-序号（如 TC-LOGIN-001）。
4. 每条测试用例必须包含以下字段（缺一不可）
- 用例编号
- 所属模块
- 优先级（P0/P1/P2）
- 测试场景
- 前置条件
- 测试数据
- 操作步骤（可逐条执行、无歧义、可落地）
- 预期结果（与步骤一一对应、可验证）
5. 覆盖性要求
- 必须覆盖：主流程、异常流程、边界场景。
- 不得遗漏核心功能，不得加入与目标无关的测试内容。
- 期望结果必须具体到可观察的页面状态、返回结果、数据变化或提示信息。
6. 输出格式要求
- 全文仅输出 Markdown 正文，不要输出解释性前言。
- 标题层级清晰：文档标题为一级、模块为二级、测试用例为三级（或有序列表）。
- 文档末尾增加“测试执行任务清单”章节，使用可勾选任务列表（- [ ]）逐条列出所有测试用例，便于执行与追踪。
- 文档末尾增加“测试结果评估”章节，输出测试结果和未通过的测试用例，并评估评估测试结果的有效性、全面性、及时性。

请根据以上要求直接生成完整测试文档。
`}

const descriptions = [
  {
    type: "function",
    function: {
      name: "generateTestTaskRule",
      description:
        "根据用户提供的程序功能测试目标，生成一份标准化的Markdown格式功能测试说明文档的规则提示词。返回的提示词将指导AI生成包含完整测试用例（测试步骤、期望结果、用例编号）的测试文档。适用于用户需要对程序进行功能测试等场景。",
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
        "执行测试任务，启动一个专用的AI子工作流来完成指定的某一项测试目标。子工作流将根据测试任务描述，自动执行测试步骤并验证测试结果。适用于需要AI自动化执行功能测试的场景。",
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

const TestTools = {
  name: 'TestTools',
  extensionDescription: "提供程序功能测试任务的生成和执行功能，支持自动化测试工作流",
  descriptions,
  functions,
  isSystem: true
}

module.exports = TestTools