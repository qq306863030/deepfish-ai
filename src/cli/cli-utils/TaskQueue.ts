import { randomUUID } from 'crypto';
import type AIAgent from "@/agent/AIAgent";
import { getSessionMsgQueuePath } from "./getGlobalPath";
import type { TaskQueueItem } from "@/@types/ConfigFile";
import dayjs from 'dayjs';
import fs from 'fs-extra';

export default class TaskQueue {
    taskFilePath: string;
    constructor(agent: AIAgent|string) {
        this.taskFilePath = getSessionMsgQueuePath(typeof agent === 'string' ? agent : agent.id);
    }
    pushTask(taskStr: string) {
        const taskQueueItem: TaskQueueItem = {
            id: randomUUID(),
            taskStr,
            createTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        };
        const taskList = this.loadTasks();
        taskList.push(taskQueueItem);
        this.updateTasks(taskList);
    }
    loadTasks() {
        const tasks: TaskQueueItem[] = fs.readJSONSync(this.taskFilePath, { throws: false }) || [];
        return tasks;
    }
    updateTasks(tasks: TaskQueueItem[]) {
        fs.writeJSONSync(this.taskFilePath, tasks);
    }
    clearTasks() {
        this.updateTasks([]);
    }
    delTask(index: number) {
        const taskList = this.loadTasks();
        if (index >= 0 && index < taskList.length) {
            taskList.splice(index, 1);
            this.updateTasks(taskList);
        }
    }
    getTask() {
        const taskList = this.loadTasks();
        if (taskList.length === 0) {
            return null;
        }
        const task = taskList.shift();
        this.updateTasks(taskList);
        return task || null;
    }
}