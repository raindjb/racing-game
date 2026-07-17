// boss-effects.js — Boss 盲注运行时规则（纯逻辑，作用于 G）
import { G, bus } from './state.js';
import { discardFromHand } from './deck.js';

/** 盲注开始时应用 Boss 静态规则（round.js 在发牌前调用） */
export function applyBossOnBlindStart() {
  const boss = G.boss;
  if (!boss || G.bossDisabled) return;
  G.bossState = {};
  switch (boss.fx) {
    case 'water':  G.discardsLeft = 0; break;
    case 'needle': G.handsLeft = 1; break;
    case 'arm':    G.bossState.levelDelta = -1; break;
    case 'mouth':  G.bossState.lockedType = null; break;
  }
}

/** 每张牌进入手牌时（发牌钩子） */
export function applyBossOnCardDrawn(card) {
  const boss = G.boss;
  if (!boss || G.bossDisabled) return;
  if (boss.fx === 'wheel' && G.rng.chance(boss.flipChance)) card.faceDown = true;
  if (boss.fx === 'suit_debuff' && card.suit === boss.suit) card.debuffed = true;
}

/** 出牌合法性校验（拒绝时不消耗次数） */
export function validatePlay(cards, evalResult) {
  const boss = G.boss;
  if (!boss || G.bossDisabled) return { ok: true };
  if (boss.fx === 'psychic' && cards.length !== 5) {
    return { ok: false, reason: '灵媒：必须打出 5 张牌' };
  }
  if (boss.fx === 'eye' && G.roundPlayedTypes.includes(evalResult.handType)) {
    return { ok: false, reason: '眼：不能重复打出同一种手型' };
  }
  if (boss.fx === 'mouth' && G.bossState.lockedType && G.bossState.lockedType !== evalResult.handType) {
    return { ok: false, reason: '嘴：本回合只能打出一种手型' };
  }
  return { ok: true };
}

/** 出牌结算完成后触发（钩子/嘴的状态推进） */
export function applyBossAfterPlay(evalResult) {
  const boss = G.boss;
  if (!boss || G.bossDisabled) return;
  if (boss.fx === 'mouth' && !G.bossState.lockedType) {
    G.bossState.lockedType = evalResult.handType;
  }
  if (boss.fx === 'hook') {
    const n = Math.min(2, G.hand.length);
    const victims = [];
    for (let i = 0; i < n; i++) {
      victims.push(G.hand[Math.floor(G.rng.random() * G.hand.length)]);
      discardFromHand([victims[victims.length - 1]]);
    }
    if (victims.length) bus.emit('boss:hook', { cards: victims });
  }
}
