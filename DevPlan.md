## 开发计划

### .deepfish-ai目录结构
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
        -bakup // 备份目录
            -stamp // 以时间戳命名，最多备份n个版本， 通过"ai recover ls" "ai recover latest" "ai recover index" // 恢复备份文件
                -uuid.xxx // 备份文件
                -record.json // 备份记录文件 {"uuid": {"originPath": "原文件路径","optionType": "操作类型（创建、更新、删除）","timestamp": "操作时间戳"}}
            
        -agentTree.json // 主agent的组织架构数据,每次子agent创建或者销毁都要更新这个文件
            -{
                "agentId": "主agent编号",
                "children": [
                    {
                        "agentId": "子agent编号",
                        "type": "sub", // "sub"、"sub-skill"
                        "skillName": "子agent执行的技能",
                        "children": []
                    }
                    ...
                ]
            }
        -logs // 日志目录
            -log-{YYYY-MM-DD HH}.txt // 以小时为单位的日志文件

3. 子agent的记忆文件和结构跟随生命周期创建和删除
8. 守护进程
9. agent连接
10. 看板、对话界面
11. 并发执行
12. 文档处理、图像生成、视频生成agent
13. 知识库搭建
14. 日志记录
15. 命令行
16. 多进程
17. 文件恢复
18. 树结构记录
        