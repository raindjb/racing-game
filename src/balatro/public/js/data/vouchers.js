// data/vouchers.js — 32 张优惠券（16 基础 + 16 配对升级，升级需先拥有基础）
export const VOUCHERS = [
  // ── 16 基础 ──
  { id: 'overstock',      zh: '超量库存',   desc: '商店卡位 +1', config: { shopSlots: 1 } },
  { id: 'clearance_sale', zh: '清仓甩卖',   desc: '商店全场 75 折', config: { shopDiscount: 0.75 } },
  { id: 'reroll_surplus', zh: '重掷盈余',   desc: '重掷便宜 $2', config: { rerollDiscount: 2 } },
  { id: 'crystal_ball',   zh: '水晶球',     desc: '消耗牌槽位 +1', config: { consumableSlots: 1 } },
  { id: 'grabber',        zh: '抓取器',     desc: '每回合 +1 次出牌', config: { hands: 1 } },
  { id: 'wasteful',       zh: '回收站',     desc: '每回合 +1 次弃牌', config: { discards: 1 } },
  { id: 'hone',           zh: '磨砺',       desc: '版本卡出现率 ×2', config: { editionRateMult: 2 } },
  { id: 'telescope',      zh: '望远镜',     desc: '天体包必含最常打手型的星球', config: { telescope: true } },
  { id: 'hierarchy',      zh: '层级',       desc: '手牌上限 +1', config: { handSize: 1 } },
  { id: 'tarot_merchant', zh: '塔罗商人',   desc: '商店塔罗牌出现率提高', config: { tarotWeight: 2 } },
  { id: 'planet_merchant', zh: '星球商人',  desc: '商店星球牌出现率提高', config: { planetWeight: 2 } },
  { id: 'seed_money',     zh: '种子资金',   desc: '利息上限 +$5', config: { interestCapAdd: 5 } },
  { id: 'antimatter',     zh: '反物质',     desc: '+1 小丑牌槽位', config: { jokerSlots: 1 } },
  { id: 'magic_trick',    zh: '魔术戏法',   desc: '商店可能出售游戏牌', config: { shopCards: 1 } },
  { id: 'illusion',       zh: '幻象',       desc: '商店塔罗位可能出现幻灵牌', config: { spectralWeight: 1 } },
  { id: 'hieroglyph',     zh: '象形文字',   desc: '每回合出牌 +1，弃牌 -1', config: { hands: 1, discards: -1 } },
  // ── 16 升级（需先拥有基础） ──
  { id: 'overstock_plus',      zh: '超量库存+',  desc: '商店卡位再 +1', config: { shopSlots: 1 }, upgradeOf: 'overstock' },
  { id: 'clearance_sale_plus', zh: '清仓甩卖+',  desc: '商店全场 5 折', config: { shopDiscount: 0.5 }, upgradeOf: 'clearance_sale' },
  { id: 'reroll_surplus_plus', zh: '重掷盈余+',  desc: '重掷再便宜 $2', config: { rerollDiscount: 2 }, upgradeOf: 'reroll_surplus' },
  { id: 'crystal_ball_plus',   zh: '水晶球+',    desc: '消耗牌槽位再 +1', config: { consumableSlots: 1 }, upgradeOf: 'crystal_ball' },
  { id: 'grabber_plus',        zh: '抓取器+',    desc: '每回合再 +1 次出牌', config: { hands: 1 }, upgradeOf: 'grabber' },
  { id: 'wasteful_plus',       zh: '回收站+',    desc: '每回合再 +1 次弃牌', config: { discards: 1 }, upgradeOf: 'wasteful' },
  { id: 'hone_plus',           zh: '磨砺+',      desc: '版本卡出现率再 ×2', config: { editionRateMult: 2 }, upgradeOf: 'hone' },
  { id: 'telescope_plus',      zh: '望远镜+',    desc: '天体包 +1 张牌', config: { telescopePlus: true }, upgradeOf: 'telescope' },
  { id: 'hierarchy_plus',      zh: '层级+',      desc: '手牌上限再 +1', config: { handSize: 1 }, upgradeOf: 'hierarchy' },
  { id: 'tarot_merchant_plus', zh: '塔罗商人+',  desc: '塔罗出现率大幅提高', config: { tarotWeight: 2 }, upgradeOf: 'tarot_merchant' },
  { id: 'planet_merchant_plus', zh: '星球商人+', desc: '星球出现率大幅提高', config: { planetWeight: 2 }, upgradeOf: 'planet_merchant' },
  { id: 'seed_money_plus',     zh: '种子资金+',  desc: '利息上限再 +$5', config: { interestCapAdd: 5 }, upgradeOf: 'seed_money' },
  { id: 'antimatter_plus',     zh: '反物质+',    desc: '再 +1 小丑牌槽位', config: { jokerSlots: 1 }, upgradeOf: 'antimatter' },
  { id: 'magic_trick_plus',    zh: '魔术戏法+',  desc: '商店游戏牌带强化', config: { shopCards: 1 }, upgradeOf: 'magic_trick' },
  { id: 'illusion_plus',       zh: '幻象+',      desc: '幻灵出现率提高', config: { spectralWeight: 1 }, upgradeOf: 'illusion' },
  { id: 'hieroglyph_plus',     zh: '象形文字+',  desc: '每回合出牌再 +1', config: { hands: 1 }, upgradeOf: 'hieroglyph' },
];
export const VOUCHER_MAP = Object.fromEntries(VOUCHERS.map(v => [v.id, v]));

/** 购买优惠券后应用生效（config delta 模型） */
export function applyVoucher(G, id) {
  const v = VOUCHER_MAP[id];
  if (!v) return false;
  if (!G.vouchers.includes(id)) G.vouchers.push(id);
  const c = v.config ?? {};
  G.config.shopSlots += c.shopSlots ?? 0;
  if (c.shopDiscount) G.config.shopDiscount = Math.min(G.config.shopDiscount, c.shopDiscount);
  G.config.rerollDiscount += c.rerollDiscount ?? 0;
  if (c.editionRateMult) G.config.editionRateMult = (G.config.editionRateMult ?? 1) * c.editionRateMult;
  G.config.consumableSlots += c.consumableSlots ?? 0;
  G.config.hands += c.hands ?? 0;
  G.config.discards += c.discards ?? 0;
  G.config.jokerSlots += c.jokerSlots ?? 0;
  G.config.handSize += c.handSize ?? 0;
  G.config.interestCap += c.interestCapAdd ?? 0;
  if (c.telescope) G.config.telescope = true;
  if (c.telescopePlus) G.config.telescopePlus = true;
  if (c.tarotWeight) G.config.tarotWeight = (G.config.tarotWeight ?? 0) + c.tarotWeight;
  if (c.planetWeight) G.config.planetWeight = (G.config.planetWeight ?? 0) + c.planetWeight;
  if (c.spectralWeight) G.config.spectralWeight = (G.config.spectralWeight ?? 0) + c.spectralWeight;
  if (c.shopCards != null) G.config.shopCards = (G.config.shopCards ?? 0) + c.shopCards;
  return true;
}

/** 可购买池：未拥有的基础券 + 基础已拥有的升级券 */
export function purchasableVouchers(G) {
  return VOUCHERS.filter(v =>
    !G.vouchers.includes(v.id) &&
    (!v.upgradeOf || G.vouchers.includes(v.upgradeOf)));
}
