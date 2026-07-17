// data/bosses.js — M1 Boss 盲注（10 个，覆盖不同机制类型）
export const BOSSES = [
  { id: 'hook',    zh: '钩子', desc: '每次出牌后随机弃置 2 张手牌', fx: 'hook' },
  { id: 'wall',    zh: '墙',   desc: '特大盲注（4 倍分数）', fx: 'wall', targetMult: 4 },
  { id: 'eye',     zh: '眼',   desc: '本回合每种手型只能打出一次', fx: 'eye' },
  { id: 'mouth',   zh: '嘴',   desc: '本回合只能打出一种手型', fx: 'mouth' },
  { id: 'wheel',   zh: '车轮', desc: '1/7 的牌抽出时背面朝上', fx: 'wheel', flipChance: 1 / 7 },
  { id: 'arm',     zh: '手臂', desc: '打出的手型以低 1 级结算', fx: 'arm' },
  { id: 'club',    zh: '棍棒', desc: '所有梅花牌失效', fx: 'suit_debuff', suit: 'clubs' },
  { id: 'psychic', zh: '灵媒', desc: '必须打出 5 张牌', fx: 'psychic' },
  { id: 'water',   zh: '水',   desc: '弃牌次数变为 0', fx: 'water' },
  { id: 'needle',  zh: '针',   desc: '只有 1 次出牌机会', fx: 'needle', targetMult: 1 },
];

export const BOSS_MAP = Object.fromEntries(BOSSES.map(b => [b.id, b]));

/** 随机选 Boss（避开最近用过的） */
export function pickBoss(rng, recentIds = []) {
  const pool = BOSSES.filter(b => !recentIds.includes(b.id));
  return rng.pick(pool.length ? pool : BOSSES);
}
