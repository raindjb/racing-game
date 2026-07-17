// boss-effects.js — Boss 盲注运行时规则（纯逻辑，作用于 G）
import { G, bus, PHASES, setPhase } from './state.js';
import { discardFromHand } from './deck.js';
import { dispatchHook } from './effects/index.js';

/** 盲注开始时应用 Boss 静态规则（round.js 在发牌前调用） */
export function applyBossOnBlindStart() {
  const boss = G.boss;
  if (!boss || G.bossDisabled) return;
  G.bossState = {};
  switch (boss.fx) {
    case 'water':     G.discardsLeft = 0; break;
    case 'needle':    G.handsLeft = 1; break;
    case 'arm':       G.bossState.levelDelta = -1; break;
    case 'mouth':     G.bossState.lockedType = null; break;
    case 'manacle':   G.bossState.handSizeDelta = -1; break;
    case 'flint':     G.bossState.halveBase = true; break;
    case 'amber_acorn':
      G.rng.shuffle(G.jokers);        // 洗牌小丑顺序（视觉角度不反转，只打乱位置）
      break;
    case 'verdant_leaf':
      for (const c of G.deck) c.debuffed = true;
      for (const c of G.hand) c.debuffed = true;
      for (const c of G.discardPile) c.debuffed = true;
      break;
    case 'crimson_heart':
      G.bossState.heartDisabled = null;
      _crimsonHeartRandomDisable();
      break;
    case 'cerulean_bell':
      if (G.hand.length) {
        const forced = G.rng.pick(G.hand);
        G.bossState.forcedCard = forced.id;
        if (!G.selected.includes(forced.id)) G.selected.push(forced.id);
      }
      break;
  }
}

/** 每张牌进入手牌时（发牌钩子） */
export function applyBossOnCardDrawn(card) {
  const boss = G.boss;
  if (!boss || G.bossDisabled) return;
  switch (boss.fx) {
    case 'wheel': if (G.rng.chance(boss.flipChance)) card.faceDown = true; break;
    case 'suit_debuff': if (card.suit === boss.suit) card.debuffed = true; break;
    case 'fish': if (G.bossState.afterPlay) card.faceDown = true; break;
    case 'house': { if (!G.bossState.firstDrawDone) card.faceDown = true; break; }
    case 'mark': if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') card.faceDown = true; break;
    case 'plant': if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') card.debuffed = true; break;
    case 'pillar':
      if (G.bossState.pillarIds?.has(card.id)) card.debuffed = true;
      break;
  }
}
// 第一次发牌结束后标记
export function bossFirstDrawDone() {
  if (G.boss?.fx === 'house') G.bossState.firstDrawDone = true;
  if (G.boss?.fx === 'pillar') G.bossState.pillarIds = new Set();
}

/** 出牌合法性校验（拒绝时不消耗次数） */
export function validatePlay(cards, evalResult) {
  const boss = G.boss;
  if (!boss || G.bossDisabled) return { ok: true };
  if (boss.fx === 'psychic' && cards.length !== 5) return { ok: false, reason: '灵媒：必须打出 5 张牌' };
  if (boss.fx === 'eye' && G.roundPlayedTypes.includes(evalResult.handType)) return { ok: false, reason: '眼：不能重复打出同一种手型' };
  if (boss.fx === 'mouth' && G.bossState.lockedType && G.bossState.lockedType !== evalResult.handType) return { ok: false, reason: '嘴：本回合只能打出一种手型' };
  return { ok: true };
}

/** 出牌结算完成后触发（钩子/嘴/牛/牙/蛇/铃铛/心/柱子的状态推进） */
export function applyBossAfterPlay(evalResult) {
  const boss = G.boss;
  if (!boss || G.bossDisabled) return;
  // 嘴：锁定手型
  if (boss.fx === 'mouth' && !G.bossState.lockedType) G.bossState.lockedType = evalResult.handType;
  // 鱼：此后抽的牌背面朝上
  if (boss.fx === 'fish') G.bossState.afterPlay = true;
  // 钩子：随机弃 2 张
  if (boss.fx === 'hook') {
    const n = Math.min(2, G.hand.length);
    for (let i = 0; i < n; i++) {
      const c = G.hand[Math.floor(G.rng.random() * G.hand.length)];
      discardFromHand([c]);
    }
  }
  // 牛：打出最常用手型 → 金钱归零
  if (boss.fx === 'ox') {
    const best = Object.entries(G.handPlayed).sort((a, b) => b[1] - a[1])[0];
    if (best && evalResult.handType === best[0]) G.money = 0;
  }
  // 牙：每张计分牌 -$1
  if (boss.fx === 'tooth') {
    G.money = Math.max(0, G.money - evalResult.scoringCards.length);
    if (G.money <= 0) bus.emit('ui:reject', { reason: '牙：计分牌吃掉了你的钱!' });
  }
  // 绯红之心：出牌后禁用另一个随机小丑
  if (boss.fx === 'crimson_heart') _crimsonHeartRandomDisable();
  // 蔚蓝之铃：强制重选一张手牌
  if (boss.fx === 'cerulean_bell') _ceruleanBellForceCard();
  // 柱子：记录已打出牌，回流补抽时标记失效
  if (boss.fx === 'pillar') {
    G.bossState.pillarIds ??= new Set();
    for (const c of evalResult.scoringCards) G.bossState.pillarIds.add(c.id);
  }
}

/** 绯红之心：禁用一个随机非禁用 Joker（用 j.disabled 标志，resolveHandlers 读取） */
function _crimsonHeartRandomDisable() {
  for (const j of G.jokers) j.disabled = false;   // 每次换目标
  const cands = G.jokers;
  if (!cands.length) return;
  G.rng.pick(cands).disabled = true;
  bus.emit('jokers:change');
}

/** 蔚蓝之铃：始终强制选中一张牌 */
function _ceruleanBellForceCard() {
  const cur = G.bossState.forcedCard;
  if (cur && G.hand.some(c => c.id === cur)) return;
  if (!G.hand.length) return;
  G.bossState.forcedCard = G.rng.pick(G.hand).id;
  G.selected = [G.bossState.forcedCard];
}

/** 翠绿叶片：出售小丑后清除 debuff（由 joker-manager sellJoker 调用） */
export function clearVerdantOnSell() {
  if (G.boss?.fx === 'verdant_leaf' && !G.bossDisabled) {
    G.bossDisabled = true;
    for (const pile of [G.hand, G.deck, G.discardPile]) for (const c of pile) c.debuffed = false;
    bus.emit('ui:reject', { reason: '出售小丑解除了翠绿叶片!' });
  }
}
