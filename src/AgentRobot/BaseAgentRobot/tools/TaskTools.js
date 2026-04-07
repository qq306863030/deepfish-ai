import fs from 'fs-extra'
import path from 'path'

// 生成/创建任务列表
function createTaskListRules() {
    return `你需要先创建任务列表文件 tmp_tasklist.json（位于当前目录）。

创建规则：
1. 如果 tmp_tasklist.json 已存在，先询问用户是否覆盖；
2. 文件内容必须是 JSON 数组；
3. 每个数组元素是一个任务对象，字段至少包含：
   - id: 任务唯一标识（字符串或数字）
   - name: 任务名称
   - description: 任务描述
   - status: 任务状态（"todo" | "doing" | "done"）
   - createdAt: 创建时间（ISO 字符串）
   - finishedAt: 完成时间（未完成可为 null）
   - note: 备注（可为空字符串）
4. 任务需尽量原子化、可执行。

输出要求：
- 仅输出可写入的合法 JSON 内容，不要输出解释文字。`
}

// 执行任务列表
function executeTaskListRules() {
    return `你需要执行当前目录下的 tmp_tasklist.json。

执行规则：
1. 读取任务列表，仅处理 status 为 "todo" 或 "doing" 的任务；
2. 每次只执行一个子任务，按列表顺序执行；
3. 执行前将当前任务状态更新为 "doing" 并保存；
4. 子任务执行成功后更新为 "done"，并写入 finishedAt（ISO 时间）；
5. 子任务失败时保留为 "doing" 或回退为 "todo"，并在 note 记录失败原因摘要；
6. 每完成一个子任务都必须立刻写回 tmp_tasklist.json；
7. 当全部任务为 "done" 时，明确输出“任务列表执行完成”。
8. 尽量交给子任务完成，主任务流不要参与过多思考和执行细节。
9. 任务全部执行完成后，删除 tmp_tasklist.json 文件。

输出要求：
- 输出当前执行的任务 id/name、结果状态、下一步计划；
- 不要跳过状态更新与落盘步骤。

工具函数：
- readTaskList: 读取任务列表文件
- updateTaskList: 更新任务列表文件
- executeSubTaskFromTaskList: 执行单个子任务目标`
}

// 读取任务列表
function readTaskList(taskListPath) {
    return fs.readFileSync(taskListPath || path.join(process.cwd(), 'tmp_tasklist.json'), { encoding: 'utf-8' }) || '[]'
}

// 更新任务列表
function updateTaskList(taskListPath, list) {
    try {
        fs.writeFileSync(taskListPath || path.join(process.cwd(), 'tmp_tasklist.json'), JSON.stringify(list, null, 2), { encoding: 'utf-8' })
        return true
    } catch (error) {
        return { error: error.message }
    }
}

// 从任务列表执行子任务
function executeSubTaskFromTaskList(subTaskGoalPrompt = "") {
    return this.createSubAgent(subTaskGoalPrompt)
}

const descriptions = [
    {
        type: 'function',
        function: {
            name: 'createTaskListRules',
            description:
                '获取任务列表创建规则。返回一段用于指导AI生成tmp_tasklist.json的提示词，适用于需要先规划任务清单再逐步执行的场景。需要明确提出生成任务列表才会执行。',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'executeTaskListRules',
            description:
                '执行任务列表前需要获取执行规则提示词。返回一段用于指导AI逐步执行tmp_tasklist.json的提示词',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'readTaskList',
            description:
                '读取任务列表并返回任务数组。taskListPath可选，默认读取当前目录的tmp_tasklist.json；文件不存在或读取失败时返回空数组。',
            parameters: {
                type: 'object',
                properties: {
                    taskListPath: {
                        type: 'string',
                        description: '任务列表文件路径，默认值为当前目录下tmp_tasklist.json',
                    },
                },
                required: ["taskListPath"],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'updateTaskList',
            description:
                '将完整任务数组写入任务列表文件。用于任务状态、备注、时间字段的持久化更新。返回true表示写入成功，写入失败会抛出错误。',
            parameters: {
                type: 'object',
                properties: {
                    taskListPath: {
                        type: 'string',
                        description: '任务列表文件路径，默认值为当前目录下tmp_tasklist.json',
                    },
                    list: {
                        type: 'array',
                        description: '任务对象数组',
                        items: {
                            type: 'object',
                        },
                    },
                },
                required: ["taskListPath", 'list'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'executeSubTaskFromTaskList',
            description:
                '启动子任务工作流执行单个子任务目标。subTaskGoalPrompt为子任务目标的提示词，建议传入“当前任务名称+验收标准+约束条件”。',
            parameters: {
                type: 'object',
                properties: {
                    subTaskGoalPrompt: {
                        type: 'string',
                        description: '子任务目标描述',
                    },
                },
                required: ["subTaskGoalPrompt"],
            },
        },
    },
]

const functions = {
    createTaskListRules,
    executeTaskListRules,
    readTaskList,
    updateTaskList,
    executeSubTaskFromTaskList,
}

const TaskTools = {
    name: 'TaskTools',
    extensionDescription: '提供任务列表创建规则、执行规则、任务读写与子任务执行能力，支持基于tasklist的可追踪拆分执行流程',
    descriptions,
    functions,
}

export default TaskTools


