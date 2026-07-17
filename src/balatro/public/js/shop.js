// shop.js — 商店与卡包：货架生成/购买/重掷/卡包开启
import { G, PHASES, bus, setPhase } from './state.js';
import { JOKERS } from './data/jokers.js';
import { VOUCHERS, VOUCHER_MAP } from './data/vouchers.js';
import { PLANETS } from './data/planets.js';
import { SUITS, RANKS, makeCard } from './data/card-data.js';
import { makeConsumable, addConsumable, randomPlanetId, randomTarotId } from './consumable-manager.js';
import { makeJokerInstance, addJoker } from './joker-manager.js';
import { dispatchHook } from './effects/index.js';

export const PACKS = [
  { id: 'standard',  zh: '标准包', desc: '3 张游戏牌选 1 加入牌组', price: 4, picks: 1, count: 3 },
  { id: 'arcana',    zh: '奥术包', desc: '3 张塔罗牌选 1', price: 4, picks: 1, count: 3 },
  { id: 'celestial', zh: '天体包', desc: '3 张星球牌选 1', price: 4, picks: 1, count: 3 },
  { id: 'buffoon',   zh: '小丑包', desc: '2 张小丑牌选 1', price: 4, picks: 1, count: 2 },
];
export const PACK_MAP = Object.fromEntries(PACKS.map(p => [p.id, p]));

const EDITION_PRICE = { foil: 2, holographic: 3, polychrome: 5, negative: 5 };

const price = v => Math.max(1, Math.round(v * G.config.shopDiscount));

/** 版本掷骰（磨砺加倍非负片概率） */
export function rollEdition(rng, rateMult = 1) {
  const r = rng.random();
  const f = 0.02 * rateMult, h = 0.014 * rateMult, p = 0.003 * rateMult, n = 0.003;
  if (r < f) return 'foil';
  if (r < f + h) return 'holographic';
  if (r < f + h + p) return 'polychrome';
  if (r < f + h + p + n) return 'negative';
  return null;
}

/** 进入商店：生成货架（leaveRoundEnd 调用） */
export function enterShopGen() {
  G.shopReroll = 0;
  G.shop = { slots: genSlots(), packs: genPacks(), voucher: genVoucher() };
  bus.emit('shop:stock');
}

function genSlots() {
  const out = [];
  for (let i = 0; i < G.config.shopSlots; i++) {
    const r = G.rng.random();
    if (r < 0.6) out.push(genJokerItem());
    else if (r < 0.8) out.push({ kind: 'tarot', id: randomTarotId(G.rng), price: price(3) });
    else out.push({ kind: 'planet', id: randomPlanetId(G.rng), price: price(3) });
  }
  return out;
}

function genJokerItem() {
  const owned = new Set(G.jokers.map(j => j.id));
  const rr = G.rng.random();
  const rarity = rr < 0.70 ? 'common' : rr < 0.95 ? 'uncommon' : 'rare';
  let pool = JOKERS.filter(j => j.rarity === rarity && !owned.has(j.id));
  if (!pool.length) pool = JOKERS.filter(j => !owned.has(j.id));
  if (!pool.length) pool = JOKERS;
  const def = G.rng.pick(pool);
  const edition = rollEdition(G.rng, G.config.editionRateMult);
  return { kind: 'joker', id: def.id, edition,
           price: price(def.cost + (edition ? EDITION_PRICE[edition] : 0)) };
}

function genPacks() {
  return [G.rng.pick(PACKS), G.rng.pick(PACKS)].map(p => ({ id: p.id, price: price(p.price) }));
}

function genVoucher() {
  const pool = VOUCHERS.filter(v => !G.vouchers.includes(v.id));
  return pool.length ? { id: G.rng.pick(pool).id, price: price(10) } : null;
}

function pay(cost) {
  if (G.money < cost) { bus.emit('ui:reject', { reason: '资金不足' }); return false; }
  G.money -= cost;
  return true;
}

/** 购买卡位商品 */
export function buySlot(i) {
  const s = G.shop?.slots[i];
  if (!s || s.sold) return false;
  if (s.kind === 'joker') {
    const inst = makeJokerInstance(s.id, { edition: s.edition });
    if (G.jokers.length >= G.config.jokerSlots + G.jokers.filter(j => j.edition === 'negative').length + (s.edition === 'negative' ? 1 : 0)) {
      bus.emit('ui:reject', { reason: '小丑牌槽已满（右键出售）' }); return false;
    }
    if (!pay(s.price)) return false;
    addJoker(G, inst);
  } else {
    if (G.consumables.length >= G.config.consumableSlots) {
      bus.emit('ui:reject', { reason: '消耗牌槽已满' }); return false;
    }
    if (!pay(s.price)) return false;
    addConsumable(makeConsumable(s.kind, s.id));
  }
  s.sold = true;
  bus.emit('shop:stock');
  return true;
}

export function buyVoucher() {
  const v = G.shop?.voucher;
  if (!v || v.sold || !pay(v.price)) return false;
  VOUCHER_MAP[v.id].apply(G);
  G.vouchers.push(v.id);
  v.sold = true;
  bus.emit('shop:stock');
  bus.emit('voucher:bought', { id: v.id });
  return true;
}

export function rerollCost() {
  return Math.max(0, G.config.rerollBase + G.shopReroll - G.config.rerollDiscount);
}

export function rerollShop() {
  if (!pay(rerollCost())) return false;
  G.shopReroll++;
  G.shop.slots = genSlots();     // 卡包/优惠券不重掷（与原作一致）
  dispatchHook(G.jokers, 'onReroll', G);
  bus.emit('shop:stock');
  return true;
}

// ===== 卡包 =====

export function buyPack(i) {
  const p = G.shop?.packs[i];
  if (!p || p.sold) return false;
  if (!pay(p.price)) return false;
  p.sold = true;
  const def = PACK_MAP[p.id];
  G.booster = { packId: p.id, zh: def.zh, picks: def.picks, items: genPackItems(p.id, def.count) };
  setPhase(PHASES.BOOSTER);
  return true;
}

function genPackItems(packId, count) {
  const rng = G.rng;
  switch (packId) {
    case 'standard':
      return Array.from({ length: count }, () => {
        const card = makeCard(rng.pick(SUITS), rng.pick(RANKS));
        if (rng.chance(0.25)) card.enhancement = rng.pick(['bonus', 'mult', 'wild', 'glass', 'steel', 'gold', 'lucky']);
        if (rng.chance(0.08)) card.seal = rng.pick(['red', 'gold', 'blue', 'purple']);
        if (rng.chance(0.04)) card.edition = rng.pick(['foil', 'holographic', 'polychrome']);
        return { kind: 'card', card };
      });
    case 'arcana':
      return Array.from({ length: count }, () => ({ kind: 'tarot', id: randomTarotId(rng) }));
    case 'celestial': {
      const items = Array.from({ length: count }, () => ({ kind: 'planet', id: randomPlanetId(rng) }));
      if (G.config.telescope) {
        // 望远镜：首位必为最常打手型的星球
        const top = Object.entries(G.handPlayed).sort((a, b) => b[1] - a[1])[0];
        const p = top && PLANETS.find(x => x.hand === top[0]);
        if (p) items[0] = { kind: 'planet', id: p.id };
      }
      return items;
    }
    case 'buffoon': {
      const owned = new Set(G.jokers.map(j => j.id));
      const pool = JOKERS.filter(j => !owned.has(j.id));
      return Array.from({ length: count }, () => ({ kind: 'joker', id: rng.pick(pool.length ? pool : JOKERS).id }));
    }
  }
  return [];
}

/** 从卡包中拿一件 */
export function pickBoosterItem(idx) {
  const b = G.booster;
  const item = b?.items[idx];
  if (!item || item.taken) return { ok: false, msg: '无效选择' };
  let res = { ok: true, msg: '' };
  if (item.kind === 'card') {
    const pos = G.rng.int(0, G.deck.length);
    G.deck.splice(pos, 0, item.card);
    dispatchHook(G.jokers, 'onCardAdded', G, item.card);   // 「全息影像」等
    res.msg = '已加入牌组';
  } else if (item.kind === 'joker') {
    const inst = makeJokerInstance(item.id);
    res = addJoker(G, inst) ? { ok: true, msg: `获得「${inst.zh}」` } : { ok: false, msg: '小丑牌槽已满' };
  } else {
    res = addConsumable(makeConsumable(item.kind, item.id))
      ? { ok: true, msg: '已加入消耗牌' } : { ok: false, msg: '消耗牌槽已满' };
  }
  if (res.ok) {
    item.taken = true;
    b.picks--;
    if (b.picks <= 0) closeBooster();
    else bus.emit('booster:change');
  } else {
    bus.emit('ui:reject', { reason: res.msg });
  }
  return res;
}

export function closeBooster() {
  if (G.booster && G.booster.picks > 0) dispatchHook(G.jokers, 'onBoosterSkipped', G);
  G.booster = null;
  setPhase(PHASES.SHOP);
  bus.emit('shop:stock');
}
