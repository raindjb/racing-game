import { describe, test, expect } from 'vitest';
import { createRng, hashSeed } from '../../../src/balatro/public/js/rng.js';
import { G, initRun } from '../../../src/balatro/public/js/state.js';
import { drawToHandSize, discardFromHand, reclaimAll, destroyCards, totalDeckCount } from '../../../src/balatro/public/js/deck.js';
import { SUITS, RANKS, cardBaseChips, cardHasSuit, makeCard } from '../../../src/balatro/public/js/data/card-data.js';

describe('rng', () => {
  test('同种子同序列', () => {
    const a = createRng('TESTSEED'), b = createRng('TESTSEED');
    for (let i = 0; i < 100; i++) expect(a.random()).toBe(b.random());
  });

  test('不同种子不同序列', () => {
    const a = createRng('SEED-A'), b = createRng('SEED-B');
    const sa = Array.from({ length: 10 }, () => a.random());
    const sb = Array.from({ length: 10 }, () => b.random());
    expect(sa).not.toEqual(sb);
  });

  test('shuffle 确定性 + int 边界', () => {
    const s1 = createRng(42).shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    const s2 = createRng(42).shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(s1).toEqual(s2);
    const r = createRng('X');
    for (let i = 0; i < 200; i++) {
      const v = r.int(1, 3);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
    }
  });

  test('状态可保存恢复', () => {
    const a = createRng('SAVE');
    a.random(); a.random();
    const st = a.getState();
    const next = a.random();
    const b = createRng('other');
    b.setState(st);
    expect(b.random()).toBe(next);
  });

  test('hashSeed 稳定', () => {
    expect(hashSeed('BALATRO1')).toBe(hashSeed('BALATRO1'));
    expect(hashSeed('BALATRO1')).not.toBe(hashSeed('BALATRO2'));
  });
});

describe('deck & state', () => {
  test('新局 52 张无重复，抽满 8 张', () => {
    initRun({ seed: 'DECKTEST' });
    expect(G.deck.length).toBe(52);
    const keys = new Set(G.deck.map(c => `${c.suit}-${c.rank}`));
    expect(keys.size).toBe(52);
    for (const s of SUITS) expect(G.deck.filter(c => c.suit === s).length).toBe(RANKS.length);

    drawToHandSize();
    expect(G.hand.length).toBe(8);
    expect(G.deck.length).toBe(44);
  });

  test('同种子发同样的牌', () => {
    initRun({ seed: 'SAME' });
    drawToHandSize();
    const h1 = G.hand.map(c => `${c.suit}-${c.rank}`);
    initRun({ seed: 'SAME' });
    drawToHandSize();
    const h2 = G.hand.map(c => `${c.suit}-${c.rank}`);
    expect(h1).toEqual(h2);
  });

  test('弃牌→回收→销毁 数量守恒', () => {
    initRun({ seed: 'FLOW' });
    drawToHandSize();
    discardFromHand(G.hand.slice(0, 3));
    expect(G.discardPile.length).toBe(3);
    expect(G.hand.length).toBe(5);

    reclaimAll();
    expect(totalDeckCount()).toBe(52);
    expect(G.hand.length).toBe(0);

    destroyCards([G.deck[0], G.deck[1]]);
    expect(totalDeckCount()).toBe(50);
    expect(G.removedCards.length).toBe(2);
  });

  test('牌堆不足时不重洗，能抽几张抽几张', () => {
    initRun({ seed: 'EMPTY' });
    G.deck = G.deck.slice(0, 3); // 只剩 3 张
    drawToHandSize();
    expect(G.hand.length).toBe(3);
    expect(G.deck.length).toBe(0);
  });
});

describe('card-data 辅助', () => {
  test('石头牌固定 50 筹码且无花色', () => {
    const stone = makeCard('spades', 'K', { enhancement: 'stone' });
    expect(cardBaseChips(stone)).toBe(50);
    expect(cardHasSuit(stone, 'spades')).toBe(false);
  });

  test('万能牌匹配任意花色', () => {
    const wild = makeCard('clubs', '7', { enhancement: 'wild' });
    expect(cardHasSuit(wild, 'hearts')).toBe(true);
    expect(cardHasSuit(wild, 'spades')).toBe(true);
  });

  test('A=11 筹码，人头=10', () => {
    expect(cardBaseChips(makeCard('spades', 'A'))).toBe(11);
    expect(cardBaseChips(makeCard('spades', 'Q'))).toBe(10);
  });
});
