// data/bosses.js — M1 Boss 盲注（10 个，覆盖不同机制类型）
export const BOSSES = [
  // ── M1（10） ──
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
  // ── M2 新增（18 → 28） ──
  { id: 'fish',    zh: '鱼',   desc: '出牌后手牌反面朝上', fx: 'fish' },
  { id: 'flint',   zh: '燧石', desc: '基础筹码和倍率减半', fx: 'flint' },
  { id: 'mark',    zh: '标记', desc: '所有人头牌面朝下发出', fx: 'mark' },
  { id: 'ox',      zh: '牛',   desc: '打出最常用手型时金钱归零', fx: 'ox' },
  { id: 'house',   zh: '房子', desc: '第一次发牌全部背面朝上', fx: 'house' },
  { id: 'manacle', zh: '镣铐', desc: '手牌上限 -1', fx: 'manacle' },
  { id: 'serpent', zh: '蛇',   desc: '每出/弃牌后始终抽满 3 张', fx: 'serpent' },
  { id: 'pillar',  zh: '柱子', desc: '本回合已打出过的牌不能再次计分', fx: 'pillar' },
  { id: 'goad',    zh: '刺棒', desc: '♦ 无效', fx: 'suit_debuff', suit: 'diamonds' },
  { id: 'head',    zh: '头',   desc: '♥ 无效', fx: 'suit_debuff', suit: 'hearts' },
  { id: 'window',  zh: '窗',   desc: '♠ 无效', fx: 'suit_debuff', suit: 'spades' },
  { id: 'tooth',   zh: '牙',   desc: '每次出牌 -$1 每张计分牌', fx: 'tooth' },
  { id: 'plant',   zh: '植物', desc: '所有人头牌失效', fx: 'plant' },
  // ── 终局 Boss（Ante 8 专用） ──
  { id: 'amber_acorn',  zh: '琥珀橡果', desc: '所有小丑牌反转并洗牌', fx: 'amber_acorn' },
  { id: 'verdant_leaf', zh: '翠绿叶片', desc: '所有牌失效，直至出售一张小丑牌', fx: 'verdant_leaf' },
  { id: 'violet_vessel',zh: '紫罗兰瓶', desc: '特大盲注（6 倍分数）', fx: 'violet_vessel', targetMult: 6 },
  { id: 'crimson_heart',zh: '绯红之心', desc: '每出牌一次随机禁用一张小丑牌', fx: 'crimson_heart' },
  { id: 'cerulean_bell',zh: '蔚蓝之铃', desc: '始终强制选择一张牌', fx: 'cerulean_bell' },
];

export const BOSS_MAP = Object.fromEntries(BOSSES.map(b => [b.id, b]));

const FINISHERS = new Set(['amber_acorn', 'verdant_leaf', 'violet_vessel', 'crimson_heart', 'cerulean_bell']);

/** 随机选 Boss：Ante 8 出终局 Boss，其余出普通 Boss（避开最近用过的） */
export function pickBoss(rng, recentIds = [], ante = 1) {
  const base = ante >= 8
    ? BOSSES.filter(b => FINISHERS.has(b.id))
    : BOSSES.filter(b => !FINISHERS.has(b.id));
  const pool = base.filter(b => !recentIds.includes(b.id));
  return rng.pick(pool.length ? pool : base);
}
