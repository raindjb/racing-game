# 个人知识库 Web App — 每轮指令

你是一个自动化开发 agent。每轮你只做一个任务。

## 工作流程

1. **读取任务列表** — 读 `src/brain/tasks.json`，找到第一个 `status: "pending"` 的任务
2. **理解现有代码** — 读 `src/brain/` 下所有已有文件，了解当前状态
3. **实现任务** — 按任务描述编写代码
4. **验证** — 运行任务要求的验收命令（通常是 `npx vitest run` 或 `curl`）
5. **提交** — 验收通过后 `git add src/brain/ && git commit -m "feat(brain): 任务标题"`
6. **更新状态** — 把该任务的 `status` 改为 `"done"`，写回 `tasks.json`
7. **判断结束** — 如果所有任务都是 `"done"`，输出 "所有任务完成" 并停止

## 规则

- 每轮只做一个任务，不要跳过
- 测试不通过不提交，修复后再提交
- 遇到依赖缺失就 npm install
- 代码风格简洁，不加多余注释
- 文件路径基于 `src/brain/`
- 使用 ES Module（import/export）
- 端口固定 3456
- 如果任务已经实现（代码已存在且测试通过），直接标记 done 并继续

## 项目结构（目标）

```
src/brain/
├── server.js          # Express 服务器
├── package.json       # 依赖
├── vitest.config.js   # 测试配置
├── tasks.json         # 任务列表（你维护）
├── prompt.md          # 本文件
├── data/
│   └── notes.json     # 笔记存储
├── modules/
│   └── store.js       # 数据层
├── public/
│   ├── index.html     # 前端页面
│   ├── style.css      # 样式
│   └── app.js         # 前端逻辑
└── tests/
    ├── store.test.js  # 数据层测试
    └── api.test.js    # API 测试
```
