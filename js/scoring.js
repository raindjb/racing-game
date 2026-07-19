// scoring.js — 计分管线（纯函数）
//
// 结算顺序（严格按原作）：
//   1. 手型基础筹码/倍率（含星球等级，Boss「手臂」临时降级）
//   2. 逐张计分牌 从左到右（×触发次数：红蜡封/Joker 重触发）：
//      牌面筹码 → 强化(奖励/多倍/玻璃/幸运/石头) → 版本(闪箔/镭射/多彩) → 金蜡封$ → Joker 逐张钩子
//   3. 手持牌（钢铁 ×1.5 等，×触发次数）+ Joker 手持钩子
//   4. Joker 从左到右：闪箔/镭射版本 → 主效果 → 多彩版本
//   5. score = floor(chips × mult)
//
// 计分逻辑参考 Balatrolator (https://github.com/kleinfreund/balatrolator, MIT)。
import { HAND_TYPE_MAP, ENHANCEMENTS, EDITIONS, cardBaseChips } from './data/card-data.js';
import { resolveHandlers, scoredCardTriggers, heldCardTriggers } from './effects/index.js';

/**
 * 从游戏状态构建计分上下文（round.js 调用；测试可手工构造）
 * @returns ctx
 */
export function buildContext(G, evalResult, playedCards) {
  const owned = [...G.deck, ...G.hand, ...G.discardPile, ...playedCards];
  // 「全是 6!」：概率翻倍（可叠加）
  const oops = G.jokers.filter(j => j.id === 'oops_all_6s').length;
  const rng = oops
    ? { ...G.rng, chance: p => G.rng.chance(Math.min(1, p * 2 ** oops)) }
    : G.rng;
  return {
    played: playedCards,
    scoring: evalResult.scoringCards,
    handType: evalResult.handType,
    handZh: evalResult.zh,
    handLevels: G.handLevels,
    levelDelta: G.bossState?.levelDelta ?? 0, // Boss「手臂」
    halveBase: G.bossState?.halveBase && !G.bossDisabled, // Boss「燧石」
    jokers: G.jokers,
    heldCards: G.hand.filter(c => !playedCards.includes(c)),
    rng,
    game: {
      money: G.money,
      handsLeft: G.handsLeft,
      discardsLeft: G.discardsLeft,
      deckCount: G.deck.length,
      ante: G.ante,
      handPlayed: G.handPlayed,
      jokerSlots: G.config.jokerSlots + G.jokers.filter(j => j.edition === 'negative').length,
      totalDeckCount: owned.length,
      roundPlayedTypes: G.roundPlayedTypes,
      blindsSkipped: G.blindsSkipped ?? 0,
      tarotUsed: G.tarotUsedCount ?? 0,
      enhCounts: {
        stone: owned.filter(c => c.enhancement === 'stone').length,
        steel: owned.filter(c => c.enhancement === 'steel').length,
        enhanced: owned.filter(c => c.enhancement).length,
      },
    },
  };
}

/** 结算一手牌。返回 { chips, mult, score, steps, moneyDelta, destroyed } */
export function scoreHand(ctx) {
  let chips = 0, mult = 0, moneyDelta = 0, luckyProcs = 0;
  const steps = [];      // 逐步日志：UI 按序重放动画
  const destroyed = [];  // 玻璃碎裂等待销毁的牌
  const halveBase = ctx.halveBase;    // Boss「燧石」

  const api = {
    get chips() { return chips; },
    get mult() { return mult; },
    addChips(v, source, label) { if (!v) return; chips += v; steps.push({ type: 'chips', value: v, source, label: label ?? `+${v} 筹码` }); },
    addMult(v, source, label) { if (!v) return; mult += v; steps.push({ type: 'mult', value: v, source, label: label ?? `+${v} 倍率` }); },
    timesMult(v, source, label) { if (!v || v === 1) return; mult = Math.round(mult * v * 100) / 100; steps.push({ type: 'xmult', value: v, source, label: label ?? `×${v} 倍率` }); },
    addMoney(v, source, label) { if (!v) return; moneyDelta += v; steps.push({ type: 'money', value: v, source, label: label ?? `+$${v}` }); },
    info(source, label) { steps.push({ type: 'info', value: 0, source, label }); },
  };

  // ── 1. 手型基础值（等级从 1 起；「手臂」降级不低于 1） ──
  const ht = HAND_TYPE_MAP[ctx.handType];
  const level = Math.max(1, (ctx.handLevels[ctx.handType] ?? 1) + (ctx.levelDelta ?? 0));
  chips = ht.chips + ht.lvChips * (level - 1);
  mult = ht.mult + ht.lvMult * (level - 1);
  if (halveBase) { chips = Math.ceil(chips / 2); mult = Math.ceil(mult / 2); }
  steps.push({ type: 'base', value: 0, source: { kind: 'base' }, label: `${ctx.handZh} Lv.${level}`, chips, mult });

  // ── 2. 逐张计分牌 ──
  for (const card of ctx.scoring) {
    if (card.debuffed) { api.info({ kind: 'card', id: card.id }, '失效'); continue; }
    const triggers = scoredCardTriggers(ctx, card);
    for (let t = 0; t < triggers; t++) {
      const src = { kind: 'card', id: card.id, retrigger: t > 0 };
      if (t > 0) api.info(src, '重触发!');
      // 牌面筹码
      api.addChips(cardBaseChips(card), src);
      // 强化
      const enh = card.enhancement;
      if (enh === 'bonus') api.addChips(ENHANCEMENTS.bonus.chips, src);
      else if (enh === 'mult') api.addMult(ENHANCEMENTS.mult.mult, src);
      else if (enh === 'glass') api.timesMult(ENHANCEMENTS.glass.xmult, src);
      else if (enh === 'lucky') {
        if (ctx.rng.chance(ENHANCEMENTS.lucky.multChance)) { luckyProcs++; api.addMult(ENHANCEMENTS.lucky.multValue, src, '幸运! +20 倍率'); }
        if (ctx.rng.chance(ENHANCEMENTS.lucky.moneyChance)) { luckyProcs++; api.addMoney(ENHANCEMENTS.lucky.moneyValue, src, '幸运! +$20'); }
      }
      // 版本
      const ed = card.edition;
      if (ed === 'foil') api.addChips(EDITIONS.foil.chips, src);
      else if (ed === 'holographic') api.addMult(EDITIONS.holographic.mult, src);
      else if (ed === 'polychrome') api.timesMult(EDITIONS.polychrome.xmult, src);
      // 金蜡封
      if (card.seal === 'gold') api.addMoney(3, src, '金蜡封 +$3');
      // Joker 逐张钩子（从左到右，经复制解析）
      for (const j of ctx.jokers) {
        resolveHandlers(ctx.jokers, j).onScoredCard?.(ctx, api, card, j);
      }
    }
    // 玻璃碎裂判定（每张打出的玻璃牌结算后掷一次）
    if (card.enhancement === 'glass' && !card.debuffed && ctx.rng.chance(ENHANCEMENTS.glass.breakChance)) {
      destroyed.push(card);
      api.info({ kind: 'card', id: card.id }, '玻璃碎裂!');
    }
  }

  // ── 3. 手持牌 ──
  for (const card of ctx.heldCards) {
    if (card.debuffed) continue;
    const hasSteel = card.enhancement === 'steel';
    const hasHooks = ctx.jokers.some(j => resolveHandlers(ctx.jokers, j).onHeldCard);
    if (!hasSteel && !hasHooks) continue;
    const triggers = heldCardTriggers(ctx, card);
    for (let t = 0; t < triggers; t++) {
      const src = { kind: 'held', id: card.id, retrigger: t > 0 };
      if (hasSteel) api.timesMult(ENHANCEMENTS.steel.heldXmult, src, '钢铁 ×1.5');
      for (const j of ctx.jokers) {
        resolveHandlers(ctx.jokers, j).onHeldCard?.(ctx, api, card, j);
      }
    }
  }

  // ── 4. Joker 独立效果（从左到右；版本：闪箔/镭射先、多彩后；复制解析） ──
  for (const j of ctx.jokers) {
    const src = { kind: 'joker', id: j.uid ?? j.id };
    if (j.edition === 'foil') api.addChips(EDITIONS.foil.chips, src);
    else if (j.edition === 'holographic') api.addMult(EDITIONS.holographic.mult, src);
    resolveHandlers(ctx.jokers, j).onIndependent?.(ctx, api, j);
    if (j.edition === 'polychrome') api.timesMult(EDITIONS.polychrome.xmult, src);
  }

  // ── 5. 最终 ──
  const score = Math.floor(chips * mult);
  return { chips, mult, score, steps, moneyDelta, destroyed, luckyProcs };
}
