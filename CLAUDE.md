# Claude Code Game Studios -- Game Studio Agent Architecture

Indie game development managed through 49 coordinated Claude Code subagents.
Each agent owns a specific domain, enforcing separation of concerns and quality.

## Technology Stack

- **Engine**: Web Canvas (HTML5 Canvas 2D + JavaScript) — Tier 1 prototype phase
- **Future Engine**: Godot 4.5.1 (planned for Tier 3+ migration)
- **Language**: JavaScript (ES6+), HTML5, CSS3 — zero dependencies
- **Version Control**: Git
- **Build System**: None (single-file HTML, directly runnable in browser)
- **Asset Pipeline**: Procedural generation + inline SVG/canvas rendering

## Engine Version Reference

@docs/engine-reference/web-canvas/VERSION.md

## Project Structure

@.claude/docs/directory-structure.md

## Technical Preferences

@.claude/docs/technical-preferences.md

## Coordination Rules

@.claude/docs/coordination-rules.md

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question -> Options -> Decision -> Draft -> Approval**

- Agents MUST ask "May I write this to [filepath]?" before using Write/Edit tools
- Agents MUST show drafts or summaries before requesting approval
- Multi-file changes require explicit approval for the full changeset
- No commits without user instruction
- **Every new session starts with: run the tests first.** `npm test` before touching any code.
  If tests are already red, fix regressions before adding new features.
  (via @simonwillison — "First run the tests" establishes testing mindset from frame 1)

## Coding Standards

@.claude/docs/coding-standards.md

## AI Behavior Rules (adapted from @Karpathy CLAUDE.md)

These four principles override all other agent behavior rules when in conflict.

### 1. Think Before Coding（编码前思考）

- Don't assume. If a requirement is ambiguous, list the interpretations and ask.
- If there's a simpler approach, say so — push back on the user if needed.
- Surface tradeoffs: "方案 A 更快，方案 B 更灵活，你选哪个？"
- Never silently guess at intent.

### 2. Simplicity First（简洁优先）

- **Minimum code that solves the problem.** Nothing speculative.
- Don't add features nobody asked for. Don't build abstractions for one-off code.
- Don't add error handling for scenarios that can't happen.
- If a 50-line fix became 200 lines, rewrite it.
- **Test: "Would a senior dev call this over-engineered?"** — if yes, simplify.

### 3. Surgical Changes（手术式修改）

- **Touch ONLY files/lines directly related to the task.**
- Don't "clean up" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style even if you prefer a different one.
- If you notice unrelated dead code, **mention it** — don't delete it.
- **Test: Every changed line must trace back to the user's request.**

### 4. Goal-Driven Execution（目标驱动执行）

- Convert vague requests into verifiable goals:
  - "修 bug" → "写复现测试 → 修代码 → 测试变绿"
  - "加功能" → "写期望行为测试 → 实现 → 测试变绿"
- Multi-step tasks: each step has a verification checkpoint.
- **Don't ask "还要继续吗" — verify and report, then move on.**
- **Loop until verified, not until you think it's done.**

## Context Management

@.claude/docs/context-management.md
