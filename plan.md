### .deepfish-ai目录
-config.js
-clawSkills
    -skill // 扩展技能
        -SKILL.md
    -clawSkills.json // openclaw的技能数据
-memery
    -agentRecord.json // 记录文件目录与主agent编号的映射，创建时间
    -主agent编号
        -memery.json // 主agent的记忆数据
        -memery-子agent编号.json // 子agent的记忆数据,如果执行完毕则删除
        -agentTree.json // 主agent的组织架构数据,每次子agent创建或者销毁都要更新这个文件
            -{
                "agentId": "主agent编号",
                "children": [
                    {
                        "agentId": "子agent编号",
                        "children": []
                    }
                    ...
                ]
            }
        -logs // 日志目录
            -log-{YYYY-MM-DD HH}.txt // 以小时为单位的日志文件

1. 文件创建结构调整
2. 自动删除过期的agent记忆文件和日志文件（超过7天）
3. 子agent的记忆文件和结构跟随生命周期创建和删除
4. agent上下文恢复
5. 适配扩展技能，自动将扩展创建为子agent
6. 扩展生成、任务列表、测试等子agent创建
7. openclaw skill加载执行agent
8. 守护进程
9. agent连接
10. 看板、对话界面
11. 并发执行
12. 文档处理、图像生成、视频生成agent
13. 知识库搭建
        