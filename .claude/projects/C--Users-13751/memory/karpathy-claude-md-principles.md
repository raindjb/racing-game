---
name: karpathy-claude-md-principles
description: "Karpathy's 4 AI behavior principles merged into CLAUDE.md"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 256076bb-5052-4157-b824-ee9c06b34627
---

Karpathy 的 CLAUDE.md 四项原则已合并到项目根 `CLAUDE.md` 的 "AI Behavior Rules" 章节：

1. **Think Before Coding** — 不假设，有歧义就列出选项问
2. **Simplicity First** — 最小代码解决问题，不加没人要的功能
3. **Surgical Changes** — 只改任务相关的文件/行，不顺手"清理"
4. **Goal-Driven Execution** — 模糊需求→可验证目标→循环直到验证通过

这些规则覆盖所有 agent 行为。来源: `forrestchang/andrej-karpathy-skills` (2026.5, 74k+ Stars)。

**Why:** 用户经历了数亿 token 在单文件上反复修 bug 的循环，根因是缺乏行为约束：Agent 过度设计、跨模块乱改、改完不验证。

**How to apply:** Agent 在改代码前必须对照四项原则自检。原则 2+3 直接针对 "修 A 坏 B" 问题。
