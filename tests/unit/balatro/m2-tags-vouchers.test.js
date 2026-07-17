import { describe, test, expect } from 'vitest';
import '../../../src/balatro/public/js/effects/joker-effects.js';
import { G, PHASES } from '../../../src/balatro/public/js/state.js';
import { startRun, startBlind, skipBlind, toggleSelect, playSelected, leaveRoundEnd } from '../../../src/balatro/public/js/round.js';
import { gainTag } from '../../../src/balatro/public/js/tags.js';
import { TAGS } from '../../../src/balatro/public/js/data/tags.js';
import { VOUCHERS, applyVoucher, purchasableVouchers } from '../../../src/balatro/public/js/data/vouchers.js';
import { buyVoucher, rerollCost, pickBoosterItem, closeBooster } from '../../../src/balatro/public/js/shop.js';
import { makeCard } from '../../../src/balatro/public/js/data/card-data.js';
import { serializeRun, deserializeRun } from '../../../src/balatro/public/js/serialize.js';

const mk = (suit, rank, opts) => makeCard(suit, rank, opts);

function toShop(seed = 'F1') {
  startRun({ seed });
  startBlind();
  G.roundScore = 9999;
  G.hand = [mk('spades', '9'), mk('hearts', '9'), ...G.hand.slice(0, 6)];
  G.selected = [];
  toggleSelect(G.hand[0].id); toggleSelect(G.hand[1].id);
  playSelected();
  leaveRoundEnd();
}

describe('M2-F 标签', () => {
  test('24 个标签数据完整', () => {
    expect(TAGS.length).toBe(24);
  });

  test('跳过盲注获得标签并推进', () => {
    startRun({ seed: 'TAG1' });
    expect(skipBlind()).toBe(true);
    expect(G.blindsSkipped).toBe(1);
  });

  test('经济标签：翻倍上限 +$40', () => {
    startRun({ seed: 'TAG2' });
    G.money = 30;
    gainTag('economy');
    expect(G.money).toBe(60);
    G.money = 100;
    gainTag('economy');
    expect(G.money).toBe(140);
  });

  test('投资标签：击败 Boss +$25', () => {
    startRun({ seed: 'TAG3' });
    gainTag('investment');
    G.blindIndex = 2;
    startBlind({ forceBossId: 'needle' });
    G.roundScore = 9999;
    G.money = 0;
    toggleSelect(G.hand[0].id);
    playSelected();
    expect(G.money).toBeGreaterThanOrEqual(25);
  });

  test('加倍标签：下一个标签双倍生效', () => {
    startRun({ seed: 'TAG4' });
    gainTag('double');
    G.money = 10;
    gainTag('speed');   // +$5 ×2
    expect(G.money).toBe(20);
  });

  test('版本标签：下一张购买的小丑带版本', () => {
    startRun({ seed: 'TAG5' });
    gainTag('negative');
    expect(G.pendingJokerEditions).toEqual(['negative']);
  });

  test('轨道标签：随机手型 +3 级', () => {
    startRun({ seed: 'TAG6' });
    gainTag('orbital');
    const levels = Object.values(G.handLevels);
    expect(Math.max(...levels)).toBe(4);
  });

  test('包标签：跳盲后免费开特大包（5 选 2）再回盲注选择', () => {
    startRun({ seed: 'TAG7' });
    gainTag('celestial');
    expect(G.pendingMegaPacks).toEqual(['celestial']);
    // gotoBlindSelect 触发开包
    skipBlind();
    expect(G.phase).toBe(PHASES.BOOSTER);
    expect(G.booster.items.length).toBe(5);
    expect(G.booster.picks).toBe(2);
    pickBoosterItem(0);
    pickBoosterItem(1);
    expect(G.phase).toBe(PHASES.BLIND_SELECT);
    expect(G.consumables.length).toBe(2);
  });

  test('D6 标签：下个商店重掷 $0', () => {
    startRun({ seed: 'TAG8' });
    gainTag('d6');
    toShopFrom();
    expect(rerollCost()).toBe(0);
  });
  function toShopFrom() {
    G.roundScore = 9999;
    startBlind();
    G.roundScore = 9999;
    toggleSelect(G.hand[0].id);
    playSelected();
    leaveRoundEnd();
  }
});

describe('M2-F 优惠券', () => {
  test('32 张：16 基础 + 16 升级', () => {
    expect(VOUCHERS.length).toBe(32);
    expect(VOUCHERS.filter(v => v.upgradeOf).length).toBe(16);
  });

  test('升级券需先拥有基础券', () => {
    startRun({ seed: 'V1' });
    const pool1 = purchasableVouchers(G);
    expect(pool1.some(v => v.upgradeOf)).toBe(false);
    applyVoucher(G, 'grabber');
    const pool2 = purchasableVouchers(G);
    expect(pool2.some(v => v.id === 'grabber_plus')).toBe(true);
    expect(pool2.some(v => v.id === 'grabber')).toBe(false);
  });

  test('配对叠加：抓取器 + 抓取器+ → 出牌 +2', () => {
    startRun({ seed: 'V2' });
    applyVoucher(G, 'grabber');
    applyVoucher(G, 'grabber_plus');
    expect(G.config.hands).toBe(6);
  });

  test('清仓 → 清仓+：折扣取更低', () => {
    startRun({ seed: 'V3' });
    applyVoucher(G, 'clearance_sale');
    expect(G.config.shopDiscount).toBe(0.75);
    applyVoucher(G, 'clearance_sale_plus');
    expect(G.config.shopDiscount).toBe(0.5);
  });

  test('商店购买优惠券走新管线', () => {
    toShop('V4');
    G.money = 100;
    if (G.shop.voucher) {
      const id = G.shop.voucher.id;
      expect(buyVoucher('voucher')).toBe(true);
      expect(G.vouchers).toContain(id);
    }
  });
});

describe('M2-F 存档兼容', () => {
  test('M2 字段序列化往返', () => {
    startRun({ seed: 'SAVE2' });
    gainTag('investment');
    gainTag('negative');
    G.tarotUsedCount = 5;
    G.blindsSkipped = 2;
    const snap = JSON.parse(JSON.stringify(serializeRun()));
    expect(snap.version).toBe(2);
    startRun({ seed: 'OTHER' });
    expect(deserializeRun(snap)).toBe(true);
    expect(G.investmentTags).toBe(1);
    expect(G.pendingJokerEditions).toEqual(['negative']);
    expect(G.tarotUsedCount).toBe(5);
    expect(G.blindsSkipped).toBe(2);
  });

  test('v1 旧存档被拒绝', () => {
    expect(deserializeRun({ version: 1, seed: 'X', deck: [] })).toBe(false);
  });
});
