---
name: parallel-agents-need-interface-contracts
description: Parallel agents produce incompatible code without precise shared interface specs — 12-agent 10k-line racing game failure + debugging lessons
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35eac173-0c29-4813-965d-cd26b188e27f
---

## 并行 Agent 开发的核心教训

**场景**：12 个 agent 并行写赛车游戏模块（10,000 行），结果接口互相不兼容。修复历经 10+ 轮。

**实际发生的冲突**：
- track.js 用伪 3D `worldToScreen(x, y, z)`，player.js 自己写了 2D `worldToScreen(x, y)`
- ai.js 坐标参数顺序是 `(x, z, y)`，其他模块是 `(x, y, z)`
- track.js 需要 16 个配置常量，config.js 一个没写
- engine.js 把按键存在 `R.input._keys`，input.js 用模块局部 `_keysDown`
- 三个模块用 `const R = window.R` 在不同 `<script>` 标签中重复声明导致 "Identifier 'R' has already been declared"
- player.js 的 local `worldToScreen` 被替换成 `function R.worldToScreen(...)`（非法语法：函数声明不能含点）
- ai.js 的 `worldToScreenPos` 函数头被删但函数体残留（裸 return 在模块作用域报错）

**根因**：只给了 20 行共享规范，没有精确接口文档。

**正确流程**：
1. 先写接口契约 — 精确的函数签名、参数顺序、返回值格式、坐标系约定
2. 所有 agent 对着接口文档实现
3. 验证阶段 — 拼装前检查每个模块是否遵守接口

## 修复过程中的调试教训

**字符串替换极易因空格不匹配而静默失败**：
- `sed` 和 `node.replace()` 的匹配字符串必须精确到每个空格
- 替换后必须 grep 验证结果，不能假设成功

**多行注释导致语法检查误报**：
- `/* =====...` 的开头行单独测试会报 "Invalid or unexpected token"
- 必须测试完整脚本才能确定是否真有语法错误

**`<script>` 标签不隔离 const/let**：
- 浏览器的不同 `<script>` 标签共享全局作用域
- `const R = window.R` 在第二个 script 中会报 "already been declared"
- 跨模块必须用 `var` 或 IIFE 包裹

**函数声明不能含点**：
- `function R.foo() {}` 是非法语法
- 动态挂载必须用 `R.foo = function() {}`

**修复策略**：
- 最佳：直接改模块源文件，再拼装
- 次佳：build 脚本处理内存中的代码再写入
- 最差：对拼装后的 HTML 做正则替换（行号偏移、多次匹配等问题多）

**How to apply:** 
- 并行派发 3+ agent 前，先产出接口文档再派发
- 用 build 脚本从源模块拼装，不要直接改 HTML
- 每次替换后 grep 验证
- 用完整脚本测试语法，不要逐行测（多行注释会导致误报）
