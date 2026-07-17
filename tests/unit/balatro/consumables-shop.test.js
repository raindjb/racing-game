import { describe, test, expect, beforeEach } from 'vitest';
import '../../../src/balatro/public/js/effects/joker-effects.js';
import { G, PHASES, initRun } from '../../../src/balatro/public/js/state.js';
import { startRun, startBlind, toggleSelect, discardSelected, playSelected, leaveRoundEnd } from '../../../src/balatro/public/js/round.js';
import { makeConsumable, addConsumable, useConsumable, sellConsumable, randomPlanetId } from '../../../src/balatro/public/js/consumable-manager.js';
import { enterShopGen, buySlot, buyVoucher, rerollShop, rerollCost, buyPack, pickBoosterItem, closeBooster } from '../../../src/balatro/public/js/shop.js';
import { makeCard } from '../../../src/balatro/public/js/data/card-data.js';
import { makeJokerInstance, addJoker } from '../../../src/balatro/public/js/joker-manager.js';

const mk = (suit, rank, opts) => makeCard(suit, rank, opts);

function setupPlaying(seed = 'CONS') {
  startRun({ seed });
  startBlind();
}
function craft(cards, selectN = cards.length) {
  G.hand = cards; G.selected = [];
  for (let i = 0; i < selectN; i++) toggleSelect(cards[i].id);
}
function useTarotOn(id, cards, selectN) {
  craft(cards, selectN ?? cards.length);
  const inst = makeConsumable('tarot', id);
  addConsumable(inst);
  return useConsumable(inst.uid);
}

describe('星球牌', () => {
  test('使用后手型升级并移出槽位', () => {
    setupPlaying();
    const inst = makeConsumable('planet', 'mercury');
    addConsumable(inst);
    expect(useConsumable(inst.uid).ok).toBe(true);
    expect(G.handLevels.pair).toBe(2);
    expect(G.consumables.length).toBe(0);
  });

  test('秘密星球未解锁不出现在随机池', () => {
    initRun({ seed: 'SECRET' });
    for (let i = 0; i < 60; i++) {
      const id = randomPlanetId(G.rng);
      expect(['planet_x', 'ceres', 'eris']).not.toContain(id);
    }
    G.handPlayed.five_of_a_kind = 1;
    const ids = new Set();
    for (let i = 0; i < 120; i++) ids.add(randomPlanetId(G.rng));
    expect(ids.has('planet_x')).toBe(true);
  });
});

describe('塔罗牌', () => {
  beforeEach(() => setupPlaying());

  test('魔术师：选中 2 张 → 幸运牌；目标数不符拒绝', () => {
    const c1 = mk('spades', '9'), c2 = mk('hearts', '7');
    expect(useTarotOn('magician', [c1, c2, mk('clubs', '2')], 2).ok).toBe(true);
    expect(c1.enhancement).toBe('lucky');
    expect(c2.enhancement).toBe('lucky');

    const r = useTarotOn('magician', [mk('spades', '3')], 0); // 0 张选中
    expect(r.ok).toBe(false);
  });

  test('恋人 1 张万能；塔 1 张石头', () => {
    const c = mk('spades', '9');
    expect(useTarotOn('lovers', [c]).ok).toBe(true);
    expect(c.enhancement).toBe('wild');
    const s = mk('hearts', '2');
    expect(useTarotOn('tower', [s]).ok).toBe(true);
    expect(s.enhancement).toBe('stone');
  });

  test('星星/世界：花色转换', () => {
    const c = mk('clubs', '9');
    expect(useTarotOn('star', [c]).ok).toBe(true);
    expect(c.suit).toBe('diamonds');
  });

  test('隐者：金钱翻倍上限 +$20', () => {
    G.money = 7;
    const i1 = makeConsumable('tarot', 'hermit'); addConsumable(i1);
    useConsumable(i1.uid);
    expect(G.money).toBe(14);
    G.money = 33;
    const i2 = makeConsumable('tarot', 'hermit'); addConsumable(i2);
    useConsumable(i2.uid);
    expect(G.money).toBe(53);
  });

  test('力量：点数 +1，K→A、A→2', () => {
    const k = mk('spades', 'K'), a = mk('hearts', 'A');
    expect(useTarotOn('strength', [k, a]).ok).toBe(true);
    expect(k.rank).toBe('A');
    expect(a.rank).toBe('2');
  });

  test('倒吊人销毁；死神复制', () => {
    const c1 = mk('spades', '9'), c2 = mk('hearts', '7');
    G.hand = [c1, c2, mk('clubs', '2')];
    expect(useTarotOn('hanged_man', G.hand, 2).ok).toBe(true);
    expect(G.removedCards).toContain(c1);

    setupPlaying('DEATH');
    const left = mk('spades', '3');
    const right = mk('hearts', 'K', { enhancement: 'glass' });
    craft([left, right], 2);
    const inst = makeConsumable('tarot', 'death'); addConsumable(inst);
    expect(useConsumable(inst.uid).ok).toBe(true);
    expect(left.rank).toBe('K');
    expect(left.suit).toBe('hearts');
    expect(left.enhancement).toBe('glass');
  });

  test('节制：小丑出售价值和（≤$50）', () => {
    addJoker(G, makeJokerInstance('joker'));      // 卖 $1
    addJoker(G, makeJokerInstance('cavendish'));  // 卖 $2
    G.money = 0;
    const inst = makeConsumable('tarot', 'temperance'); addConsumable(inst);
    useConsumable(inst.uid);
    expect(G.money).toBe(3);
  });

  test('审判生成小丑；愚者复制上一张', () => {
    G.jokers = [];
    const j = makeConsumable('tarot', 'judgement'); addConsumable(j);
    expect(useConsumable(j.uid).ok).toBe(true);
    expect(G.jokers.length).toBe(1);

    // 上一张是审判 → 愚者复制出一张审判
    const fool = makeConsumable('tarot', 'fool'); addConsumable(fool);
    expect(useConsumable(fool.uid).ok).toBe(true);
    expect(G.consumables[0].id).toBe('judgement');
  });

  test('女祭司：生成星球受槽位限制', () => {
    G.consumables = [];
    const p = makeConsumable('tarot', 'priestess'); addConsumable(p);
    useConsumable(p.uid);
    expect(G.consumables.length).toBe(2); // 用掉自己后生成 2 张（槽位 2）
    expect(G.consumables.every(c => c.kind === 'planet')).toBe(true);
  });

  test('命运之轮：stub 命中 → 随机小丑获得版本', () => {
    addJoker(G, makeJokerInstance('joker'));
    G.rng = { ...G.rng, chance: () => true, random: () => 0.1, pick: a => a[0] };
    const w = makeConsumable('tarot', 'wheel_of_fortune'); addConsumable(w);
    expect(useConsumable(w.uid).ok).toBe(true);
    expect(G.jokers[0].edition).toBe('foil');
  });

  test('出售消耗牌 +$1', () => {
    const inst = makeConsumable('tarot', 'hermit'); addConsumable(inst);
    const m = G.money;
    sellConsumable(inst.uid);
    expect(G.money).toBe(m + 1);
    expect(G.consumables.length).toBe(0);
  });
});

describe('蜡封联动', () => {
  test('紫蜡封弃置生成塔罗', () => {
    setupPlaying('PURPLE');
    const c = mk('spades', '9', { seal: 'purple' });
    craft([c, ...G.hand.slice(0, 7)], 1);
    discardSelected();
    expect(G.consumables.length).toBe(1);
    expect(G.consumables[0].kind).toBe('tarot');
  });

  test('蓝蜡封回合末生成所打手型星球', () => {
    setupPlaying('BLUE');
    G.roundScore = 299;
    const blue = mk('clubs', '3', { seal: 'blue' });
    craft([mk('spades', '9'), mk('hearts', '9'), blue, ...G.hand.slice(0, 5)], 2);
    playSelected(); // 对子过关
    expect(G.phase).toBe(PHASES.ROUND_END);
    expect(G.consumables.some(c => c.kind === 'planet' && c.id === 'mercury')).toBe(true);
  });
});

describe('商店', () => {
  function toShop(seed = 'SHOP') {
    setupPlaying(seed);
    G.roundScore = 9999;
    craft([mk('spades', '9'), mk('hearts', '9'), ...G.hand.slice(0, 6)], 2);
    playSelected();
    leaveRoundEnd();
  }

  test('货架结构：2 卡位 + 2 卡包 + 1 优惠券', () => {
    toShop();
    expect(G.phase).toBe(PHASES.SHOP);
    expect(G.shop.slots.length).toBe(2);
    expect(G.shop.packs.length).toBe(2);
    expect(G.shop.voucher).toBeTruthy();
    for (const s of G.shop.slots) expect(s.price).toBeGreaterThan(0);
  });

  test('购买卡位商品扣款入库；资金不足拒绝', () => {
    toShop('SHOP2');
    G.money = 100;
    const s = G.shop.slots[0];
    const before = G.money;
    expect(buySlot(0)).toBe(true);
    expect(G.money).toBe(before - s.price);
    expect(s.sold).toBe(true);
    if (s.kind === 'joker') expect(G.jokers.length).toBe(1);
    else expect(G.consumables.length).toBe(1);

    G.money = 0;
    expect(buySlot(1)).toBe(false);
  });

  test('重掷：$5 起每次 +$1，只换卡位', () => {
    toShop('SHOP3');
    G.money = 100;
    expect(rerollCost()).toBe(5);
    const packsBefore = G.shop.packs.map(p => p.id).join();
    expect(rerollShop()).toBe(true);
    expect(G.money).toBe(95);
    expect(rerollCost()).toBe(6);
    expect(G.shop.packs.map(p => p.id).join()).toBe(packsBefore);
  });

  test('优惠券生效：抓取器 → 出牌 +1', () => {
    toShop('SHOP4');
    G.money = 100;
    G.shop.voucher = { id: 'grabber', price: 10 };
    expect(buyVoucher()).toBe(true);
    expect(G.config.hands).toBe(5);
    expect(G.vouchers).toContain('grabber');
  });

  test('天体包：购买 → 选取 → 消耗牌入槽 → 回到商店', () => {
    toShop('SHOP5');
    G.money = 100;
    G.shop.packs[0] = { id: 'celestial', price: 4 };
    expect(buyPack(0)).toBe(true);
    expect(G.phase).toBe(PHASES.BOOSTER);
    expect(G.booster.items.length).toBe(3);
    expect(pickBoosterItem(0).ok).toBe(true);
    expect(G.consumables.length).toBe(1);
    expect(G.phase).toBe(PHASES.SHOP);
  });

  test('标准包：选牌加入牌组', () => {
    toShop('SHOP6');
    G.money = 100;
    G.shop.packs[0] = { id: 'standard', price: 4 };
    const deckBefore = G.deck.length;
    buyPack(0);
    expect(pickBoosterItem(1).ok).toBe(true);
    expect(G.deck.length).toBe(deckBefore + 1);
  });

  test('小丑包跳过不拿', () => {
    toShop('SHOP7');
    G.money = 100;
    G.shop.packs[0] = { id: 'buffoon', price: 4 };
    buyPack(0);
    closeBooster();
    expect(G.phase).toBe(PHASES.SHOP);
    expect(G.jokers.length).toBe(0);
  });
});
