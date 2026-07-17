// hand-eval.js — 手型判定（纯函数，无状态依赖）
//
// Balatro 规则要点：
// - 石头牌不参与手型判定，但永远计分
// - 万能牌视为任意花色（同花判定）
// - 只有构成手型的牌计分（+石头牌），如打 5 张只中对子 → 仅对子+石头计分
// - 皇家同花顺不是独立手型：同花顺的 A 高显示变体（等级/星球共用同花顺）
// - 秘密手型（五条/同花葫芦/同花五条）需要复制牌（塔罗「死神」等）才可能出现
import { HAND_TYPE_MAP, cardOrder, cardHasSuit, SUITS } from './data/card-data.js';

/**
 * @param {Array} cards 打出的 1-5 张牌
 * @param {Object} opts { minStraightLen=5, minFlushLen=5 }（「四指」Joker M2 用 4）
 * @returns {{ handType:string, zh:string, scoringCards:Array }}
 */
export function evalHand(cards, opts = {}) {
  if (!cards || cards.length === 0) return null;

  const stones = cards.filter(c => c.enhancement === 'stone');
  const live = cards.filter(c => c.enhancement !== 'stone'); // 参与判定的牌

  // ── 点数统计 ──
  const byOrder = new Map(); // order -> cards[]
  for (const c of live) {
    const o = cardOrder(c);
    if (!byOrder.has(o)) byOrder.set(o, []);
    byOrder.get(o).push(c);
  }
  const groups = [...byOrder.values()].sort((a, b) => b.length - a.length || cardOrder(b[0]) - cardOrder(a[0]));
  const topCount = groups[0]?.length ?? 0;
  const secondCount = groups[1]?.length ?? 0;

  // ── 同花（万能牌灵活匹配；需全部 live 牌同一花色且数量达标） ──
  const minFlush = opts.minFlushLen ?? 5;
  const isFlush = live.length >= minFlush && stones.length === 0 &&
    SUITS.some(s => live.every(c => cardHasSuit(c, s)));

  // ── 顺子（5 个不同点数连续；A 可作 14 或轮子 A-2-3-4-5） ──
  const minStraight = opts.minStraightLen ?? 5;
  let isStraight = false, straightHigh = 0;
  if (live.length >= minStraight && stones.length === 0) {
    const orders = [...new Set(live.map(cardOrder))].sort((a, b) => a - b);
    if (orders.length === live.length) {
      if (orders[orders.length - 1] - orders[0] === orders.length - 1) {
        isStraight = true; straightHigh = orders[orders.length - 1];
      } else if (orders[orders.length - 1] === 14) {
        // A 作 1：A-2-3-4-5
        const low = orders.slice(0, -1);
        if (low[0] === 2 && low[low.length - 1] - low[0] === low.length - 1 && low.length === live.length - 1) {
          isStraight = true; straightHigh = 5;
        }
      }
    }
  }

  // ── 判定（高→低优先） ──
  let handType, structCards; // structCards = 构成手型的牌（不含石头）
  if (isFlush && topCount === 5) {
    handType = 'flush_five'; structCards = [...live];
  } else if (isFlush && topCount === 3 && secondCount === 2) {
    handType = 'flush_house'; structCards = [...live];
  } else if (topCount === 5) {
    handType = 'five_of_a_kind'; structCards = [...live];
  } else if (isFlush && isStraight) {
    handType = 'straight_flush'; structCards = [...live];
  } else if (topCount === 4) {
    handType = 'four_of_a_kind'; structCards = [...groups[0]];
  } else if (topCount === 3 && secondCount >= 2) {
    handType = 'full_house'; structCards = [...live];
  } else if (isFlush) {
    handType = 'flush'; structCards = [...live];
  } else if (isStraight) {
    handType = 'straight'; structCards = [...live];
  } else if (topCount === 3) {
    handType = 'three_of_a_kind'; structCards = [...groups[0]];
  } else if (topCount === 2 && secondCount === 2) {
    handType = 'two_pair'; structCards = [...groups[0], ...groups[1]];
  } else if (topCount === 2) {
    handType = 'pair'; structCards = [...groups[0]];
  } else {
    handType = 'high_card';
    structCards = live.length
      ? [live.reduce((best, c) => (cardOrder(c) > cardOrder(best) ? c : best))]
      : [];
  }

  // 计分牌 = 构成手型的牌 + 全部石头牌，保持打出顺序
  const structSet = new Set(structCards);
  const scoringCards = cards.filter(c => structSet.has(c) || c.enhancement === 'stone');

  // 显示名：A 高同花顺 → 皇家同花顺
  let zh = HAND_TYPE_MAP[handType].zh;
  if (handType === 'straight_flush' && straightHigh === 14) zh = '皇家同花顺';

  return { handType, zh, scoringCards };
}
