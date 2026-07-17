// effects/index.js — Joker 效果注册中心 + 复制委托 + 上下文判定助手（纯逻辑）
//
// handler 钩子（全部可选）：
//   onScoredCard / onHeldCard / onIndependent / retriggerScored / retriggerHeld
//   onHandPlayed / onDiscard / onRoundEnd / onBlindStart
//   onBlindSkipped / onBoosterSkipped / onReroll / onConsumableUsed
//   onCardDestroyed / onJokerSold / onAdded / onRemoved
//   copy: 'right' | 'leftmost'   —— 蓝图/头脑风暴：委托到目标 Joker 的 handlers
import { isFaceCard, cardHasSuit } from '../data/card-data.js';

const registry = new Map(); // jokerId -> handlers

export function registerJoker(id, handlers) { registry.set(id, handlers); }
export function getJokerHandlers(id) { return registry.get(id) ?? {}; }
export function clearRegistry() { registry.clear(); }

/**
 * 解析 Joker 的实际 handlers（跟随复制链，最多 3 层，带环路保护）。
 * 复制目标仍是复制者 → 空效果（与原作：蓝图指向蓝图链合法，环断掉）。
 */
export function resolveHandlers(jokers, j, depth = 0) {
  const h = getJokerHandlers(j.id);
  if (!h.copy) return h;
  if (depth >= 3) return {};
  let target = null;
  if (h.copy === 'right') {
    const i = jokers.indexOf(j);
    target = i >= 0 ? jokers[i + 1] : null;
  } else if (h.copy === 'leftmost') {
    target = jokers[0] === j ? null : jokers[0];
  }
  if (!target || target === j) return {};
  return resolveHandlers(jokers, target, depth + 1);
}

/** 人头判定（「万物有脸」：所有非石头牌视为人头） */
export function isFaceCtx(jokers, card) {
  if (card.enhancement === 'stone') return false;
  if (jokers?.some(j => j.id === 'pareidolia')) return true;
  return isFaceCard(card);
}

/** 花色判定（「涂抹小丑」：♥♦ 同色、♠♣ 同色） */
export function cardSuitCtx(jokers, card, suit) {
  if (jokers?.some(j => j.id === 'smeared_joker')) {
    if (card.enhancement === 'stone') return false;
    if (card.enhancement === 'wild' && !card.debuffed) return true;
    const RED = ['hearts', 'diamonds'];
    const grp = RED.includes(suit) ? RED : ['spades', 'clubs'];
    return grp.includes(card.suit);
  }
  return cardHasSuit(card, suit);
}

/** 计分牌总触发次数 = 1 + 红蜡封 + Joker 重触发（经复制解析） */
export function scoredCardTriggers(ctx, card) {
  let n = 1;
  if (card.seal === 'red' && !card.debuffed) n += 1;
  for (const j of ctx.jokers) {
    const h = resolveHandlers(ctx.jokers, j);
    if (h.retriggerScored) n += h.retriggerScored(ctx, card, j) || 0;
  }
  return n;
}

/** 手持牌总触发次数 */
export function heldCardTriggers(ctx, card) {
  let n = 1;
  if (card.seal === 'red' && !card.debuffed) n += 1;
  for (const j of ctx.jokers) {
    const h = resolveHandlers(ctx.jokers, j);
    if (h.retriggerHeld) n += h.retriggerHeld(ctx, card, j) || 0;
  }
  return n;
}

/** 生命周期分发助手：对每个 Joker 调用（经复制解析的）钩子 */
export function dispatchHook(jokers, hook, ...args) {
  let acc = 0;
  for (const j of jokers) {
    const h = resolveHandlers(jokers, j);
    const r = h[hook]?.(...args, j);
    if (typeof r === 'number') acc += r;
  }
  return acc;
}
