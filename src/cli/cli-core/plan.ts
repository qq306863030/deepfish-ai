import { logError } from "@/utils/print";
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
