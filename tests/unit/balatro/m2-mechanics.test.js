import { describe, test, expect } from 'vitest';
import '../../../src/balatro/public/js/effects/joker-effects.js';
import { evalHand } from '../../../src/balatro/public/js/hand-eval.js';
import { scoreHand } from '../../../src/balatro/public/js/scoring.js';
import { resolveHandlers, isFaceCtx, cardSuitCtx } from '../../../src/balatro/public/js/effects/index.js';
import { makeCard, HAND_TYPES } from '../../../src/balatro/public/js/data/card-data.js';
import { makeJokerInstance } from '../../../src/balatro/public/js/joker-manager.js';

const mk = (suit, rank, opts) => makeCard(suit, rank, opts);
const J = id => makeJokerInstance(id);

function ctxOf(cards, { jokers = [], held = [], evalOpts = {}, game = {} } = {}) {
  const ev = evalHand(cards, evalOpts);
  return {
    played: cards, scoring: ev.scoringCards, handType: ev.handType, handZh: ev.zh,
    handLevels: Object.fromEntries(HAND_TYPES.map(h => [h.id, 1])),
    levelDelta: 0, jokers, heldCards: held,
    rng: { chance: () => false, random: () => 0.5, int: () => 0, pick: a => a[0] },
    game: { money: 0, handsLeft: 3, discardsLeft: 2, deckCount: 0, ante: 1,
            handPlayed: {}, jokerSlots: 5, totalDeckCount: 52, ...game },
  };
}

describe('四指 / 捷径 / 涂抹 / 溅射（判定选项）', () => {
  test('四指：4 张同花 / 4 张顺子成立，第 5 张不计分', () => {
    const opts = { minFlushLen: 4, minStraightLen: 4 };
    const flush = evalHand([mk('hearts', '2'), mk('hearts', '7'), mk('hearts', '9'), mk('hearts', 'K'), mk('spades', '4')], opts);
    expect(flush.handType).toBe('flush');
    expect(flush.scoringCards.length).toBe(4);

    const straight = evalHand([mk('spades', '5'), mk('hearts', '6'), mk('clubs', '7'), mk('diamonds', '8'), mk('spades', 'K')], opts);
    expect(straight.handType).toBe('straight');
    expect(straight.scoringCards.length).toBe(4);
  });

  test('捷径：允许隔 1 点的顺子（2 3 5 6 8）', () => {
    const r = evalHand([mk('spades', '2'), mk('hearts', '3'), mk('clubs', '5'), mk('diamonds', '6'), mk('spades', '8')], { shortcut: true });
    expect(r.handType).toBe('straight');
    // 无捷径不是顺子
    const r2 = evalHand([mk('spades', '2'), mk('hearts', '3'), mk('clubs', '5'), mk('diamonds', '6'), mk('spades', '8')]);
    expect(r2.handType).toBe('high_card');
  });

  test('涂抹：♥♦ 混合可组同花', () => {
    const r = evalHand([mk('hearts', '2'), mk('diamonds', '7'), mk('hearts', '9'), mk('diamonds', 'K'), mk('hearts', '4')], { smeared: true });
    expect(r.handType).toBe('flush');
  });

  test('溅射：打出的每张牌都计分', () => {
    const cards = [mk('spades', '9'), mk('hearts', '9'), mk('clubs', '2'), mk('diamonds', '5'), mk('spades', 'K')];
    const r = evalHand(cards, { splash: true });
    expect(r.handType).toBe('pair');
    expect(r.scoringCards.length).toBe(5);
    // 计分验证：对子 10 + 全部牌面 9+9+2+5+10 = 45 筹
    const res = scoreHand(ctxOf(cards, { evalOpts: { splash: true } }));
    expect(res.chips).toBe(45);
  });

  test('原有判定不回归：轮子顺 / 皇家 / 石头破坏顺子', () => {
    expect(evalHand([mk('spades', 'A'), mk('hearts', '2'), mk('clubs', '3'), mk('diamonds', '4'), mk('spades', '5')]).handType).toBe('straight');
    const royal = evalHand([mk('clubs', '10'), mk('clubs', 'J'), mk('clubs', 'Q'), mk('clubs', 'K'), mk('clubs', 'A')]);
    expect(royal.zh).toBe('皇家同花顺');
    expect(evalHand([mk('spades', '5'), mk('hearts', '6'), mk('clubs', '7'), mk('diamonds', '8'), mk('spades', '9', { enhancement: 'stone' })]).handType).toBe('high_card');
  });
});

describe('万物有脸 / 涂抹（上下文助手）', () => {
  test('空想性错视：数字牌视为人头 → 恐怖面孔全触发', () => {
    const jokers = [J('pareidolia'), J('scary_face')];
    const r = scoreHand(ctxOf([mk('spades', '2'), mk('hearts', '2')], { jokers }));
    expect(r.chips).toBe(10 + 4 + 60);   // 对子10 + 2+2 + 两张"人头"各+30
    expect(isFaceCtx(jokers, mk('clubs', '5'))).toBe(true);
    expect(isFaceCtx(jokers, mk('clubs', '5', { enhancement: 'stone' }))).toBe(false);
  });

  test('涂抹小丑：贪婪小丑对 ♥ 也生效（♥♦ 同色）', () => {
    const jokers = [J('smeared_joker'), J('greedy_joker')];
    const r = scoreHand(ctxOf([mk('hearts', '9'), mk('diamonds', '9')], { jokers }));
    expect(r.mult).toBe(2 + 3 + 3);
    expect(cardSuitCtx(jokers, mk('hearts', '4'), 'diamonds')).toBe(true);
    expect(cardSuitCtx(jokers, mk('spades', '4'), 'diamonds')).toBe(false);
  });
});

describe('蓝图 / 头脑风暴（复制委托）', () => {
  test('蓝图复制右侧；末位蓝图无效果', () => {
    const bp = J('blueprint'), joker = J('joker');
    const r = scoreHand(ctxOf([mk('spades', '9'), mk('hearts', '9')], { jokers: [bp, joker] }));
    expect(r.mult).toBe(2 + 4 + 4);      // 蓝图复制小丑 +4，小丑本体 +4

    const r2 = scoreHand(ctxOf([mk('spades', '9'), mk('hearts', '9')], { jokers: [joker, bp] }));
    expect(r2.mult).toBe(6);             // 蓝图在末位 → 无目标
  });

  test('头脑风暴复制最左；自身在最左无效', () => {
    const bs = J('brainstorm'), duo = J('the_duo');
    const r = scoreHand(ctxOf([mk('spades', '9'), mk('hearts', '9')], { jokers: [duo, bs] }));
    expect(r.mult).toBe(2 * 2 * 2);      // 二重奏 ×2，头脑风暴复制 ×2

    const r2 = scoreHand(ctxOf([mk('spades', '9'), mk('hearts', '9')], { jokers: [bs, duo] }));
    expect(r2.mult).toBe(2 * 2);         // 头脑风暴复制自己 → 空
  });

  test('复制链与环路保护', () => {
    const bp1 = J('blueprint'), bp2 = J('blueprint'), joker = J('joker');
    // 蓝图→蓝图→小丑：两张蓝图都生效
    const r = scoreHand(ctxOf([mk('spades', '9'), mk('hearts', '9')], { jokers: [bp1, bp2, joker] }));
    expect(r.mult).toBe(2 + 4 + 4 + 4);
    // 头脑风暴在最左指向自己 → resolveHandlers 空
    const bs = J('brainstorm');
    expect(Object.keys(resolveHandlers([bs], bs)).length).toBe(0);
  });

  test('蓝图复制重触发类也生效（复制骇客）', () => {
    const bp = J('blueprint'), hack = J('hack');
    const r = scoreHand(ctxOf([mk('spades', '2'), mk('hearts', '2')], { jokers: [bp, hack] }));
    // 每张 2 触发 3 次（本体 + 骇客 + 蓝图复制骇客）：10 + 2×3×2 = 22
    expect(r.chips).toBe(22);
  });
});
