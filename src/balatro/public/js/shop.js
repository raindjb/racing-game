// shop.js — 商店与卡包：货架生成/购买/重掷/卡包开启
import { G, PHASES, bus, setPhase } from './state.js';
import { JOKERS } from './data/jokers.js';
import { VOUCHERS, VOUCHER_MAP, applyVoucher, purchasableVouchers } from './data/vouchers.js';
import { PLANETS } from './data/planets.js';
import { SUITS, RANKS, makeCard } from './data/card-data.js';
import { makeConsumable, addConsumable, randomPlanetId, randomTarotId, randomSpectralId } from './consumable-manager.js';
import { makeJokerInstance, addJoker } from './joker-manager.js';
import { dispatchHook } from './effects/index.js';

export const PACKS = [
  { id: 'standard',  zh: '标准包', desc: '3 张游戏牌选 1 加入牌组', price: 4, picks: 1, count: 3, weight: 1 },
  { id: 'arcana',    zh: '奥术包', desc: '3 张塔罗牌选 1', price: 4, picks: 1, count: 3, weight: 1 },
  { id: 'celestial', zh: '天体包', desc: '3 张星球牌选 1', price: 4, picks: 1, count: 3, weight: 1 },
  { id: 'buffoon',   zh: '小丑包', desc: '2 张小丑牌选 1', price: 4, picks: 1, count: 2, weight: 1 },
  { id: 'spectral',  zh: '幻灵包', desc: '2 张幻灵牌选 1', price: 4, picks: 1, count: 2, weight: 0.3 },
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

/** 进入商店：生成货架（leaveRoundEnd 调用）；消耗待生效的商店标签 */
export function enterShopGen() {
  G.shopReroll = 0;
  G.activeShopFlags = G.shopFlags ?? {};
  G.shopFlags = null;
  G.shop = {
    slots: genSlots(),
    packs: genPacks(),
    voucher: genVoucher(),
    voucher2: G.activeShopFlags.extraVoucher ? genVoucher(1) : null,
  };
  if (G.activeShopFlags.coupon) {
    // 优惠券标签：初始卡包与优惠券免费
    for (const p of G.shop.packs) p.price = 0;
    if (G.shop.voucher) G.shop.voucher.price = 0;
    if (G.shop.voucher2) G.shop.voucher2.price = 0;
  }
  bus.emit('shop:stock');
}

function genSlots() {
  const out = [];
  const freePlanets = G.jokers.some(j => j.id === 'astronomer');
  const cfg = G.config;
  // 权重：小丑 12 / 塔罗 2(+商人) / 星球 2(+商人) / 幻灵(幻象券) / 游戏牌(魔术戏法券)
  const wJoker = 12;
  const wTarot = 2 + (cfg.tarotWeight ?? 0) * 2;
  const wPlanet = 2 + (cfg.planetWeight ?? 0) * 2;
  const wSpectral = (cfg.spectralWeight ?? 0) * 2;
  const wCard = (cfg.shopCards ?? 0) * 2;
  const total = wJoker + wTarot + wPlanet + wSpectral + wCard;
  for (let i = 0; i < cfg.shopSlots; i++) {
    let r = G.rng.random() * total;
    if ((r -= wJoker) < 0) { out.push(genJokerItem()); continue; }
    if ((r -= wTarot) < 0) { out.push({ kind: 'tarot', id: randomTarotId(G.rng), _basePrice: 3, price: price(3) }); continue; }
    if ((r -= wPlanet) < 0) { out.push({ kind: 'planet', id: randomPlanetId(G.rng), _basePrice: 3, price: freePlanets ? 0 : price(3) }); continue; }
    if ((r -= wSpectral) < 0) { out.push({ kind: 'spectral', id: randomSpectralId(G.rng), _basePrice: 4, price: price(4) }); continue; }
    // 魔术戏法：游戏牌上架
    const card = makeCard(G.rng.pick(SUITS), G.rng.pick(RANKS));
    if ((cfg.shopCards ?? 0) >= 2 && G.rng.chance(0.5)) {
      card.enhancement = G.rng.pick(['bonus', 'mult', 'wild', 'glass', 'steel', 'gold', 'lucky']);
    }
    out.push({ kind: 'card', card, price: price(1) });
  }
  return out;
}

function genJokerItem() {
  // 「主持人」：允许重复出现
  const showman = G.jokers.some(j => j.id === 'showman');
  const owned = showman ? new Set() : new Set(G.jokers.map(j => j.id));
  const rr = G.rng.random();
  const rarity = rr < 0.70 ? 'common' : rr < 0.95 ? 'uncommon' : 'rare';
  let pool = JOKERS.filter(j => j.rarity === rarity && !owned.has(j.id));
  if (!pool.length) pool = JOKERS.filter(j => j.rarity !== 'legendary' && !owned.has(j.id));
  if (!pool.length) pool = JOKERS.filter(j => j.rarity !== 'legendary');
  const def = G.rng.pick(pool);
  const edition = rollEdition(G.rng, G.config.editionRateMult);
  const baseP = def.cost + (edition ? EDITION_PRICE[edition] : 0);
  return { kind: 'joker', id: def.id, edition,
           _basePrice: baseP, price: price(baseP) };
}

function genPacks() {
  const freeCelestial = G.jokers.some(j => j.id === 'astronomer');
  const weighted = PACKS.flatMap(p => Array(Math.round(p.weight * 10)).fill(p));
  const pick = () => G.rng.pick(weighted);
  return [pick(), pick()].map(p =>
    ({ id: p.id, price: p.id === 'celestial' && freeCelestial ? 0 : price(p.price) }));
}

function genVoucher(skip = 0) {
  const pool = purchasableVouchers(G);
  return pool.length > skip ? { id: G.rng.pick(pool).id, price: price(10) } : null;
}

function payAllowFree(cost) { return cost === 0 || pay(cost); }

/** 购买优惠券（which: 'voucher' | 'voucher2'） */
export function buyVoucher(which = 'voucher') {
  const v = G.shop?.[which];
  if (!v || v.sold) return false;
  if (v.price > 0 && !pay(v.price)) return false;
  applyVoucher(G, v.id);
  // 折扣券生效后，立刻重新计算所有受影响的价格
  for (const slot of G.shop?.slots ?? []) {
    if (!slot.sold) slot.price = price(slot._basePrice ?? slot.price);
  }
  for (const p of G.shop?.packs ?? []) {
    if (!p.sold) p.price = price(PACK_MAP[p.id]?.price ?? p.price);
  }
  v.sold = true;
  bus.emit('shop:stock');
  bus.emit('voucher:bought', { id: v.id });
  return true;
}

function pay(cost) {
  // 「信用卡」：可透支至 -$20
  const floor = G.jokers.some(j => j.id === 'credit_card') ? -20 : 0;
  if (G.money - cost < floor) { bus.emit('ui:reject', { reason: '资金不足' }); return false; }
  G.money -= cost;
  return true;
}

/** 购买卡位商品 */
export function buySlot(i) {
  const s = G.shop?.slots[i];
  if (!s || s.sold) return false;
  if (s.kind === 'joker') {
    let ed = s.edition;
    if (!ed && G.pendingJokerEditions?.length) ed = G.pendingJokerEditions.shift();
    const inst = makeJokerInstance(s.id, { edition: ed });
    if (G.jokers.length >= G.config.jokerSlots + G.jokers.filter(j => j.edition === 'negative').length + (ed === 'negative' ? 1 : 0)) {
      bus.emit('ui:reject', { reason: '小丑牌槽已满（右键出售）' }); return false;
    }
    if (!pay(s.price)) return false;
    addJoker(G, inst);
  } else if (s.kind === 'card') {
    if (!pay(s.price)) return false;
    G.deck.splice(G.rng.int(0, G.deck.length), 0, s.card);
    dispatchHook(G.jokers, 'onCardAdded', G, s.card);
    s.sold = true;
    bus.emit('shop:stock');
    return true;
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

export function rerollCost() {
  if (G.activeShopFlags?.d6) return 0;   // D6 标签：重掷从 $0 起
  if (G.shopReroll === 0 && G.jokers.some(j => j.id === 'chaos_the_clown')) return 0;
  const base = G.activeShopFlags?.d6 ? 0 : G.config.rerollBase;
  return Math.max(0, (base + G.shopReroll) - G.config.rerollDiscount);
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
  if (p.price > 0 && !pay(p.price)) return false;
  p.sold = true;
  const def = PACK_MAP[p.id];
  G.boosterReturnPhase = PHASES.SHOP;
  G.booster = { packId: p.id, zh: def.zh, picks: def.picks, items: genPackItems(p.id, def.count) };
  dispatchHook(G.jokers, 'onPackOpened', G);    // 幻觉：开包 50% 生成塔罗
  setPhase(PHASES.BOOSTER);
  return true;
}

/** 免费开特大包（标签奖励：5 选 2；returnPhase = 开完回到的阶段） */
export function openFreePack(packId, returnPhase = PHASES.SHOP) {
  const def = PACK_MAP[packId];
  if (!def) return false;
  G.boosterReturnPhase = returnPhase;
  G.booster = { packId, zh: `特大${def.zh}`, picks: 2, items: genPackItems(packId, def.count + 2), free: true };
  dispatchHook(G.jokers, 'onPackOpened', G);
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
      const pool = JOKERS.filter(j => j.rarity !== 'legendary' && !owned.has(j.id));
      return Array.from({ length: count }, () => ({ kind: 'joker', id: rng.pick(pool.length ? pool : JOKERS.filter(j => j.rarity !== 'legendary')).id }));
    }
    case 'spectral':
      return Array.from({ length: count }, () => ({ kind: 'spectral', id: randomSpectralId(rng) }));
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
    let ed = item.edition ?? null;
    if (!ed && G.pendingJokerEditions?.length) ed = G.pendingJokerEditions.shift();
    const inst = makeJokerInstance(item.id, { edition: ed });
    res = addJoker(G, inst) ? { ok: true, msg: `获得「${inst.zh}」` } : { ok: false, msg: '小丑牌槽已满' };
  } else {
    // 塔罗/星球/幻灵统一进消耗牌槽
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
  const ret = G.boosterReturnPhase ?? PHASES.SHOP;
  G.boosterReturnPhase = null;
  if (ret === PHASES.BLIND_SELECT && G.pendingMegaPacks?.length) {
    openFreePack(G.pendingMegaPacks.shift(), PHASES.BLIND_SELECT);   // 连开多个标签包
    return;
  }
  setPhase(ret);
  if (ret === PHASES.SHOP) bus.emit('shop:stock');
}
