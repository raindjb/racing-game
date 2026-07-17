// rng.js — Mulberry32 seeded RNG（种子可复现，供牌组/商店/概率效果统一使用）

/** 字符串 → 32 位种子（xmur3 简化版） */
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** 创建 seeded RNG。seed 可为字符串或 uint32。 */
export function createRng(seed) {
  let a = typeof seed === 'string' ? hashSeed(seed) : (seed >>> 0);
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    /** [0,1) */
    random: next,
    /** [min,max] 整数 */
    int(min, max) { return min + Math.floor(next() * (max - min + 1)); },
    /** 随机取一个元素 */
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    /** Fisher-Yates 原地洗牌，返回同一数组 */
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    /** 概率 p ∈ [0,1] 是否命中 */
    chance(p) { return next() < p; },
    /** 当前内部状态（存档用） */
    getState() { return a >>> 0; },
    setState(s) { a = s >>> 0; },
  };
}

/** 生成随机种子字符串（新开局用，8 位大写字母数字，仿原作） */
export function randomSeedString() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
