// data/blinds.js — Ante 1-8 关卡数值（原作 White Stake 数值）。Ante 9+ 指数增长。
export const ANTE_MAX = 8;

// index = ante（1 起）。Ante 9+ 动态计算：50000 * 1.5^(ante-8)
export const ANTE_BASE = [null, 300, 800, 2000, 5000, 11000, 20000, 35000, 50000];

/** 获取 ante 基础分（支持 Ante 9+ 无尽模式） */
export function anteBase(ante) {
  if (ante <= ANTE_MAX) return ANTE_BASE[ante];
  return Math.floor(ANTE_BASE[ANTE_MAX] * Math.pow(1.5, ante - ANTE_MAX));
}

export const BLINDS = [
  { key: 'small', zh: '小盲注', icon: '○', mult: 1,   reward: 3 },
  { key: 'big',   zh: '大盲注', icon: '◎', mult: 1.5, reward: 4 },
  { key: 'boss',  zh: 'Boss盲注', icon: '☠', mult: 2, reward: 5 },
];

/** 盲注目标分（Boss 可覆盖倍率：墙 4×、针 1×）；返回前乘 config.blindScale */
export function blindTarget(ante, blindIndex, boss = null, config = null) {
  const base = anteBase(ante);
  const mult = blindIndex === 2 && boss?.targetMult ? boss.targetMult : BLINDS[blindIndex].mult;
  return Math.floor(base * mult * (config?.blindScale ?? 1));
}

/** 利息：每 $per 得 $1，封顶 cap */
export function interestOf(money, { interestPer = 5, interestCap = 5 } = {}) {
  return Math.min(interestCap, Math.floor(money / interestPer));
}
