// effects/joker-effects.js — Joker 效果编译器：把数据定义编译为 handler 并注册
// 每种 effect.type 是一个效果原语；M2 扩充 150 张时只需加数据（少数加原语）。
import { registerJoker } from './index.js';
import { JOKERS } from '../data/jokers.js';
import { cardHasSuit, isFaceCard, RANK_INFO } from '../data/card-data.js';
import { sellValue } from '../joker-manager.js';

/** 「手牌包含某手型」映射（原作规则：葫芦含对子和三条等） */
const CONTAINS = {
  pair: ['pair', 'two_pair', 'three_of_a_kind', 'full_house', 'four_of_a_kind', 'five_of_a_kind', 'flush_house', 'flush_five'],
  two_pair: ['two_pair', 'full_house', 'four_of_a_kind', 'five_of_a_kind', 'flush_house', 'flush_five'],
  three_of_a_kind: ['three_of_a_kind', 'full_house', 'four_of_a_kind', 'five_of_a_kind', 'flush_house', 'flush_five'],
  four_of_a_kind: ['four_of_a_kind', 'five_of_a_kind', 'flush_five'],
  straight: ['straight', 'straight_flush'],
  flush: ['flush', 'straight_flush', 'flush_house', 'flush_five'],
};
export function handContains(handType, req) {
  return (CONTAINS[req] ?? [req]).includes(handType);
}

const EVEN_RANKS = ['2', '4', '6', '8', '10'];
const ODD_RANKS = ['A', '3', '5', '7', '9'];

/** effect.type → handlers 编译表 */
const COMPILERS = {
  flat_mult: e => ({ onIndependent: (c, api, j) => api.addMult(e.v, src(j)) }),
  flat_chips: e => ({ onIndependent: (c, api, j) => api.addChips(e.v, src(j)) }),
  flat_xmult: e => ({ onIndependent: (c, api, j) => api.timesMult(e.x, src(j)) }),

  suit_scored_mult: e => ({ onScoredCard: (c, api, card, j) => {
    if (cardHasSuit(card, e.suit)) api.addMult(e.v, src(j)); } }),

  hand_cond: e => ({ onIndependent: (c, api, j) => {
    if (!handContains(c.handType, e.hand)) return;
    if (e.mult) api.addMult(e.mult, src(j));
    if (e.chips) api.addChips(e.chips, src(j)); } }),
  hand_cond_xmult: e => ({ onIndependent: (c, api, j) => {
    if (handContains(c.handType, e.hand)) api.timesMult(e.x, src(j)); } }),

  parity_mult: e => ({ onScoredCard: (c, api, card, j) => {
    const list = e.parity === 'even' ? EVEN_RANKS : ODD_RANKS;
    if (card.enhancement !== 'stone' && list.includes(card.rank)) api.addMult(e.v, src(j)); } }),
  parity_chips: e => ({ onScoredCard: (c, api, card, j) => {
    const list = e.parity === 'even' ? EVEN_RANKS : ODD_RANKS;
    if (card.enhancement !== 'stone' && list.includes(card.rank)) api.addChips(e.v, src(j)); } }),

  face_chips: e => ({ onScoredCard: (c, api, card, j) => {
    if (isFaceCard(card)) api.addChips(e.v, src(j)); } }),
  ranks_mult: e => ({ onScoredCard: (c, api, card, j) => {
    if (card.enhancement !== 'stone' && e.ranks.includes(card.rank)) api.addMult(e.v, src(j)); } }),
  face_money_chance: e => ({ onScoredCard: (c, api, card, j) => {
    if (isFaceCard(card) && c.rng.chance(e.p)) api.addMoney(e.v, src(j)); } }),
  suit_chance_xmult: e => ({ onScoredCard: (c, api, card, j) => {
    if (cardHasSuit(card, e.suit) && c.rng.chance(e.p)) api.timesMult(e.x, src(j)); } }),

  few_cards_mult: e => ({ onIndependent: (c, api, j) => {
    if (c.played.length <= e.maxCards) api.addMult(e.v, src(j)); } }),
  per_discard_chips: e => ({ onIndependent: (c, api, j) =>
    api.addChips(e.v * c.game.discardsLeft, src(j)) }),
  no_discards_mult: e => ({ onIndependent: (c, api, j) => {
    if (c.game.discardsLeft === 0) api.addMult(e.v, src(j)); } }),
  random_mult: e => ({ onIndependent: (c, api, j) =>
    api.addMult(c.rng.int(0, e.max), src(j), '错印!') }),
  lowest_held_mult: () => ({ onIndependent: (c, api, j) => {
    const held = c.heldCards.filter(x => x.enhancement !== 'stone');
    if (!held.length) return;
    const low = held.reduce((a, b) => RANK_INFO[a.rank].order <= RANK_INFO[b.rank].order ? a : b);
    api.addMult(RANK_INFO[low.rank].chips * 2, src(j)); } }),
  per_joker_mult: e => ({ onIndependent: (c, api, j) =>
    api.addMult(e.v * c.jokers.length, src(j)) }),
  per_deck_chips: e => ({ onIndependent: (c, api, j) =>
    api.addChips(e.v * c.game.deckCount, src(j)) }),
  per_money_chips: e => ({ onIndependent: (c, api, j) =>
    api.addChips(e.v * Math.max(0, c.game.money), src(j)) }),

  // ── 成长/计数型（j.state 持久于实例） ──
  green_joker: () => ({
    onIndependent: (c, api, j) => api.addMult(j.state, src(j)),
    onHandPlayed: (G, ev, j) => { j.state++; },
    onDiscard: (G, cards, j) => { j.state = Math.max(0, j.state - 1); },
  }),
  supernova: () => ({ onIndependent: (c, api, j) =>
    api.addMult((c.game.handPlayed[c.handType] ?? 0) + 1, src(j)) }),
  ride_the_bus: () => ({
    onIndependent: (c, api, j) => api.addMult(j.state, src(j)),
    onHandPlayed: (G, ev, j) => {
      if (ev.scoringCards.some(isFaceCard)) j.state = 0; else j.state++;
    },
  }),
  loyalty: e => ({
    onIndependent: (c, api, j) => {
      if (j.state % e.every === e.every - 1) api.timesMult(e.x, src(j), `会员卡 ×${e.x}!`);
    },
    onHandPlayed: (G, ev, j) => { j.state++; },
  }),
  egg: e => ({ onRoundEnd: (G, j) => { j.sellBonus = (j.sellBonus ?? 0) + e.v; return 0; } }),
  money_end: e => ({ onRoundEnd: () => e.v }),

  // ── 乘法条件 ──
  stencil: () => ({ onIndependent: (c, api, j) => {
    const empty = Math.max(0, c.game.jokerSlots - c.jokers.length) + 1; // 含自身
    if (empty > 1) api.timesMult(empty, src(j)); } }),
  blackboard: e => ({ onIndependent: (c, api, j) => {
    const ok = c.heldCards.every(x =>
      x.enhancement === 'stone' || cardHasSuit(x, 'spades') || cardHasSuit(x, 'clubs'));
    if (ok) api.timesMult(e.x, src(j)); } }),
  seeing_double: e => ({ onIndependent: (c, api, j) => {
    const hasClub = c.scoring.some(x => cardHasSuit(x, 'clubs'));
    const hasOther = c.scoring.some(x =>
      ['spades', 'hearts', 'diamonds'].some(s => cardHasSuit(x, s)));
    if (hasClub && hasOther) api.timesMult(e.x, src(j)); } }),
  final_hand_xmult: e => ({ onIndependent: (c, api, j) => {
    if (c.game.handsLeft === 0) api.timesMult(e.x, src(j)); } }),
  photograph: e => ({ onScoredCard: (c, api, card, j) => {
    if (isFaceCard(card) && !c._photoUsed) { c._photoUsed = true; api.timesMult(e.x, src(j)); } } }),

  // ── 重触发 ──
  retrigger_ranks: e => ({ retriggerScored: (c, card) =>
    (card.enhancement !== 'stone' && e.ranks.includes(card.rank)) ? 1 : 0 }),
  retrigger_faces: () => ({ retriggerScored: (c, card) => isFaceCard(card) ? 1 : 0 }),
  retrigger_final: () => ({ retriggerScored: c => c.game.handsLeft === 0 ? 1 : 0 }),
  retrigger_held: () => ({ retriggerHeld: () => 1 }),

  // ── 手持牌 ──
  held_rank_mult: e => ({ onHeldCard: (c, api, card, j) => {
    if (card.enhancement !== 'stone' && card.rank === e.rank) api.addMult(e.v, src(j)); } }),
  held_rank_xmult: e => ({ onHeldCard: (c, api, card, j) => {
    if (card.enhancement !== 'stone' && card.rank === e.rank) api.timesMult(e.x, src(j)); } }),

  // ── 出售价值联动 / 被动 ──
  swashbuckler: () => ({ onIndependent: (c, api, j) => {
    const v = c.jokers.filter(x => x !== j).reduce((s, x) => s + sellValue(x), 0);
    if (v) api.addMult(v, src(j)); } }),
  passive_hand_size: e => ({
    onAdded: G => { G.config.handSize += e.v; },
    onRemoved: G => { G.config.handSize -= e.v; },
  }),
  passive_discards: e => ({
    onAdded: G => { G.config.discards += e.v; G.discardsLeft += e.v; },
    onRemoved: G => { G.config.discards -= e.v; },
  }),
  stuntman: e => ({
    onIndependent: (c, api, j) => api.addChips(e.chips, src(j)),
    onAdded: G => { G.config.handSize += e.handSize; },
    onRemoved: G => { G.config.handSize -= e.handSize; },
  }),
};

function src(j) { return { kind: 'joker', id: j.uid ?? j.id }; }

// 注册全部 Joker（模块导入时执行一次）
for (const def of JOKERS) {
  const compile = COMPILERS[def.effect.type];
  if (!compile) {
    console.warn(`[balatro] 未实现的 Joker 效果原语: ${def.effect.type} (${def.id})`);
    continue;
  }
  registerJoker(def.id, compile(def.effect));
}
