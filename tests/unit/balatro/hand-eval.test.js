import { describe, test, expect } from 'vitest';
import { evalHand } from '../../../src/balatro/public/js/hand-eval.js';
import { makeCard } from '../../../src/balatro/public/js/data/card-data.js';

const mk = (suit, rank, opts) => makeCard(suit, rank, opts);

describe('手型判定', () => {
  test('对子：5 张中只有对子+石头计分', () => {
    const cards = [mk('spades', '9'), mk('hearts', '9'), mk('clubs', '2'), mk('diamonds', '5'), mk('spades', 'K')];
    const r = evalHand(cards);
    expect(r.handType).toBe('pair');
    expect(r.scoringCards.length).toBe(2);
    expect(r.scoringCards.every(c => c.rank === '9')).toBe(true);
  });

  test('两对：踢脚牌不计分', () => {
    const r = evalHand([mk('spades', '9'), mk('hearts', '9'), mk('clubs', '4'), mk('diamonds', '4'), mk('spades', 'A')]);
    expect(r.handType).toBe('two_pair');
    expect(r.scoringCards.length).toBe(4);
  });

  test('三条 / 四条', () => {
    expect(evalHand([mk('spades', '7'), mk('hearts', '7'), mk('clubs', '7'), mk('diamonds', '2'), mk('spades', 'K')]).handType).toBe('three_of_a_kind');
    expect(evalHand([mk('spades', 'J'), mk('hearts', 'J'), mk('clubs', 'J'), mk('diamonds', 'J'), mk('spades', '3')]).handType).toBe('four_of_a_kind');
  });

  test('顺子：普通 + A 高 + 轮子 A-2-3-4-5', () => {
    expect(evalHand([mk('spades', '5'), mk('hearts', '6'), mk('clubs', '7'), mk('diamonds', '8'), mk('spades', '9')]).handType).toBe('straight');
    expect(evalHand([mk('spades', '10'), mk('hearts', 'J'), mk('clubs', 'Q'), mk('diamonds', 'K'), mk('spades', 'A')]).handType).toBe('straight');
    const wheel = evalHand([mk('spades', 'A'), mk('hearts', '2'), mk('clubs', '3'), mk('diamonds', '4'), mk('spades', '5')]);
    expect(wheel.handType).toBe('straight');
  });

  test('同花：万能牌参与判定', () => {
    const r = evalHand([mk('hearts', '2'), mk('hearts', '7'), mk('hearts', '9'), mk('hearts', 'K'), mk('clubs', '4', { enhancement: 'wild' })]);
    expect(r.handType).toBe('flush');
    expect(r.scoringCards.length).toBe(5);
  });

  test('葫芦', () => {
    expect(evalHand([mk('spades', '8'), mk('hearts', '8'), mk('clubs', '8'), mk('diamonds', 'K'), mk('spades', 'K')]).handType).toBe('full_house');
  });

  test('同花顺 + 皇家显示变体（手型仍为同花顺）', () => {
    const sf = evalHand([mk('clubs', '5'), mk('clubs', '6'), mk('clubs', '7'), mk('clubs', '8'), mk('clubs', '9')]);
    expect(sf.handType).toBe('straight_flush');
    expect(sf.zh).toBe('同花顺');
    const royal = evalHand([mk('clubs', '10'), mk('clubs', 'J'), mk('clubs', 'Q'), mk('clubs', 'K'), mk('clubs', 'A')]);
    expect(royal.handType).toBe('straight_flush');
    expect(royal.zh).toBe('皇家同花顺');
  });

  test('秘密手型：五条 / 同花五条（复制牌场景）', () => {
    const five = evalHand([mk('spades', 'K'), mk('hearts', 'K'), mk('clubs', 'K'), mk('diamonds', 'K'), mk('spades', 'K')]);
    expect(five.handType).toBe('five_of_a_kind');
    const flushFive = evalHand([mk('spades', 'K'), mk('spades', 'K'), mk('spades', 'K'), mk('spades', 'K'), mk('spades', 'K')]);
    expect(flushFive.handType).toBe('flush_five');
  });

  test('石头牌：不参与判定但计分；会破坏顺子', () => {
    const r = evalHand([mk('spades', '9'), mk('hearts', '9'), mk('clubs', '2', { enhancement: 'stone' })]);
    expect(r.handType).toBe('pair');
    expect(r.scoringCards.length).toBe(3); // 对子 + 石头

    const noStraight = evalHand([mk('spades', '5'), mk('hearts', '6'), mk('clubs', '7'), mk('diamonds', '8'), mk('spades', '9', { enhancement: 'stone' })]);
    expect(noStraight.handType).toBe('high_card');
  });

  test('高牌：取最大点数一张（A 最大）', () => {
    const r = evalHand([mk('spades', '2'), mk('hearts', '5'), mk('clubs', '9'), mk('diamonds', 'J'), mk('spades', 'A')]);
    expect(r.handType).toBe('high_card');
    expect(r.scoringCards.length).toBe(1);
    expect(r.scoringCards[0].rank).toBe('A');
  });

  test('单张 / 空输入', () => {
    expect(evalHand([mk('spades', 'Q')]).handType).toBe('high_card');
    expect(evalHand([])).toBeNull();
  });
});
