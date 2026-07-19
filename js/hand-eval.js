// hand-eval.js — 手型判定（纯函数）
//
// opts（由持有的机制类 Joker 决定，round.evalOptsFromJokers 组装）：
//   minStraightLen / minFlushLen : 4 =「四指」
//   shortcut : 顺子允许隔 1 点（相邻差 ≤2）=「捷径」
//   smeared  : ♥♦ 同色、♠♣ 同色 =「涂抹小丑」
//   splash   : 全部打出的牌计分 =「溅射」
//
// 其余规则：石头牌不参与判定但永远计分；万能牌任意花色；只有构成手型的牌计分；
// 皇家同花顺 = 同花顺的 A 高显示变体；秘密手型需复制牌才可能出现。
import { HAND_TYPE_MAP, cardOrder, cardHasSuit, SUITS } from './data/card-data.js';

export function evalHand(cards, opts = {}) {
  if (!cards || cards.length === 0) return null;
  const minS = opts.minStraightLen ?? 5;
  const minF = opts.minFlushLen ?? 5;

  const stones = cards.filter(c => c.enhancement === 'stone');
  const live = cards.filter(c => c.enhancement !== 'stone');

  const suitOK = (c, s) => {
    if (!opts.smeared) return cardHasSuit(c, s);
    if (c.enhancement === 'stone') return false;
    if (c.enhancement === 'wild' && !c.debuffed) return true;
    const RED = ['hearts', 'diamonds'];
    return (RED.includes(s) ? RED : ['spades', 'clubs']).includes(c.suit);
  };

  // ── 点数统计 ──
  const byOrder = new Map();
  for (const c of live) {
    const o = cardOrder(c);
    if (!byOrder.has(o)) byOrder.set(o, []);
    byOrder.get(o).push(c);
  }
  const groups = [...byOrder.values()]
    .sort((a, b) => b.length - a.length || cardOrder(b[0]) - cardOrder(a[0]));
  const topCount = groups[0]?.length ?? 0;
  const secondCount = groups[1]?.length ?? 0;

  // ── 同花：取最佳花色子集（≥ minF） ──
  let flushCards = null;
  if (live.length >= minF) {
    for (const s of SUITS) {
      const m = live.filter(c => suitOK(c, s));
      if (m.length >= minF && (!flushCards || m.length > flushCards.length)) flushCards = m;
    }
  }
  const isFlush = !!flushCards;

  // ── 顺子：最长链（相邻差 ≤ maxGap），支持 A 低位 ──
  let straightCards = null;
  if (live.length >= minS) {
    const maxGap = opts.shortcut ? 2 : 1;
    const oneOf = new Map(); // order → 代表牌
    for (const c of live) { const o = cardOrder(c); if (!oneOf.has(o)) oneOf.set(o, c); }
    const bestChain = ords => {
      let best = null, start = 0;
      for (let i = 1; i <= ords.length; i++) {
        if (i === ords.length || ords[i] - ords[i - 1] > maxGap) {
          const seg = ords.slice(start, i);
          if (seg.length >= minS && (!best || seg.length > best.length)) best = seg;
          start = i;
        }
      }
      return best;
    };
    const orders = [...oneOf.keys()].sort((a, b) => a - b);
    let chain = bestChain(orders);
    if (!chain && oneOf.has(14)) {
      const low = [1, ...orders.filter(o => o !== 14)].sort((a, b) => a - b);
      const c2 = bestChain(low);
      if (c2 && c2.includes(1)) chain = c2.map(o => (o === 1 ? 14 : o));
    }
    if (chain) straightCards = chain.map(o => oneOf.get(o));
  }
  const isStraight = !!straightCards;

  // 同花顺：顺子链全部落在同花子集内
  const sfOK = isFlush && isStraight && straightCards.every(c => flushCards.includes(c));

  // ── 判定（高→低） ──
  let handType, structCards;
  if (isFlush && topCount === 5) {
    handType = 'flush_five'; structCards = [...live];
  } else if (isFlush && flushCards.length === 5 && topCount === 3 && secondCount === 2) {
    handType = 'flush_house'; structCards = [...live];
  } else if (topCount === 5) {
    handType = 'five_of_a_kind'; structCards = [...live];
  } else if (sfOK) {
    handType = 'straight_flush'; structCards = [...straightCards];
  } else if (topCount === 4) {
    handType = 'four_of_a_kind'; structCards = [...groups[0]];
  } else if (topCount === 3 && secondCount >= 2) {
    handType = 'full_house'; structCards = [...live];
  } else if (isFlush) {
    handType = 'flush'; structCards = [...flushCards];
  } else if (isStraight) {
    handType = 'straight'; structCards = [...straightCards];
  } else if (topCount === 3) {
    handType = 'three_of_a_kind'; structCards = [...groups[0]];
  } else if (topCount === 2 && secondCount === 2) {
    handType = 'two_pair'; structCards = [...groups[0], ...groups[1]];
  } else if (topCount === 2) {
    handType = 'pair'; structCards = [...groups[0]];
  } else {
    handType = 'high_card';
    structCards = live.length
      ? [live.reduce((a, b) => (cardOrder(a) >= cardOrder(b) ? a : b))]
      : [];
  }

  // 计分牌：溅射 → 全部；否则 构成手型的牌 + 石头，保持打出顺序
  let scoringCards;
  if (opts.splash) {
    scoringCards = [...cards];
  } else {
    const structSet = new Set(structCards);
    scoringCards = cards.filter(c => structSet.has(c) || c.enhancement === 'stone');
  }

  // 显示名：同花顺含 K+A → 皇家同花顺
  let zh = HAND_TYPE_MAP[handType].zh;
  if (handType === 'straight_flush') {
    const os = straightCards.map(cardOrder);
    if (os.includes(14) && os.includes(13)) zh = '皇家同花顺';
  }

  return { handType, zh, scoringCards };
}
