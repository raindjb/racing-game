---
name: agent-vs-shell-routing
description: "Dynamic Workflows: AI agents for judgment, shell for mechanical assembly — learned through practice"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35eac173-0c29-4813-965d-cd26b188e27f
---

## Dynamic Workflows 实操教训

**场景**：用 Dynamic Workflows 并行派发 12 个 agent 写赛车游戏模块（~10,000 行），再用 1 个 assembly agent 拼装成单文件。

**结果**：12 个写模块的 agent 顺利完成（10,049 行），但 assembly agent 卡住了。

**根因**：
1. 上下文溢出 — 汇编 agent 需要读 12 个文件共 350KB，单 agent 上下文装不下
2. 任务选型错误 — 文件拼接是纯机械操作，不需要 AI 判断，不该交给 agent

**正确分工**：
- AI agent 做需要判断的事：写代码、设计架构、做决策
- Shell 脚本做机械的事：拼接文件、复制、重命名、计数
- 这次拼装 4 条 bash 命令 2 秒搞定，agent 卡到死

**验证方法**：如果一步操作不需要任何「判断」（不需要看内容、不需要理解、不需要决策），就不要交给 agent。

**Why:** 实际跑了一次 12-agent 并行工作流才发现，AI agent 的瓶颈不在并行写，而在串行读大文件拼装。不实际操作根本不会意识到这个问题。

**How to apply:** 以后用 Dynamic Workflows 时，并行 agent 只做需要判断的创作/分析任务。拼装、合并、格式转换等机械操作直接写 shell 命令收尾。判断标准：这一步需要看内容理解吗？不需要 → 别用 agent。
