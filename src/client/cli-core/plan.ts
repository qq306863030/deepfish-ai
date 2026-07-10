import { logError } from "@/client/cli-utils/print";
import { handleInput } from "./input";
import path from 'path';

export async function handlePlan(args: string[]) {
    const input = args.join(' ');
    if (!input.trim()) {
        logError('Please enter content');
        return;
    }
    const skillPrompt = `使用SKILL-"planning-do"将用户任务分解并完成，以下是用户目标：${input}`;
    const skillPath = path.join(__dirname, './skills/planning-do.md');
    await handleInput([skillPrompt], [skillPath]);
}

export async function handlePlanContinue() {
    const skillPrompt = `
目前任务执行了一部分，需要继续执行。你负责按顺序调度执行当前工作目录文件 tmp_tasklist.json 中的子任务，完成当前工作目录文件 tmp_task_goal.md 描述的整体目标。

执行规则：
1. 先读取 tmp_task_goal.md 了解整体目标；
2. 读取 tmp_tasklist.json，仅处理 status 为 "todo" 或 "doing" 的任务；
3. 每次通过创建子Agent只调度一个子任务，按列表顺序依次执行；
4. 调度前将当前任务 status 更新为 "doing" 并写回文件；
5. 对每个子任务，必须创建一个独立的子 Agent 来执行，不要在主流程中直接完成具体任务；
6. 创建子 Agent 时，将整体目标、当前子任务 id/name/description、tmp_tasklist.json 文件名和执行要求一并传入；
7. 子 Agent 执行成功后，将当前任务 status 更新为 "done"，并记录 finishedAt（ISO 时间）；
8. 子 Agent 执行失败时，将当前任务保留为 "doing" 或回退为 "todo"，并在 note 中记录失败原因；
9. 每完成或失败一个子任务，都必须立即写回 tmp_tasklist.json；
10. 全部任务完成后，删除 tmp_tasklist.json 和 tmp_task_goal.md。

子 Agent 执行要求：
- 只执行当前被分配的一个子任务，不要修改其他任务状态；
- 执行前阅读 tmp_task_goal.md，理解整体目标；
- 必要时阅读 tmp_tasklist.json，了解上下文和任务依赖；
- 完成后向主 Agent 返回执行结果、修改的文件、失败原因或后续建议。

输出要求：
- 输出当前调度的任务 id、名称、执行结果状态和下一步计划；
- 不要跳过状态更新和文件写入步骤。
    `;
    await handleInput([skillPrompt]);
}
