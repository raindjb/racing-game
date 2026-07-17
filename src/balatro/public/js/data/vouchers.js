// data/vouchers.js — M1 优惠券骨架（8 张基础款，$10）
// apply(G) 购买时生效一次，整局持续。
export const VOUCHERS = [
  { id: 'overstock',      zh: '超量库存',   desc: '商店卡位 +1',
    apply: G => { G.config.shopSlots += 1; } },
  { id: 'clearance_sale', zh: '清仓甩卖',   desc: '商店全场 75 折',
    apply: G => { G.config.shopDiscount = 0.75; } },
  { id: 'reroll_surplus', zh: '重掷盈余',   desc: '重掷便宜 $2',
    apply: G => { G.config.rerollDiscount += 2; } },
  { id: 'crystal_ball',   zh: '水晶球',     desc: '消耗牌槽位 +1',
    apply: G => { G.config.consumableSlots += 1; } },
  { id: 'grabber',        zh: '抓取器',     desc: '每回合出牌次数 +1',
    apply: G => { G.config.hands += 1; } },
  { id: 'wasteful',       zh: '回收站',     desc: '每回合弃牌次数 +1',
    apply: G => { G.config.discards += 1; } },
  { id: 'hone',           zh: '磨砺',       desc: '版本卡出现率 ×2',
    apply: G => { G.config.editionRateMult *= 2; } },
  { id: 'telescope',      zh: '望远镜',     desc: '天体包必含最常打手型的星球',
    apply: G => { G.config.telescope = true; } },
];
export const VOUCHER_MAP = Object.fromEntries(VOUCHERS.map(v => [v.id, v]));
