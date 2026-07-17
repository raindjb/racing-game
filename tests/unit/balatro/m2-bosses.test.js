import { describe, test, expect } from 'vitest';
import '../../../src/balatro/public/js/effects/joker-effects.js';
import { G, PHASES } from '../../../src/balatro/public/js/state.js';
import { startRun, startBlind, toggleSelect, playSelected, discardSelected } from '../../../src/balatro/public/js/round.js';
import { BOSSES, pickBoss } from '../../../src/balatro/public/js/data/bosses.js';
import { makeCard } from '../../../src/balatro/public/js/data/card-data.js';
import { makeJokerInstance, addJoker, sellJoker } from '../../../src/balatro/public/js/joker-manager.js';
import { createRng } from '../../../src/balatro/public/js/rng.js';

const mk = (suit, rank, opts) => makeCard(suit, rank, opts);

function bossBlind(id, seed = 'MB') {
  startRun({ seed });
  G.blindIndex = 2;
  startBlind({ forceBossId: id });
}
function craft(cards, n = cards.length) {
  G.hand = cards; G.selected = [];
  for (let i = 0; i < n; i++) toggleSelect(cards[i].id);
}

describe('M2-E Boss 数据', () => {
  test('共 28 个，终局 Boss 仅 Ante 8 出现', () => {
    expect(BOSSES.length).toBe(28);
    const rng = createRng('BOSSPOOL');
    const finishers = new Set(['amber_acorn', 'verdant_leaf', 'violet_vessel', 'crimson_heart', 'cerulean_bell']);
    for (let i = 0; i < 60; i++) {
      expect(finishers.has(pickBoss(rng, [], 3).id)).toBe(false);
      expect(finishers.has(pickBoss(rng, [], 8).id)).toBe(true);
    }
  });
});

describe('M2-E 新 Boss 机制', () => {
  test('燧石：基础筹码/倍率减半', () => {
    bossBlind('flint');
    craft([mk('spades', '9'), mk('hearts', '9'), ...G.hand.slice(0, 6)], 2);
    const r = playSelected();
    expect(r.chips).toBe(Math.ceil(10 / 2) + 18);   // 基础5 + 牌面18
    expect(r.mult).toBe(1);
  });

  test('镣铐：手牌上限 -1', () => {
    bossBlind('manacle');
    expect(G.hand.length).toBe(7);
  });

  test('牙：每张计分牌 -$1', () => {
    bossBlind('tooth');
    G.money = 10;
    craft([mk('spades', '9'), mk('hearts', '9'), ...G.hand.slice(0, 6)], 2);
    playSelected();
    expect(G.money).toBe(8);
  });

  test('牛：打出最常用手型金钱归零', () => {
    bossBlind('ox');
    G.money = 30;
    G.handPlayed.pair = 5;   // 对子是最常用
    craft([mk('spades', '9'), mk('hearts', '9'), ...G.hand.slice(0, 6)], 2);
    playSelected();
    expect(G.money).toBe(0);
  });

  test('房子：首发全部背面朝上，补牌恢复正常', () => {
    bossBlind('house');
    expect(G.hand.every(c => c.faceDown)).toBe(true);
    craft(G.hand, 2);
    discardSelected();
    const newOnes = G.hand.slice(-2);
    expect(newOnes.every(c => !c.faceDown)).toBe(true);
  });

  test('鱼：出牌后补的牌背面朝上', () => {
    bossBlind('fish');
    expect(G.hand.every(c => !c.faceDown)).toBe(true);
    craft(G.hand, 2);
    playSelected();
    const drawn = G.hand.slice(-2);
    expect(drawn.every(c => c.faceDown)).toBe(true);
  });

  test('蛇：出牌后只补 3 张', () => {
    bossBlind('serpent');
    craft(G.hand, 5);
    playSelected();   // 打 5 张只补 3 → 手牌 6
    expect(G.hand.length).toBe(6);
  });

  test('植物：人头牌失效', () => {
    bossBlind('plant', 'PLANT');
    for (const c of G.hand) {
      if (['K', 'Q', 'J'].includes(c.rank)) expect(c.debuffed).toBe(true);
    }
  });

  test('刺棒/头/窗：花色失效复用', () => {
    bossBlind('goad', 'GOAD');
    for (const c of G.hand) if (c.suit === 'diamonds') expect(c.debuffed).toBe(true);
  });

  test('紫罗兰瓶：6 倍目标', () => {
    bossBlind('violet_vessel');
    expect(G.target).toBe(300 * 6);
  });

  test('绯红之心：随机禁用一张小丑（效果归零）', () => {
    startRun({ seed: 'CRIMSON' });
    addJoker(G, makeJokerInstance('joker'));
    G.blindIndex = 2;
    startBlind({ forceBossId: 'crimson_heart' });
    expect(G.jokers[0].disabled).toBe(true);
    craft([mk('spades', '9'), mk('hearts', '9'), ...G.hand.slice(0, 6)], 2);
    const r = playSelected();
    expect(r.mult).toBe(2);   // 小丑 +4 被禁用
  });

  test('蔚蓝之铃：强制选中一张且不可取消', () => {
    bossBlind('cerulean_bell');
    expect(G.selected.length).toBe(1);
    const forced = G.bossState.forcedCard;
    toggleSelect(forced);
    expect(G.selected).toContain(forced);   // 取消被拒绝
  });

  test('翠绿叶片：全体失效，出售小丑解除', () => {
    startRun({ seed: 'VERDANT' });
    const j = makeJokerInstance('joker');
    addJoker(G, j);
    G.blindIndex = 2;
    startBlind({ forceBossId: 'verdant_leaf' });
    expect(G.hand.every(c => c.debuffed)).toBe(true);
    sellJoker(G, j.uid);
    expect(G.bossDisabled).toBe(true);
    expect(G.hand.every(c => !c.debuffed)).toBe(true);
  });

  test('琥珀橡果：小丑顺序被洗乱（种子可复现）', () => {
    startRun({ seed: 'ACORN' });
    for (const id of ['joker', 'cavendish', 'the_duo', 'jolly_joker', 'sly_joker']) {
      addJoker(G, makeJokerInstance(id));
    }
    const before = G.jokers.map(j => j.id).join();
    G.blindIndex = 2;
    startBlind({ forceBossId: 'amber_acorn' });
    expect(G.jokers.length).toBe(5);
    expect(G.jokers.map(j => j.id).join()).not.toBe(before);
  });
});
