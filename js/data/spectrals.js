// data/spectrals.js — 全 18 张幻灵牌
// targets: 需选中的手牌数；weight: 随机池权重（灵魂/黑洞稀有）
export const SPECTRALS = [
  { id: 'familiar',    zh: '亲随',   desc: '销毁 1 张随机手牌，向手中加入 3 张带强化的随机人头牌', targets: 0, weight: 1 },
  { id: 'grim',        zh: '冷酷',   desc: '销毁 1 张随机手牌，向手中加入 2 张带强化的 A', targets: 0, weight: 1 },
  { id: 'incantation', zh: '咒语',   desc: '销毁 1 张随机手牌，向手中加入 4 张带强化的数字牌', targets: 0, weight: 1 },
  { id: 'talisman',    zh: '护身符', desc: '为 1 张选中牌附上金蜡封', targets: { min: 1, max: 1 }, seal: 'gold', weight: 1 },
  { id: 'deja_vu',     zh: '既视感', desc: '为 1 张选中牌附上红蜡封', targets: { min: 1, max: 1 }, seal: 'red', weight: 1 },
  { id: 'trance',      zh: '恍惚',   desc: '为 1 张选中牌附上蓝蜡封', targets: { min: 1, max: 1 }, seal: 'blue', weight: 1 },
  { id: 'medium',      zh: '通灵',   desc: '为 1 张选中牌附上紫蜡封', targets: { min: 1, max: 1 }, seal: 'purple', weight: 1 },
  { id: 'aura',        zh: '光环',   desc: '为 1 张选中牌附上随机版本（闪箔/镭射/多彩）', targets: { min: 1, max: 1 }, weight: 1 },
  { id: 'wraith',      zh: '怨灵',   desc: '生成一张稀有小丑牌，金钱归零', targets: 0, weight: 1 },
  { id: 'sigil',       zh: '印记',   desc: '手中所有牌转换为同一随机花色', targets: 0, weight: 1 },
  { id: 'ouija',       zh: '通灵板', desc: '手中所有牌转换为同一随机点数，手牌上限 -1', targets: 0, weight: 1 },
  { id: 'ectoplasm',   zh: '灵质',   desc: '随机小丑牌获得负片版本，手牌上限 -1', targets: 0, weight: 1 },
  { id: 'immolate',    zh: '献祭',   desc: '销毁 5 张随机手牌，+$20', targets: 0, weight: 1 },
  { id: 'ankh',        zh: '安卡',   desc: '复制一张随机小丑牌，销毁其余小丑牌', targets: 0, weight: 1 },
  { id: 'hex',         zh: '妖术',   desc: '随机小丑牌获得多彩版本，销毁其余小丑牌', targets: 0, weight: 1 },
  { id: 'cryptid',     zh: '秘影',   desc: '复制 1 张选中牌 2 次加入手牌', targets: { min: 1, max: 1 }, weight: 1 },
  { id: 'soul',        zh: '灵魂',   desc: '生成一张传奇小丑牌', targets: 0, weight: 0.06 },
  { id: 'black_hole',  zh: '黑洞',   desc: '所有手型升 1 级', targets: 0, weight: 0.06 },
];
export const SPECTRAL_MAP = Object.fromEntries(SPECTRALS.map(s => [s.id, s]));
