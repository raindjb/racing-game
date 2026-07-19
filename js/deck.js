// deck.js — 抽牌/弃牌/回收（纯逻辑）
import { G, bus } from './state.js';
import { dispatchHook } from './effects/index.js';

/** 从抽牌堆补满手牌（牌堆不足则能抽几张抽几张，不重洗——与原作一致）
 *  Boss「镣铐」：上限 -1；Boss「蛇」：出/弃后固定抽 3（round.js 传 limit） */
export function drawToHandSize(limit = Infinity) {
  const target = G.config.handSize + (G.bossState?.handSizeDelta ?? 0);
  const drawn = [];
  while (G.hand.length < target && G.deck.length > 0 && drawn.length < limit) {
    const card = G.deck.pop();
    G.hand.push(card);
    drawn.push(card);
  }
  if (drawn.length) bus.emit('cards:drawn', { cards: drawn });
  return drawn;
}

/** 把手牌中的指定牌移入弃牌堆 */
export function discardFromHand(cards) {
  for (const card of cards) {
    const i = G.hand.indexOf(card);
    if (i >= 0) {
      G.hand.splice(i, 1);
      G.discardPile.push(card);
    }
  }
  bus.emit('cards:discarded', { cards });
}

/** 回合结束回收：手牌+弃牌堆+打出区全部洗回抽牌堆 */
export function reclaimAll() {
  G.deck.push(...G.hand, ...G.discardPile, ...G.playedZone);
  G.hand = []; G.discardPile = []; G.playedZone = [];
  G.rng.shuffle(G.deck);
  // 清除回合内临时标记
  for (const c of G.deck) { c.faceDown = false; c.debuffed = false; }
}

/** 永久移除（玻璃碎裂等） */
export function destroyCards(cards) {
  for (const card of cards) {
    for (const pile of [G.deck, G.hand, G.discardPile, G.playedZone]) {
      const i = pile.indexOf(card);
      if (i >= 0) { pile.splice(i, 1); break; }
    }
    G.removedCards.push(card);
  }
  if (cards.length) {
    dispatchHook(G.jokers, 'onCardDestroyed', G, cards);
    bus.emit('cards:destroyed', { cards });
  }
}

/** 当前整副牌数量（含手/弃/打出，不含已销毁） */
export function totalDeckCount() {
  return G.deck.length + G.hand.length + G.discardPile.length + G.playedZone.length;
}
