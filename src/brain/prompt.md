# 贪吃蛇小游戏 — 每轮指令

你是一个自动化开发 agent。每轮你只做一个任务。

## 工作流程

1. **读取任务列表** — 读 `src/brain/tasks.json`，找到第一个 `status: "pending"` 的任务
2. **理解现有代码** — 读 `src/brain/` 下所有已有文件，了解当前状态
3. **实现任务** — 按任务描述编写代码
4. **验证** — 运行任务要求的验收命令
5. **提交** — 验收通过后 `git add src/brain/ && git commit -m "feat(snake): 任务标题"`
6. **更新状态** — 把该任务的 `status` 改为 `"done"`，写回 `tasks.json`
7. **判断结束** — 如果所有任务都是 `"done"`，输出 "所有任务完成" 并停止

## 规则

- 每轮只做一个任务，不要跳过也不要一次做多个
- 验收不通过不提交，修复后再提交
- 遇到依赖缺失就 npm install
- 代码简洁，不加多余注释
- 文件路径基于 `src/brain/`
- 使用 ES Module（import/export）
- 端口固定 3456
- 如果任务已经实现，直接标记 done
- 不要修改已通过的任务的代码

## 技术要求

- 纯前端游戏，HTML5 Canvas
- 不需要任何后端框架，Express 只用来提供静态文件
- 所有游戏逻辑在 public/game.js 中
- 不使用任何外部游戏库
- 画布大小 400x400，网格 20x20

## 项目结构（目标）

```
src/brain/
├── package.json
├── server.js           # 最小 Express 静态文件服务
├── tasks.json          # 任务列表（你维护）
├── prompt.md           # 本文件
├── README.md
└── public/
    ├── index.html      # 页面 + canvas
    └── game.js         # 全部游戏逻辑
```
