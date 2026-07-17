import { describe, test, expect } from 'vitest';
import '../../../src/balatro/public/js/effects/joker-effects.js';
import { G, initRun } from '../../../src/balatro/public/js/state.js';
import { startRun, startBlind, toggleSelect } from '../../../src/balatro/public/js/round.js';
import { makeConsumable, addConsumable, useConsumable, randomSpectralId } from '../../../src/balatro/public/js/consumable-manager.js';
import { makeCard, HAND_TYPES } from '../../../src/balatro/public/js/data/card-data.js';
import { makeJokerInstance, addJoker } from '../../../src/balatro/public/js/joker-manager.js';
import { SPECTRALS } from '../../../src/balatro/public/js/data/spectrals.js';

const mk = (suit, rank, opts) => makeCard(suit, rank, opts);

function useSpectralOn(id, { hand = null, selectN = 0 } = {}) {
  if (hand) { G.hand = hand; G.selected = []; for (let i = 0; i < selectN; i++) toggleSelect(hand[i].id); }
  const inst = makeConsumable('spectral', id);
  addConsumable(inst);
  return useConsumable(inst.uid);
}

describe('幻灵牌', () => {
  test('全 18 张数据完整', () => {
    expect(SPECTRALS.length).toBe(18);
    for (const s of SPECTRALS) { expect(s.zh).toBeTruthy(); expect(s.desc).toBeTruthy(); }
  });

  test('蜡封类：既视感附红蜡封', () => {
    startRun({ seed: 'SP1' }); startBlind();
    const c = mk('spades', '9');
    const r = useSpectralOn('deja_vu', { hand: [c, ...G.hand.slice(0, 7)], selectN: 1 });
    expect(r.ok).toBe(true);
    expect(c.seal).toBe('red');
  });

  test('亲随：销毁 1 张 + 加 3 张强化人头', () => {
    startRun({ seed: 'SP2' }); startBlind();
    const before = G.hand.length;
    const r = useSpectralOn('familiar');
    expect(r.ok).toBe(true);
    expect(G.hand.length).toBe(before - 1 + 3);
    expect(G.removedCards.length).toBe(1);
    const added = G.hand.slice(-3);
    expect(added.every(c => ['K', 'Q', 'J'].includes(c.rank) && c.enhancement)).toBe(true);
  });

  test('怨灵：稀有小丑 + 金钱归零', () => {
    startRun({ seed: 'SP3' }); startBlind();
    G.money = 33;
    const r = useSpectralOn('wraith');
    expect(r.ok).toBe(true);
    expect(G.money).toBe(0);
    expect(G.jokers.length).toBe(1);
    expect(['rare']).toContain(G.jokers[0].rarity);
  });

  test('印记/通灵板：全手转换', () => {
    startRun({ seed: 'SP4' }); startBlind();
    useSpectralOn('sigil');
    const suits = new Set(G.hand.filter(c => c.enhancement !== 'stone').map(c => c.suit));
    expect(suits.size).toBe(1);

    const hsBefore = G.config.handSize;
    useSpectralOn('ouija');
    const ranks = new Set(G.hand.filter(c => c.enhancement !== 'stone').map(c => c.rank));
    expect(ranks.size).toBe(1);
    expect(G.config.handSize).toBe(hsBefore - 1);
  });

  test('献祭：销毁 5 张 +$20', () => {
    startRun({ seed: 'SP5' }); startBlind();
    G.money = 0;
    useSpectralOn('immolate');
    expect(G.money).toBe(20);
    expect(G.hand.length).toBe(3);
  });

  test('安卡/妖术：只留一张小丑', () => {
    startRun({ seed: 'SP6' }); startBlind();
    addJoker(G, makeJokerInstance('joker'));
    addJoker(G, makeJokerInstance('cavendish'));
    useSpectralOn('ankh');
    expect(G.jokers.length).toBe(1);

    addJoker(G, makeJokerInstance('the_duo'));
    useSpectralOn('hex');
    expect(G.jokers.length).toBe(1);
    expect(G.jokers[0].edition).toBe('polychrome');
  });

  test('灵魂：生成传奇；黑洞：全手型升级', () => {
    startRun({ seed: 'SP7' }); startBlind();
    useSpectralOn('soul');
    expect(G.jokers[0].rarity).toBe('legendary');

    useSpectralOn('black_hole');
    for (const h of HAND_TYPES) expect(G.handLevels[h.id]).toBe(2);
  });

  test('秘影：复制选中牌 2 份（含强化）', () => {
    startRun({ seed: 'SP8' }); startBlind();
    const c = mk('hearts', 'K', { enhancement: 'glass', seal: 'red' });
    useSpectralOn('cryptid', { hand: [c, ...G.hand.slice(0, 7)], selectN: 1 });
    const copies = G.hand.filter(x => x.rank === 'K' && x.suit === 'hearts' && x.enhancement === 'glass');
    expect(copies.length).toBe(3);
  });

  test('随机池：灵魂/黑洞低权重仍可出现', () => {
    initRun({ seed: 'SPPOOL' });
    const ids = new Set();
    for (let i = 0; i < 800; i++) ids.add(randomSpectralId(G.rng));
    expect(ids.size).toBeGreaterThanOrEqual(16);
  });
});
