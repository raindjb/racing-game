import { describe, test, expect, beforeEach } from 'vitest';
import { evalHand } from '../../../src/balatro/public/js/hand-eval.js';
import { scoreHand } from '../../../src/balatro/public/js/scoring.js';
import { registerJoker, clearRegistry } from '../../../src/balatro/public/js/effects/index.js';
import { makeCard, HAND_TYPES } from '../../../src/balatro/public/js/data/card-data.js';

const mk = (suit, rank, opts) => makeCard(suit, rank, opts);
const stubRng = (hit = false) => ({ chance: () => hit, random: () => 0.5, pick: a => a[0], int: (a) => a });

/** 手工构建计分上下文 */
function ctxOf(cards, { jokers = [], held = [], levels = {}, rng = stubRng(), levelDelta = 0 } = {}) {
  const ev = evalHand(cards);
  return {
    played: cards, scoring: ev.scoringCards, handType: ev.handType, handZh: ev.zh,
    handLevels: { ...Object.fromEntries(HAND_TYPES.map(h => [h.id, 1])), ...levels },
    levelDelta, jokers, heldCards: held, rng,
    game: { money: 10, handsLeft: 3, discardsLeft: 2, deckCount: 40, ante: 1, handPlayed: {}, totalDeckCount: 52 },
  };
}

beforeEach(() => clearRegistry());

describe('计分管线', () => {
  test('基础：对子 Lv1 = (10+9+9) × 2', () => {
    const r = scoreHand(ctxOf([mk('spades', '9'), mk('hearts', '9')]));
    expect(r.chips).toBe(28);
    expect(r.mult).toBe(2);
    expect(r.score).toBe(56);
  });

  test('手型等级加成：对子 Lv3 = 10+15×2 筹码, 2+1×2 倍率', () => {
    const r = scoreHand(ctxOf([mk('spades', '9'), mk('hearts', '9')], { levels: { pair: 3 } }));
    expect(r.chips).toBe(40 + 18);
    expect(r.mult).toBe(4);
  });

  test('Boss「手臂」降级不低于 Lv1', () => {
    const r = scoreHand(ctxOf([mk('spades', '9'), mk('hearts', '9')], { levelDelta: -5 }));
    expect(r.chips).toBe(28);
    expect(r.mult).toBe(2);
  });

  test('强化：奖励+30筹 / 多倍+4倍 / 玻璃×2', () => {
    const bonus = scoreHand(ctxOf([mk('spades', '9', { enhancement: 'bonus' }), mk('hearts', '9')]));
    expect(bonus.chips).toBe(28 + 30);
    const mult = scoreHand(ctxOf([mk('spades', '9', { enhancement: 'mult' }), mk('hearts', '9')]));
    expect(mult.mult).toBe(6);
    const glass = scoreHand(ctxOf([mk('spades', '9', { enhancement: 'glass' }), mk('hearts', '9')]));
    expect(glass.mult).toBe(4); // 2 ×2
    expect(glass.destroyed.length).toBe(0); // rng 未命中不碎
  });

  test('玻璃碎裂：rng 命中 → destroyed', () => {
    const card = mk('spades', '9', { enhancement: 'glass' });
    const r = scoreHand(ctxOf([card, mk('hearts', '9')], { rng: stubRng(true) }));
    expect(r.destroyed).toContain(card);
  });

  test('幸运牌：rng 命中 → +20 倍率 +$20', () => {
    const r = scoreHand(ctxOf([mk('spades', '9', { enhancement: 'lucky' }), mk('hearts', '9')], { rng: stubRng(true) }));
    expect(r.mult).toBe(22);
    expect(r.moneyDelta).toBe(20);
  });

  test('版本：闪箔+50筹 / 镭射+10倍 / 多彩×1.5', () => {
    expect(scoreHand(ctxOf([mk('spades', '9', { edition: 'foil' }), mk('hearts', '9')])).chips).toBe(78);
    expect(scoreHand(ctxOf([mk('spades', '9', { edition: 'holographic' }), mk('hearts', '9')])).mult).toBe(12);
    expect(scoreHand(ctxOf([mk('spades', '9', { edition: 'polychrome' }), mk('hearts', '9')])).mult).toBe(3);
  });

  test('红蜡封：计分牌全部贡献重复一次', () => {
    const r = scoreHand(ctxOf([mk('spades', '9', { seal: 'red', enhancement: 'bonus' }), mk('hearts', '9')]));
    // 基础10 + (9+30)×2 + 9 = 97
    expect(r.chips).toBe(97);
  });

  test('金蜡封 +$3', () => {
    const r = scoreHand(ctxOf([mk('spades', '9', { seal: 'gold' }), mk('hearts', '9')]));
    expect(r.moneyDelta).toBe(3);
  });

  test('失效牌（Boss 棍棒）：零贡献', () => {
    const dead = mk('clubs', '9'); dead.debuffed = true;
    const r = scoreHand(ctxOf([mk('spades', '9'), dead]));
    // 判定仍是对子，但失效牌不给筹码
    expect(r.chips).toBe(10 + 9);
  });

  test('手持钢铁 ×1.5；红蜡封钢铁 ×1.5×1.5', () => {
    const steel = mk('spades', 'K', { enhancement: 'steel' });
    const r1 = scoreHand(ctxOf([mk('spades', '9'), mk('hearts', '9')], { held: [steel] }));
    expect(r1.mult).toBe(3);
    const steelRed = mk('spades', 'K', { enhancement: 'steel', seal: 'red' });
    const r2 = scoreHand(ctxOf([mk('spades', '9'), mk('hearts', '9')], { held: [steelRed] }));
    expect(r2.mult).toBe(4.5);
  });

  test('Joker 独立效果 + 版本顺序：镭射先于效果，多彩后于效果', () => {
    registerJoker('test_plus4', { onIndependent: (ctx, api) => api.addMult(4, { kind: 'joker', id: 'test_plus4' }) });
    // 无版本：2+4=6
    expect(scoreHand(ctxOf([mk('spades', '9'), mk('hearts', '9')], { jokers: [{ id: 'test_plus4' }] })).mult).toBe(6);
    // 镭射：2+10+4=16
    expect(scoreHand(ctxOf([mk('spades', '9'), mk('hearts', '9')], { jokers: [{ id: 'test_plus4', edition: 'holographic' }] })).mult).toBe(16);
    // 多彩：(2+4)×1.5=9
    expect(scoreHand(ctxOf([mk('spades', '9'), mk('hearts', '9')], { jokers: [{ id: 'test_plus4', edition: 'polychrome' }] })).mult).toBe(9);
  });

  test('Joker 逐张钩子从左到右 + 重触发叠加', () => {
    registerJoker('per_nine', {
      onScoredCard: (ctx, api, card) => { if (card.rank === '9') api.addMult(2, { kind: 'joker', id: 'per_nine' }); },
    });
    const r = scoreHand(ctxOf(
      [mk('spades', '9', { seal: 'red' }), mk('hearts', '9')],
      { jokers: [{ id: 'per_nine' }] },
    ));
    // 红封的 9 触发两次 +2+2，另一张 +2 → mult = 2+6 = 8
    expect(r.mult).toBe(8);
  });

  test('steps 日志完整可重放', () => {
    const r = scoreHand(ctxOf([mk('spades', '9'), mk('hearts', '9')]));
    expect(r.steps[0].type).toBe('base');
    expect(r.steps.filter(s => s.type === 'chips').length).toBe(2);
  });

  test('最终分数向下取整', () => {
    const glass = mk('spades', '2', { enhancement: 'glass' });
    const r = scoreHand(ctxOf([glass])); // 高牌 5+2=7 chips, 1×2=2 mult
    expect(r.score).toBe(Math.floor(r.chips * r.mult));
  });
});
