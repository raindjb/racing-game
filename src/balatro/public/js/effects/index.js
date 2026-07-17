// effects/index.js — Joker 效果注册中心（纯逻辑）
//
// Joker handler 钩子（全部可选）：
//   onScoredCard(ctx, api, card)  逐张计分牌触发（如花色倍率、人头牌加成）
//   onHeldCard(ctx, api, card)    结算时手持牌触发（如「男爵」类）
//   onIndependent(ctx, api)       独立触发（从左到右，Joker 主效果）
//   retriggerScored(ctx, card)→n  为计分牌提供额外触发次数
//   retriggerHeld(ctx, card)→n    为手持牌提供额外触发次数
//   onHandPlayed(ctx, joker)      出牌完成后（改内部计数，如「累积型」Joker）
//   onDiscard(ctx, cards)         弃牌时
//   onRoundEnd(ctx)→money         回合结束（经济类）
//   onBlindStart(ctx)             盲注开始
//
// ctx 见 scoring.js 的 buildContext；api 见 scoring.js 的 makeApi。

const registry = new Map(); // jokerId -> handlers

export function registerJoker(id, handlers) {
  registry.set(id, handlers);
}

export function getJokerHandlers(id) {
  return registry.get(id) ?? {};
}

export function clearRegistry() { registry.clear(); }

/** 计分牌总触发次数 = 1 + 红蜡封 + Joker 重触发 */
export function scoredCardTriggers(ctx, card) {
  let n = 1;
  if (card.seal === 'red' && !card.debuffed) n += 1;
  for (const j of ctx.jokers) {
    const h = getJokerHandlers(j.id);
    if (h.retriggerScored) n += h.retriggerScored(ctx, card, j) || 0;
  }
  return n;
}

/** 手持牌总触发次数 = 1 + 红蜡封 + Joker 重触发 */
export function heldCardTriggers(ctx, card) {
  let n = 1;
  if (card.seal === 'red' && !card.debuffed) n += 1;
  for (const j of ctx.jokers) {
    const h = getJokerHandlers(j.id);
    if (h.retriggerHeld) n += h.retriggerHeld(ctx, card, j) || 0;
  }
  return n;
}
