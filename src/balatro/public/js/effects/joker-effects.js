// effects/joker-effects.js — Joker 效果编译器：把数据定义编译为 handler 并注册
// 每种 effect.type 是一个效果原语；M2 扩充 150 张时只需加数据（少数加原语）。
import { registerJoker, isFaceCtx, cardSuitCtx, getJokerHandlers } from './index.js';
import { JOKERS } from '../data/jokers.js';
import { cardHasSuit, isFaceCard, RANK_INFO, RANKS, SUITS, makeCard } from '../data/card-data.js';
import { sellValue, makeJokerInstance, addJoker } from '../joker-manager.js';
import { makeConsumable, addConsumable, randomTarotId } from '../consumable-manager.js';
import { destroyCards } from '../deck.js';
import { evalHand } from '../hand-eval.js';
import { bus } from '../state.js';

/** 通知牌加入（全息影像等） */
function notifyCardAdded(G, card) {
  for (const j of G.jokers) getJokerHandlers(j.id).onCardAdded?.(G, card, j);
}

/** 自毁（冰淇淋融化/大米歇尔烂掉/苏打水用尽等） */
function selfDestroy(G, j) {
  const i = G.jokers.indexOf(j);
  if (i >= 0) {
    G.jokers.splice(i, 1);
    bus.emit('jokers:change');
    bus.emit('ui:reject', { reason: `「${j.zh}」消失了` });
  }
}

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
    if (cardSuitCtx(c.jokers, card, e.suit)) api.addMult(e.v, src(j)); } }),

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
    if (isFaceCtx(c.jokers, card)) api.addChips(e.v, src(j)); } }),
  ranks_mult: e => ({ onScoredCard: (c, api, card, j) => {
    if (card.enhancement !== 'stone' && e.ranks.includes(card.rank)) api.addMult(e.v, src(j)); } }),
  face_money_chance: e => ({ onScoredCard: (c, api, card, j) => {
    if (isFaceCtx(c.jokers, card) && c.rng.chance(e.p)) api.addMoney(e.v, src(j)); } }),
  suit_chance_xmult: e => ({ onScoredCard: (c, api, card, j) => {
    if (cardSuitCtx(c.jokers, card, e.suit) && c.rng.chance(e.p)) api.timesMult(e.x, src(j)); } }),

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
      if (ev.scoringCards.some(x => isFaceCtx(G.jokers, x))) j.state = 0; else j.state++;
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
    if (isFaceCtx(c.jokers, card) && !c._photoUsed) { c._photoUsed = true; api.timesMult(e.x, src(j)); } } }),

  // ── 重触发 ──
  retrigger_ranks: e => ({ retriggerScored: (c, card) =>
    (card.enhancement !== 'stone' && e.ranks.includes(card.rank)) ? 1 : 0 }),
  retrigger_faces: () => ({ retriggerScored: (c, card) => isFaceCtx(c.jokers, card) ? 1 : 0 }),
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

  // ── 机制类（效果由 evalOpts / isFaceCtx / cardSuitCtx 读取，自身无 handler） ──
  mechanic: () => ({ isMechanic: true }),
  // ── 复制委托（蓝图/头脑风暴） ──
  copy_right: () => ({ copy: 'right' }),
  copy_leftmost: () => ({ copy: 'leftmost' }),

  // ════ M2-B 批次原语 ════

  // ── 计分牌加成扩展 ──
  scored_rank_bonus: e => ({ onScoredCard: (c, api, card, j) => {
    if (card.enhancement !== 'stone' && e.ranks.includes(card.rank)) {
      if (e.chips) api.addChips(e.chips, src(j));
      if (e.mult) api.addMult(e.mult, src(j));
    } } }),
  face_mult: e => ({ onScoredCard: (c, api, card, j) => {
    if (isFaceCtx(c.jokers, card)) api.addMult(e.v, src(j)); } }),
  suit_scored_chips: e => ({ onScoredCard: (c, api, card, j) => {
    if (cardSuitCtx(c.jokers, card, e.suit)) api.addChips(e.v, src(j)); } }),
  suit_scored_money: e => ({ onScoredCard: (c, api, card, j) => {
    if (cardSuitCtx(c.jokers, card, e.suit)) api.addMoney(e.v, src(j)); } }),
  enh_scored_money: e => ({ onScoredCard: (c, api, card, j) => {
    if (card.enhancement === e.enh) api.addMoney(e.v, src(j)); } }),
  rank_chance_tarot: e => ({ onScoredCard: (c, api, card, j) => {
    if (card.rank === e.rank && card.enhancement !== 'stone' && c.rng.chance(e.p)) {
      if (addConsumable(makeConsumable('tarot', randomTarotId(c.rng)))) api.info(src(j), '生成塔罗!');
    } } }),

  // ── 轮换目标（每盲注随机） ──
  rotating_suit_xmult: e => ({
    onBlindStart: (G, j) => { j.target = G.rng.pick(SUITS); },
    onScoredCard: (c, api, card, j) => {
      if (j.target && cardSuitCtx(c.jokers, card, j.target)) api.timesMult(e.x, src(j));
    },
  }),
  rotating_card_xmult: e => ({
    onBlindStart: (G, j) => { j.target = { suit: G.rng.pick(SUITS), rank: G.rng.pick(RANKS) }; },
    onScoredCard: (c, api, card, j) => {
      if (j.target && card.suit === j.target.suit && card.rank === j.target.rank) api.timesMult(e.x, src(j));
    },
  }),

  // ── 永久成长（state 累积） ──
  grow_chips_on_rank: e => ({          // 小小丑：计分 2 → 永久 +8 筹
    onIndependent: (c, api, j) => api.addChips(j.state, src(j)),
    onHandPlayed: (G, ev, j) => { j.state += e.v * ev.scoringCards.filter(x => x.rank === e.rank && x.enhancement !== 'stone').length; },
  }),
  grow_chips_on_contains: e => ({      // 跑者：打出含顺子 → +15 筹
    onIndependent: (c, api, j) => api.addChips(j.state, src(j)),
    onHandPlayed: (G, ev, j) => { if (handContains(ev.handType, e.hand)) j.state += e.v; },
  }),
  grow_chips_on_size: e => ({          // 方块小丑：恰 4 张 → +4 筹
    onIndependent: (c, api, j) => api.addChips(j.state, src(j)),
    onHandPlayed: (G, ev, j) => { if (G.playedZone.length === e.size) j.state += e.v; },
  }),
  hiker: e => ({                       // 远足者：计分牌永久 +5 筹
    onHandPlayed: (G, ev, j) => { for (const c of ev.scoringCards) c.permChips = (c.permChips ?? 0) + e.v; },
  }),
  decay_chips_per_hand: e => ({        // 冰淇淋：+100 筹，每出牌 -5，归零消失
    onIndependent: (c, api, j) => api.addChips(Math.max(0, e.start - e.per * j.state), src(j)),
    onHandPlayed: (G, ev, j) => { j.state++; if (e.start - e.per * j.state <= 0) selfDestroy(G, j); },
  }),
  decay_mult_per_round: e => ({        // 爆米花：+20 倍，每回合 -4
    onIndependent: (c, api, j) => api.addMult(Math.max(0, e.start - e.per * j.state), src(j)),
    onRoundEnd: (G, j) => { j.state++; if (e.start - e.per * j.state <= 0) selfDestroy(G, j); return 0; },
  }),
  turtle_bean: e => ({                 // 龟豆：手牌 +5，每回合 -1
    onAdded: (G, j) => { j.state = e.start; G.config.handSize += e.start; },
    onRemoved: (G, j) => { G.config.handSize -= j.state; },
    onRoundEnd: (G, j) => {
      if (j.state > 0) { j.state--; G.config.handSize--; }
      if (j.state <= 0) selfDestroy(G, j);
      return 0;
    },
  }),

  // ── 成长型 ×倍率 ──
  grow_xmult_on_consumable: e => ({    // 星群：每用星球 ×+0.1
    onIndependent: (c, api, j) => { if (j.state) api.timesMult(1 + e.per * j.state, src(j)); },
    onConsumableUsed: (G, inst, j) => { if (inst.kind === e.kind) j.state++; },
  }),
  grow_xmult_on_card_added: e => ({    // 全息影像：每加牌入组 ×+0.25
    onIndependent: (c, api, j) => { if (j.state) api.timesMult(1 + e.per * j.state, src(j)); },
    onCardAdded: (G, card, j) => { j.state++; },
  }),
  grow_xmult_on_glass_break: e => ({   // 玻璃小丑：每碎玻璃 ×+0.75
    onIndependent: (c, api, j) => { if (j.state) api.timesMult(1 + e.per * j.state, src(j)); },
    onCardDestroyed: (G, cards, j) => { j.state += cards.filter(x => x.enhancement === 'glass').length; },
  }),
  grow_mult_on_reroll: e => ({         // 闪卡：每重掷 +2 倍
    onIndependent: (c, api, j) => api.addMult(e.per * j.state, src(j)),
    onReroll: (G, j) => { j.state++; },
  }),
  campfire: e => ({                    // 篝火：每卖 Joker ×+0.25，击败 Boss 重置
    onIndependent: (c, api, j) => { if (j.state) api.timesMult(1 + e.per * j.state, src(j)); },
    onJokerSold: (G, sold, j) => { j.state++; },
    onBossDefeated: (G, j) => { j.state = 0; },
  }),
  hit_the_road: e => ({                // 上路：本回合每弃 J ×+0.5
    onIndependent: (c, api, j) => { if (j.state) api.timesMult(1 + e.per * j.state, src(j)); },
    onDiscard: (G, cards, j) => { j.state += cards.filter(x => x.rank === 'J' && x.enhancement !== 'stone').length; },
    onBlindStart: (G, j) => { j.state = 0; },
  }),
  lucky_cat: e => ({                   // 招财猫：每次幸运触发 ×+0.25
    onIndependent: (c, api, j) => { if (j.state) api.timesMult(1 + e.per * j.state, src(j)); },
    onHandPlayed: (G, ev, j) => { j.state += G.lastPlay?.result?.luckyProcs ?? 0; },
  }),
  vampire: e => ({                     // 吸血鬼：吸收打出牌的强化 ×+0.1
    onIndependent: (c, api, j) => { if (j.state) api.timesMult(1 + e.per * j.state, src(j)); },
    onHandPlayed: (G, ev, j) => {
      for (const c of ev.scoringCards) {
        if (c.enhancement && c.enhancement !== 'stone') { c.enhancement = null; j.state++; }
      }
    },
  }),
  obelisk: e => ({                     // 方尖碑：连续打非最常用手型 ×+0.2
    onIndependent: (c, api, j) => { if (j.state) api.timesMult(1 + e.per * j.state, src(j)); },
    onHandPlayed: (G, ev, j) => {
      const max = Math.max(...Object.values(G.handPlayed));
      j.state = (G.handPlayed[ev.handType] ?? 0) >= max ? 0 : j.state + 1;
    },
  }),
  ceremonial_dagger: () => ({          // 仪式匕首：选盲注时吞右侧，卖价×2 入倍率
    onIndependent: (c, api, j) => api.addMult(j.state, src(j)),
    onBlindStart: (G, j) => {
      const i = G.jokers.indexOf(j);
      const victim = G.jokers[i + 1];
      if (victim) {
        j.state += sellValue(victim) * 2;
        G.jokers.splice(i + 1, 1);
        bus.emit('jokers:change');
      }
    },
  }),

  // ── 牌组构成 ──
  per_enh_chips: e => ({ onIndependent: (c, api, j) =>
    api.addChips(e.v * c.game.enhCounts[e.enh], src(j)) }),
  per_enh_xmult: e => ({ onIndependent: (c, api, j) => {
    const n = c.game.enhCounts[e.enh];
    if (n) api.timesMult(1 + e.per * n, src(j)); } }),
  enhanced_threshold_xmult: e => ({ onIndependent: (c, api, j) => {
    if (c.game.enhCounts.enhanced >= e.n) api.timesMult(e.x, src(j)); } }),

  // ── 计数联动 ──
  per_tarot_used_mult: e => ({ onIndependent: (c, api, j) =>
    api.addMult(e.v * c.game.tarotUsed, src(j)) }),
  per_money_mult: e => ({ onIndependent: (c, api, j) =>
    api.addMult(e.v * Math.floor(Math.max(0, c.game.money) / e.per), src(j)) }),

  // ── 经济（回合末/弃牌） ──
  money_end_per_9: e => ({ onRoundEnd: (G, j) =>
    [...G.deck, ...G.hand, ...G.discardPile].filter(c => c.rank === '9' && c.enhancement !== 'stone').length * e.v }),
  rocket: e => ({
    onRoundEnd: (G, j) => e.base + j.state,
    onBossDefeated: (G, j) => { j.state += e.perBoss; },
  }),
  gift_card: e => ({ onRoundEnd: (G, j) => {
    for (const x of G.jokers) x.sellBonus = (x.sellBonus ?? 0) + e.v;
    return 0; } }),
  extra_interest: e => ({ onRoundEnd: (G, j) =>
    Math.min(e.cap, Math.floor(Math.max(0, G.money) / 5)) }),
  per_unique_planet_money: e => ({ onRoundEnd: (G, j) =>
    (G.planetsUsed?.length ?? 0) * e.v }),
  delayed_gratification: e => ({ onRoundEnd: (G, j) =>
    G.discardsLeft === G.config.discards ? e.v * G.config.discards : 0 }),
  reserved_parking: e => ({ onRoundEnd: (G, j) => {
    let m = 0;
    for (const c of G.hand) if (isFaceCtx(G.jokers, c) && G.rng.chance(e.p)) m += e.v;
    return m; } }),
  discard_rank_money: e => ({          // 邮寄回扣：弃[轮换点数]每张 +$5
    onBlindStart: (G, j) => { j.target = G.rng.pick(RANKS); },
    onDiscard: (G, cards, j) => {
      const n = cards.filter(x => x.rank === j.target && x.enhancement !== 'stone').length;
      if (n) { G.money += e.v * n; bus.emit('ui:reject', { reason: `邮寄回扣 +$${e.v * n}` }); }
    },
  }),
  trading_card: e => ({                // 交换卡：首次弃单张 → 销毁+$3
    onDiscard: (G, cards, j) => {
      if (G.discardsLeft === G.config.discards - 1 && cards.length === 1) {
        destroyCards(cards);
        G.money += e.v;
      }
    },
  }),
  faceless_joker: e => ({ onDiscard: (G, cards, j) => {
    if (cards.filter(x => isFaceCtx(G.jokers, x)).length >= e.n) G.money += e.v; } }),
  matador: e => ({                     // 斗牛士（简化：Boss 回合每回合一次 +$8）
    onHandPlayed: (G, ev, j) => {
      if (G.blindIndex === 2 && G.boss && !G.bossDisabled && j.state !== G.round) {
        j.state = G.round; G.money += e.v;
      }
    },
  }),

  // ── 概率/一次性 ──
  gros_michel: e => ({
    onIndependent: (c, api, j) => api.addMult(e.v, src(j)),
    onRoundEnd: (G, j) => { if (G.rng.chance(e.destroyChance)) selfDestroy(G, j); return 0; },
  }),
  space_joker: e => ({ onHandPlayed: (G, ev, j) => {
    if (G.rng.chance(e.p)) G.handLevels[ev.handType] = (G.handLevels[ev.handType] ?? 1) + 1; } }),
  seltzer: e => ({
    retriggerScored: () => 1,
    onHandPlayed: (G, ev, j) => { j.state++; if (j.state >= e.uses) selfDestroy(G, j); },
  }),
  vagabond: e => ({ onHandPlayed: (G, ev, j) => {
    if (G.money <= e.threshold) addConsumable(makeConsumable('tarot', randomTarotId(G.rng))); } }),
  superposition: () => ({ onHandPlayed: (G, ev, j) => {
    if (handContains(ev.handType, 'straight') && ev.scoringCards.some(x => x.rank === 'A')) {
      addConsumable(makeConsumable('tarot', randomTarotId(G.rng)));
    } } }),
  midas_mask: () => ({ onHandPlayed: (G, ev, j) => {
    for (const c of ev.scoringCards) if (isFaceCtx(G.jokers, c) && c.enhancement !== 'stone') c.enhancement = 'gold'; } }),

  // ── 盲注开始 ──
  burglar: e => ({ onBlindStart: (G, j) => { G.handsLeft += e.hands; G.discardsLeft = 0; } }),
  riff_raff: e => ({ onBlindStart: (G, j) => {
    const owned = new Set(G.jokers.map(x => x.id));
    for (let i = 0; i < e.n; i++) {
      const pool = JOKERS.filter(x => x.rarity === 'common' && !owned.has(x.id));
      if (!pool.length) break;
      const inst = makeJokerInstance(G.rng.pick(pool).id);
      if (!addJoker(G, inst)) break;
      owned.add(inst.id);
    } } }),
  cartomancer: () => ({ onBlindStart: (G, j) => {
    addConsumable(makeConsumable('tarot', randomTarotId(G.rng))); } }),

  // ════ M2-C 批次原语（补满 150 + 传奇） ════

  // ── 计分修饰 ──
  erosion: e => ({ onIndependent: (c, api, j) => {
    const below = Math.max(0, 52 - c.game.totalDeckCount);
    if (below) api.addMult(e.v * below, src(j)); } }),
  flower_pot: e => ({ onIndependent: (c, api, j) => {
    const need = ['spades', 'hearts', 'diamonds', 'clubs'];
    if (need.every(s => c.scoring.some(x => cardSuitCtx(c.jokers, x, s)))) api.timesMult(e.x, src(j)); } }),
  card_sharp: e => ({ onIndependent: (c, api, j) => {
    if (c.game.roundPlayedTypes?.includes(c.handType)) api.timesMult(e.x, src(j)); } }),
  per_uncommon_xmult: e => ({ onIndependent: (c, api, j) => {   // 棒球卡
    for (const x of c.jokers) if (x !== j && x.rarity === 'uncommon') api.timesMult(e.x, src(j)); } }),
  throwback: e => ({ onIndependent: (c, api, j) => {
    const n = c.game.blindsSkipped ?? 0;
    if (n) api.timesMult(1 + e.per * n, src(j)); } }),
  hanging_chad: () => ({ retriggerScored: (c, card) => card === c.scoring[0] ? 2 : 0 }),
  ramen: e => ({
    onIndependent: (c, api, j) => api.timesMult(Math.max(1, 2 - e.per * j.state), src(j)),
    onDiscard: (G, cards, j) => { j.state += cards.length; if (2 - e.per * j.state <= 1) selfDestroy(G, j); },
  }),
  grow_mult_on_contains: e => ({       // 备用裤子：含两对 → +2 倍(累积)
    onIndependent: (c, api, j) => api.addMult(j.state, src(j)),
    onHandPlayed: (G, ev, j) => { if (handContains(ev.handType, e.hand)) j.state += e.v; },
  }),

  // ── 被动配置 ──
  merry_andy: e => ({
    onAdded: G => { G.config.discards += e.discards; G.discardsLeft += e.discards; G.config.handSize += e.handSize; },
    onRemoved: G => { G.config.discards -= e.discards; G.config.handSize -= e.handSize; },
  }),
  troubadour: e => ({
    onAdded: G => { G.config.handSize += e.handSize; G.config.hands += e.hands; },
    onRemoved: G => { G.config.handSize -= e.handSize; G.config.hands -= e.hands; },
  }),

  // ── 标记类（由 shop/round/scoring 读取） ──
  marker: () => ({ isMarker: true }),  // 全是6/主持人/天文学家/混沌小丑/骨头先生/信用卡

  // ── 盲注开始 ──
  marble_joker: () => ({ onBlindStart: (G, j) => {
    const card = makeCard(G.rng.pick(SUITS), G.rng.pick(RANKS), { enhancement: 'stone' });
    G.deck.splice(G.rng.int(0, Math.max(0, G.deck.length - 1)), 0, card);
    notifyCardAdded(G, card); } }),
  certificate: () => ({ onBlindStart: (G, j) => {
    const card = makeCard(G.rng.pick(SUITS), G.rng.pick(RANKS), { seal: G.rng.pick(['red', 'gold', 'blue', 'purple']) });
    G.hand.push(card);
    notifyCardAdded(G, card); } }),
  madness: e => ({
    onIndependent: (c, api, j) => { if (j.state) api.timesMult(1 + e.per * j.state, src(j)); },
    onBlindStart: (G, j) => {
      if (G.blindIndex < 2) {
        j.state++;
        const others = G.jokers.filter(x => x !== j);
        if (others.length) {
          const victim = G.rng.pick(others);
          G.jokers.splice(G.jokers.indexOf(victim), 1);
          bus.emit('jokers:change');
        }
      }
    },
  }),
  to_do_list: e => ({
    onBlindStart: (G, j) => { j.target = G.rng.pick(['high_card', 'pair', 'two_pair', 'three_of_a_kind', 'straight', 'flush']); },
    onHandPlayed: (G, ev, j) => { if (ev.handType === j.target) G.money += e.v; },
  }),

  // ── 弃牌联动 ──
  burnt_joker: () => ({ onDiscard: (G, cards, j) => {
    if (G.discardsLeft === G.config.discards - 1) {
      const ev = cards.length ? evalHand(cards) : null;
      if (ev) G.handLevels[ev.handType] = (G.handLevels[ev.handType] ?? 1) + 1;
    } } }),

  // ── 出售联动 ──
  invisible_joker: () => ({
    onRoundEnd: (G, j) => { j.state++; return 0; },
    onSelfSold: (G, j) => {
      if (j.state >= 2 && G.jokers.length > 1) {
        const others = G.jokers.filter(x => x !== j);
        const target = G.rng.pick(others);
        const dup = makeJokerInstance(target.id, { edition: target.edition });
        dup.state = target.state;
        addJoker(G, dup);
      }
    },
  }),
  diet_cola: () => ({ onSelfSold: (G, j) => {
    (G.pendingTags ??= []).push('double'); } }),
  luchador: () => ({ onSelfSold: (G, j) => {
    if (G.blindIndex === 2 && G.boss && !G.bossDisabled) {
      G.bossDisabled = true;
      for (const pile of [G.hand, G.deck, G.discardPile]) for (const c of pile) { c.debuffed = false; c.faceDown = false; }
      bus.emit('ui:reject', { reason: `摔跤手封印了「${G.boss.zh}」!` });
    } } }),

  // ── 出牌联动 ──
  dna: () => ({ onHandPlayed: (G, ev, j) => {
    if (G.handsLeft === G.config.hands - 1 && G.playedZone.length === 1) {
      const orig = G.playedZone[0];
      const copy = makeCard(orig.suit, orig.rank, { enhancement: orig.enhancement, edition: orig.edition, seal: orig.seal });
      G.hand.push(copy);
      notifyCardAdded(G, copy);
    } } }),
  sixth_sense: () => ({ onHandPlayed: (G, ev, j) => {
    if (G.handsLeft === G.config.hands - 1 && G.playedZone.length === 1
        && G.playedZone[0].rank === '6' && G.playedZone[0].enhancement !== 'stone') {
      destroyCards([G.playedZone[0]]);   // 幻灵生成：M2-D 接入
      G.pendingSpectral = (G.pendingSpectral ?? 0) + 1;
    } } }),
  seance: () => ({ onHandPlayed: (G, ev, j) => {
    if (ev.handType === 'straight_flush') G.pendingSpectral = (G.pendingSpectral ?? 0) + 1; } }),
  hallucination: e => ({ onPackOpened: (G, j) => {
    if (G.rng.chance(e.p)) addConsumable(makeConsumable('tarot', randomTarotId(G.rng))); } }),

  // ── 传奇 ──
  canio: () => ({
    onIndependent: (c, api, j) => { if (j.state) api.timesMult(1 + j.state, src(j)); },
    onCardDestroyed: (G, cards, j) => { j.state += cards.filter(x => isFaceCtx(G.jokers, x)).length; },
  }),
  triboulet: () => ({ onScoredCard: (c, api, card, j) => {
    if ((card.rank === 'K' || card.rank === 'Q') && card.enhancement !== 'stone') api.timesMult(2, src(j)); } }),
  yorick: e => ({
    onIndependent: (c, api, j) => { const lv = Math.floor((j.count ?? 0) / e.per); if (lv) api.timesMult(1 + lv, src(j)); },
    onDiscard: (G, cards, j) => { j.count = (j.count ?? 0) + cards.length; },
  }),
  perkeo: () => ({ onRoundEnd: (G, j) => {
    if (G.consumables.length) {
      const pick = G.rng.pick(G.consumables);
      addConsumable(makeConsumable(pick.kind, pick.id));
    }
    return 0; } }),
  chicot: () => ({ onBlindStart: (G, j) => {
    if (G.blindIndex === 2) {
      G.bossDisabled = true;
      for (const pile of [G.hand, G.deck, G.discardPile]) for (const c of pile) { c.debuffed = false; c.faceDown = false; }
    } } }),

  // ── 防守 / 弃牌成长 ──
  castle: e => ({
    onIndependent: (c, api, j) => api.addChips(j.state, src(j)),
    onBlindStart: (G, j) => { j.target = G.rng.pick(SUITS); },
    onDiscard: (G, cards, j) => {
      if (!j.target) return;
      j.state += cards.filter(x => cardSuitCtx(G.jokers, x, j.target) && x.enhancement !== 'stone').length * e.v;
    },
  }),
  red_card: e => ({
    onIndependent: (c, api, j) => api.addMult(j.state, src(j)),
    onBoosterSkipped: (G, j) => { j.state += e.v; },
  }),
};

// dispatchHookSafe → notifyCardAdded（见顶部）；evalHand 已静态导入

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
