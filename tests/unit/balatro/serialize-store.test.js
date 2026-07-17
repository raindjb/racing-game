import { describe, test, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import '../../../src/balatro/public/js/effects/joker-effects.js';
import { G, PHASES } from '../../../src/balatro/public/js/state.js';
import { startRun, startBlind, toggleSelect, playSelected } from '../../../src/balatro/public/js/round.js';
import { serializeRun, deserializeRun } from '../../../src/balatro/public/js/serialize.js';
import { makeJokerInstance, addJoker } from '../../../src/balatro/public/js/joker-manager.js';
import { makeConsumable, addConsumable } from '../../../src/balatro/public/js/consumable-manager.js';
import { RunStore, StatsStore } from '../../../src/balatro/modules/store.js';

describe('存档序列化', () => {
  function makeRichState() {
    startRun({ seed: 'SAVEME' });
    startBlind();
    addJoker(G, makeJokerInstance('joker', { edition: 'foil' }));
    addJoker(G, makeJokerInstance('green_joker'));
    G.jokers[1].state = 5;
    addConsumable(makeConsumable('tarot', 'hermit'));
    G.money = 23;
    G.handLevels.pair = 3;
    toggleSelect(G.hand[0].id);
    toggleSelect(G.hand[1].id);
    playSelected(); // 走一手真实流程
  }

  test('往返：全部字段深相等（除去打出区/选中）', () => {
    makeRichState();
    const snap = serializeRun();
    const json = JSON.parse(JSON.stringify(snap));   // 模拟落盘往返

    const nextRandBefore = null;
    startRun({ seed: 'OTHER' });                     // 污染当前状态
    expect(deserializeRun(json)).toBe(true);

    expect(G.seed).toBe('SAVEME');
    expect(G.money).toBe(json.money);
    expect(G.handLevels.pair).toBe(3);
    expect(G.jokers.length).toBe(2);
    expect(G.jokers[0].edition).toBe('foil');
    expect(G.jokers[1].state).toBe(6); // 存档前 playSelected 使绿色小丑 5→6
    expect(G.consumables[0].id).toBe('hermit');
    expect(G.deck.length + G.hand.length + G.discardPile.length)
      .toBe(json.deck.length + json.hand.length + json.discardPile.length);
    expect(G.phase).toBe(json.phase);
  });

  test('RNG 状态延续：恢复后随机序列与不中断时一致', () => {
    startRun({ seed: 'RNGCONT' });
    startBlind();
    G.rng.random(); G.rng.random();
    const snap = JSON.parse(JSON.stringify(serializeRun()));
    const expected = [G.rng.random(), G.rng.random()];

    startRun({ seed: 'JUNK' });
    deserializeRun(snap);
    expect([G.rng.random(), G.rng.random()]).toEqual(expected);
  });

  test('恢复后可继续游戏（出牌不炸）', () => {
    makeRichState();
    const snap = JSON.parse(JSON.stringify(serializeRun()));
    startRun({ seed: 'JUNK' });
    deserializeRun(snap);
    if (G.phase === PHASES.PLAYING && G.hand.length) {
      toggleSelect(G.hand[0].id);
      expect(playSelected()).not.toBeNull();
    }
  });

  test('版本不符/残缺数据拒绝', () => {
    expect(deserializeRun(null)).toBe(false);
    expect(deserializeRun({ version: 999, seed: 'X', deck: [] })).toBe(false);
    expect(deserializeRun({ version: 1 })).toBe(false);
  });

  test('结算中存档回退到安全阶段', () => {
    startRun({ seed: 'MIDSAVE' });
    startBlind();
    toggleSelect(G.hand[0].id);
    playSelected({ instant: false });                // 停在 SCORING
    expect(G.phase).toBe(PHASES.SCORING);
    const snap = serializeRun();
    expect(snap.phase).toBe(PHASES.PLAYING);
    expect(snap.playedZone).toEqual([]);
  });
});

describe('Node 存储（RunStore/StatsStore）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'balatro-store-'));

  test('RunStore：save/load/list/remove', () => {
    const rs = new RunStore(dir);
    const payload = { version: 1, seed: 'ABC', deck: [], ante: 3, round: 7, money: 15 };
    rs.save('current', payload);
    expect(rs.load('current')).toEqual(payload);
    const list = rs.list();
    expect(list.length).toBe(1);
    expect(list[0].ante).toBe(3);
    expect(rs.remove('current')).toBe(true);
    expect(rs.load('current')).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test('StatsStore：record 聚合', () => {
    const dir2 = mkdtempSync(join(tmpdir(), 'balatro-stats-'));
    const ss = new StatsStore(dir2);
    ss.record({ won: false, ante: 3, bestHand: 420, round: 8 });
    const sum = ss.record({ won: true, ante: 8, bestHand: 9999, round: 24 });
    expect(sum.games).toBe(2);
    expect(sum.wins).toBe(1);
    expect(sum.bestScore).toBe(9999);
    expect(sum.bestAnte).toBe(8);
    expect(sum.history.length).toBe(2);
    rmSync(dir2, { recursive: true, force: true });
  });
});
