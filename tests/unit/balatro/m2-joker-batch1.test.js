import { describe, test, expect } from 'vitest';
import '../../../src/balatro/public/js/effects/joker-effects.js';
import { evalHand } from '../../../src/balatro/public/js/hand-eval.js';
import { scoreHand } from '../../../src/balatro/public/js/scoring.js';
import { makeCard, HAND_TYPES } from '../../../src/balatro/public/js/data/card-data.js';
import { makeJokerInstance, addJoker, sellJoker } from '../../../src/balatro/public/js/joker-manager.js';
import { getJokerHandlers } from '../../../src/balatro/public/js/effects/index.js';
import { G, initRun } from '../../../src/balatro/public/js/state.js';
import { makeConsumable, addConsumable, useConsumable } from '../../../src/balatro/public/js/consumable-manager.js';
import { rerollShop } from '../../../src/balatro/public/js/shop.js';

const mk = (suit, rank, opts) => makeCard(suit, rank, opts);
const J = (id, patch = {}) => Object.assign(makeJokerInstance(id), patch);
const pairOf9 = () => [mk('spades', '9'), mk('hearts', '9')];

function ctxOf(cards, { jokers = [], held = [], evalOpts = {}, game = {} } = {}) {
  const ev = evalHand(cards, evalOpts);
  return {
    played: cards, scoring: ev.scoringCards, handType: ev.handType, handZh: ev.zh,
    handLevels: Object.fromEntries(HAND_TYPES.map(h => [h.id, 1])),
    levelDelta: 0, jokers, heldCards: held,
    rng: { chance: () => false, random: () => 0.5, int: () => 0, pick: a => a[0] },
    game: { money: 0, handsLeft: 3, discardsLeft: 2, deckCount: 0, ante: 1,
            handPlayed: {}, jokerSlots: 5, totalDeckCount: 2, tarotUsed: 0, enhCounts: { stone: 0, steel: 0, enhanced: 0 }, ...game },
  };
}

describe('M2-B 新 Joker 原语', () => {
  test('笑脸 / 学者 / 对讲机（计分牌加成）', () => {
    const kings = [mk('spades', 'K'), mk('hearts', 'K')];
    expect(scoreHand(ctxOf(kings, { jokers: [J('smiley_face')] })).mult).toBe(2 + 10);
    const aceHigh = [mk('spades', 'A')];
    const r = scoreHand(ctxOf(aceHigh, { jokers: [J('scholar')] }));
    expect(r.chips).toBe(5 + 11 + 20);
    expect(r.mult).toBe(1 + 4);
    const tens = [mk('spades', '10'), mk('hearts', '10')];
    expect(scoreHand(ctxOf(tens, { jokers: [J('walkie_talkie')] })).mult).toBe(2 + 8);
  });

  test('原石/玛瑙/箭头/黄金门票', () => {
    const m = scoreHand(ctxOf([mk('diamonds', '9')], { jokers: [J('rough_gem')], game: { money: 0 } }));
    expect(m.moneyDelta).toBe(1);
    expect(scoreHand(ctxOf([mk('clubs', '9'), mk('hearts', '9')], { jokers: [J('onyx_agate')] })).mult).toBe(2 + 7);
    expect(scoreHand(ctxOf([mk('spades', '9'), mk('hearts', '9')], { jokers: [J('arrowhead')] })).chips).toBe(28 + 50);
    const gold = mk('spades', '9', { enhancement: 'gold' });
    expect(scoreHand(ctxOf([gold, mk('hearts', '9')], { jokers: [J('golden_ticket')] })).moneyDelta).toBe(4);
  });

  test('远足者：计分牌永久 +5 筹（两轮后累加）', () => {
    const cards = [mk('spades', '9'), mk('hearts', '9')];
    const hiker = J('hiker');
    const h = getJokerHandlers('hiker');
    h.onHandPlayed(G, { scoringCards: cards }, hiker);
    expect(cards[0].permChips).toBe(5);
    h.onHandPlayed(G, { scoringCards: cards }, hiker);
    expect(cards[0].permChips).toBe(10);
    // 计分验证：对子10 + (9+10) + (9+10)
    expect(scoreHand(ctxOf(cards)).chips).toBe(48);
  });

  test('冰淇淋/爆米花（衰减型）', () => {
    const ice = J('ice_cream');
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [ice] })).chips).toBe(28 + 100);
    ice.state = 1;
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [ice] })).chips).toBe(28 + 95);
    const pop = J('popcorn');
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [pop] })).mult).toBe(2 + 20);
    pop.state = 3;
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [pop] })).mult).toBe(2 + 8);
  });

  test('龟豆：手牌上限渐变', () => {
    initRun({ seed: 'TURTLE' });
    const tb = J('turtle_bean');
    addJoker(G, tb);
    expect(G.config.handSize).toBe(13);
    expect(tb.state).toBe(5);
    const h = getJokerHandlers('turtle_bean');
    h.onRoundEnd(G, tb);
    expect(G.config.handSize).toBe(12);
    expect(tb.state).toBe(4);
  });

  test('星群 / 全息影像 / 玻璃小丑 / 闪卡（成长 ×）', () => {
    const con = J('constellation', { state: 3 });
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [con] })).mult).toBeCloseTo(2 * 1.3, 5);
    const holo = J('hologram', { state: 4 });
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [holo] })).mult).toBeCloseTo(2 * 2, 5);
    const glass = J('glass_joker', { state: 3 });
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [glass] })).mult).toBeCloseTo(2 * 3.25, 5);
    const fcard = J('flash_card', { state: 5 });
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [fcard] })).mult).toBe(2 + 10);
  });

  test('篝火 / 上路 / 招财猫（成长 × 联动）', () => {
    const cf = J('campfire', { state: 4 });
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [cf] })).mult).toBe(4);

    const road = J('hit_the_road', { state: 2 });
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [road] })).mult).toBe(4);
  });

  test('吸血鬼：移除强化', () => {
    initRun({ seed: 'VAMP' });
    const vamp = J('vampire');
    const bonus = mk('spades', '9', { enhancement: 'bonus' });
    const h = getJokerHandlers('vampire');
    h.onHandPlayed(G, { scoringCards: [bonus] }, vamp);
    expect(bonus.enhancement).toBeNull();
    expect(vamp.state).toBe(1);

    const stone = mk('spades', '9', { enhancement: 'stone' });
    h.onHandPlayed(G, { scoringCards: [stone] }, vamp);
    expect(stone.enhancement).toBe('stone');
    expect(vamp.state).toBe(1);
  });

  test('石头小丑 / 钢铁小丑 / 驾照', () => {
    const ench = { stone: 3, steel: 5, enhanced: 20 };
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('stone_joker')], game: { enhCounts: ench } })).chips).toBe(28 + 75);
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('drivers_license')], game: { enhCounts: ench } })).mult).toBe(6);
  });

  test('占卜师 / 靴带', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('fortune_teller')], game: { tarotUsed: 7 } })).mult).toBe(2 + 7);
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('bootstraps')], game: { money: 20 } })).mult).toBe(2 + 8);
  });

  test('大米歇尔：+15 倍率', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('gros_michel')] })).mult).toBe(17);
  });

  test('苏打水：前 10 手重复触发', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('seltzer', { state: 2 })] })).chips).toBe(10 + 36);
  });
});
