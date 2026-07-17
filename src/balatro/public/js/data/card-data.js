// card-data.js — 基础卡牌数据：花色/点数/手型/强化/版本/蜡封
//
// 数据模型与数值参考自 Balatrolator (https://github.com/kleinfreund/balatrolator)
// Copyright (c) Philipp Rudloff — MIT License（移植：TS→vanilla JS，字段本地化）
// 数值为 Balatro 公开游戏数值。

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];

export const SUIT_INFO = {
  spades:   { zh: '黑桃', symbol: '♠', color: 'black' },
  hearts:   { zh: '红桃', symbol: '♥', color: 'red' },
  diamonds: { zh: '方片', symbol: '♦', color: 'red' },
  clubs:    { zh: '梅花', symbol: '♣', color: 'black' },
};

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// order 用于顺子/比大小；chips 为牌面基础筹码
export const RANK_INFO = {
  '2':  { chips: 2,  order: 2 },
  '3':  { chips: 3,  order: 3 },
  '4':  { chips: 4,  order: 4 },
  '5':  { chips: 5,  order: 5 },
  '6':  { chips: 6,  order: 6 },
  '7':  { chips: 7,  order: 7 },
  '8':  { chips: 8,  order: 8 },
  '9':  { chips: 9,  order: 9 },
  '10': { chips: 10, order: 10 },
  'J':  { chips: 10, order: 11, face: true },
  'Q':  { chips: 10, order: 12, face: true },
  'K':  { chips: 10, order: 13, face: true },
  'A':  { chips: 11, order: 14 },
};

// 手型：id 顺序即判定优先级（高→低）。secret 手型 M2 解锁判定。
// lvChips/lvMult 为每级（星球牌）加成。
export const HAND_TYPES = [
  { id: 'flush_five',      zh: '同花五条', chips: 160, mult: 16, lvChips: 50, lvMult: 3, secret: true },
  { id: 'flush_house',     zh: '同花葫芦', chips: 140, mult: 14, lvChips: 40, lvMult: 4, secret: true },
  { id: 'five_of_a_kind',  zh: '五条',     chips: 120, mult: 12, lvChips: 35, lvMult: 3, secret: true },
  { id: 'straight_flush',  zh: '同花顺',   chips: 100, mult: 8,  lvChips: 40, lvMult: 4 },
  { id: 'four_of_a_kind',  zh: '四条',     chips: 60,  mult: 7,  lvChips: 30, lvMult: 3 },
  { id: 'full_house',      zh: '葫芦',     chips: 40,  mult: 4,  lvChips: 25, lvMult: 2 },
  { id: 'flush',           zh: '同花',     chips: 35,  mult: 4,  lvChips: 15, lvMult: 2 },
  { id: 'straight',        zh: '顺子',     chips: 30,  mult: 4,  lvChips: 30, lvMult: 3 },
  { id: 'three_of_a_kind', zh: '三条',     chips: 30,  mult: 3,  lvChips: 20, lvMult: 2 },
  { id: 'two_pair',        zh: '两对',     chips: 20,  mult: 2,  lvChips: 20, lvMult: 1 },
  { id: 'pair',            zh: '对子',     chips: 10,  mult: 2,  lvChips: 15, lvMult: 1 },
  { id: 'high_card',       zh: '高牌',     chips: 5,   mult: 1,  lvChips: 10, lvMult: 1 },
];

export const HAND_TYPE_MAP = Object.fromEntries(HAND_TYPES.map(h => [h.id, h]));

// 强化（8 种）
export const ENHANCEMENTS = {
  bonus: { zh: '奖励牌', desc: '计分时 +30 筹码', chips: 30 },
  mult:  { zh: '多倍牌', desc: '计分时 +4 倍率', mult: 4 },
  wild:  { zh: '万能牌', desc: '可视为任意花色' },
  glass: { zh: '玻璃牌', desc: '计分时 ×2 倍率，1/4 概率打出后碎裂', xmult: 2, breakChance: 0.25 },
  steel: { zh: '钢铁牌', desc: '留在手中时 ×1.5 倍率', heldXmult: 1.5 },
  stone: { zh: '石头牌', desc: '+50 筹码，无点数无花色，永远计分', chips: 50 },
  gold:  { zh: '黄金牌', desc: '回合结束时留在手中则 +$3', heldEndMoney: 3 },
  lucky: { zh: '幸运牌', desc: '1/5 概率 +20 倍率，1/15 概率 +$20',
           multChance: 0.2, multValue: 20, moneyChance: 1 / 15, moneyValue: 20 },
};

// 版本（4 种）
export const EDITIONS = {
  foil:        { zh: '闪箔',   desc: '+50 筹码', chips: 50 },
  holographic: { zh: '镭射',   desc: '+10 倍率', mult: 10 },
  polychrome:  { zh: '多彩',   desc: '×1.5 倍率', xmult: 1.5 },
  negative:    { zh: '负片',   desc: '+1 小丑牌槽位', jokerSlots: 1 },
};

// 蜡封（4 种）
export const SEALS = {
  red:    { zh: '红蜡封', desc: '该牌计分效果重复触发一次' },
  gold:   { zh: '金蜡封', desc: '打出并计分时 +$3', money: 3 },
  blue:   { zh: '蓝蜡封', desc: '回合结束留在手中时，生成本手型的星球牌' },
  purple: { zh: '紫蜡封', desc: '被弃置时生成一张塔罗牌' },
};

/** 卡牌工厂（引擎内唯一创建入口） */
let nextCardId = 1;
export function makeCard(suit, rank, opts = {}) {
  return {
    id: nextCardId++,
    suit, rank,
    enhancement: opts.enhancement ?? null,
    edition: opts.edition ?? null,
    seal: opts.seal ?? null,
    faceDown: false,   // Boss「车轮」等：背面朝上
    debuffed: false,   // Boss「棍棒」等：本回合失效
  };
}
export function resetCardIds() { nextCardId = 1; }
export function setNextCardId(n) { nextCardId = Math.max(1, n); }
export function peekNextCardId() { return nextCardId; }

/** 牌面筹码（石头牌固定 50，不看点数） */
export function cardBaseChips(card) {
  if (card.enhancement === 'stone') return ENHANCEMENTS.stone.chips;
  return RANK_INFO[card.rank].chips;
}

/** 点数序（石头牌无点数 → 0） */
export function cardOrder(card) {
  if (card.enhancement === 'stone') return 0;
  return RANK_INFO[card.rank].order;
}

/** 花色匹配（万能牌视为任意花色；石头牌无花色） */
export function cardHasSuit(card, suit) {
  if (card.enhancement === 'stone') return false;
  if (card.debuffed) return card.suit === suit; // 失效牌不享受万能
  if (card.enhancement === 'wild') return true;
  return card.suit === suit;
}

export function isFaceCard(card) {
  if (card.enhancement === 'stone') return false;
  return !!RANK_INFO[card.rank].face;
}
