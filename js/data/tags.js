// data/tags.js — 24 个跳盲注标签（skipBlind 时获得）
export const TAGS = [
  // ── 立即生效 ──
  { id: 'uncommon',       zh: '罕见标签',     desc: '生成一张罕见小丑牌', fx: 'rare_joker', rarity: 'uncommon' },
  { id: 'rare',           zh: '稀有标签',     desc: '生成一张稀有小丑牌', fx: 'rare_joker', rarity: 'rare' },
  { id: 'negative',       zh: '负片标签',     desc: '下一张小丑牌获得负片版本', fx: 'edition', edition: 'negative' },
  { id: 'foil',           zh: '闪箔标签',     desc: '下一张小丑牌获得闪箔版本', fx: 'edition', edition: 'foil' },
  { id: 'holographic',    zh: '镭射标签',     desc: '下一张小丑牌获得镭射版本', fx: 'edition', edition: 'holographic' },
  { id: 'polychrome',     zh: '多彩标签',     desc: '下一张小丑牌获得多彩版本', fx: 'edition', edition: 'polychrome' },
  { id: 'investment',     zh: '投资标签',     desc: '击败 Boss 后 +$25', fx: 'investment', v: 25 },
  { id: 'coupon',         zh: '优惠券标签',   desc: '下一个商店初始优惠券和卡包免费', fx: 'coupon' },
  { id: 'voucher',        zh: '凭证标签',     desc: '下一个商店额外新增一张优惠券', fx: 'voucher' },
  { id: 'boss',           zh: 'Boss 标签',    desc: '重抽 Boss 盲注', fx: 'boss' },
  { id: 'double',         zh: '加倍标签',     desc: '下一个标签加倍生效（不可叠加）', fx: 'double' },
  { id: 'standard',       zh: '标准包标签',   desc: '免费开启一个特大标准包', fx: 'mega_pack', packId: 'standard' },
  { id: 'arcane',         zh: '奥术包标签',   desc: '免费开启一个特大奥术包', fx: 'mega_pack', packId: 'arcana' },
  { id: 'celestial',      zh: '天体包标签',   desc: '免费开启一个特大天体包', fx: 'mega_pack', packId: 'celestial' },
  { id: 'buffoon',        zh: '小丑包标签',   desc: '免费开启一个特大小丑包', fx: 'mega_pack', packId: 'buffoon' },
  // ── 商店触发 ──
  { id: 'juggle',         zh: '杂耍标签',     desc: '下一盲注手牌上限 +3', fx: 'juggle_bonus' },
  { id: 'd6',              zh: 'D6 标签',      desc: '下一个商店重掷从 $0 起', fx: 'shop_flag', config: 'd6' },
  // ── 回合开始 ──
  { id: 'orbital',        zh: '轨道标签',     desc: '提升一个随机手型的等级×3', fx: 'orbital' },
  { id: 'top_up',         zh: '补给标签',     desc: '生成最多 2 张普通小丑牌', fx: 'top_up' },
  { id: 'handy',          zh: '顺手标签',     desc: '下一盲注 +1 次出牌 +1 次弃牌', fx: 'handy' },
  { id: 'garbage',        zh: '垃圾标签',     desc: '下一盲注 +$1 每剩余弃牌', fx: 'economy', v: 1 },
  { id: 'economy',        zh: '经济标签',     desc: '存款翻倍（最多 +$40）', fx: 'economy', v: 2 },
  { id: 'speed',          zh: '速度标签',     desc: '下一盲注出牌次数 +$(5)', fx: 'economy', v: 5 },
  { id: 'ethereal',       zh: '幻灵标签',     desc: '免费开启一个幻灵包', fx: 'mega_pack', packId: 'spectral' },
];
export const TAG_MAP = Object.fromEntries(TAGS.map(t => [t.id, t]));
