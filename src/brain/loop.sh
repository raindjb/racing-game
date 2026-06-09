#!/bin/bash
# ROF 循环 — 每轮调用 claude 做一个任务，直到全部完成
# 用法: cd C:/Users/13751 && bash src/brain/loop.sh

set -e

PROJECT_DIR="src/brain"
PROMPT_FILE="$PROJECT_DIR/prompt.md"
TASKS_FILE="$PROJECT_DIR/tasks.json"
LOG_DIR="$PROJECT_DIR/logs"
MAX_ROUNDS=20

mkdir -p "$LOG_DIR"

count_pending() {
  node -e "
    import { readFileSync } from 'fs';
    const t = JSON.parse(readFileSync('$TASKS_FILE', 'utf-8'));
    console.log(t.tasks.filter(x => x.status === 'pending').length);
  " --input-type=module 2>/dev/null || echo "-1"
}

round=1
while [ $round -le $MAX_ROUNDS ]; do
  echo ""
  echo "========== 第 $round 轮 =========="

  pending=$(count_pending)

  if [ "$pending" = "0" ]; then
    echo "✅ 所有任务完成！"
    break
  fi

  if [ "$pending" = "-1" ]; then
    echo "❌ 读取 tasks.json 失败"
    exit 1
  fi

  echo "📋 剩余任务: $pending"

  # 本轮 prompt
  round_prompt="$(cat "$PROMPT_FILE")

---
当前是第 $round 轮。请读取 tasks.json 找到第一个 pending 任务并执行。完成后更新 tasks.json 中该任务的 status 为 done。"

  # 调用 claude 非交互模式
  echo "🤖 调用 claude..."
  claude -p "$round_prompt" \
    --allowedTools "Bash(npm *)" "Bash(node *)" "Bash(npx *)" "Bash(curl *)" "Bash(mkdir *)" "Bash(git *)" "Read" "Write" "Edit" \
    --model sonnet \
    2>&1 | tee "$LOG_DIR/round-$round.log"

  echo "📝 第 $round 轮完成，日志: $LOG_DIR/round-$round.log"

  round=$((round + 1))
done

if [ $round -gt $MAX_ROUNDS ]; then
  echo "⚠️  达到最大轮次 $MAX_ROUNDS，手动检查 tasks.json"
fi

echo ""
echo "========== 最终状态 =========="
cat "$TASKS_FILE"
