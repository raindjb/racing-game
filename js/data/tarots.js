// data/tarots.js — 全 22 张塔罗牌（原作效果）
// targets: 需要选中的手牌数 {min,max}；0 = 无目标直接使用
export const TAROTS = [
  { id: 'fool',       zh: '愚者',     desc: '复制本局上一张使用的塔罗/星球牌（愚者除外）', targets: 0 },
  { id: 'magician',   zh: '魔术师',   desc: '最多 2 张选中牌 → 幸运牌', targets: { min: 1, max: 2 }, enhance: 'lucky' },
  { id: 'priestess',  zh: '女祭司',   desc: '生成最多 2 张随机星球牌', targets: 0 },
  { id: 'empress',    zh: '女皇',     desc: '最多 2 张选中牌 → 多倍牌', targets: { min: 1, max: 2 }, enhance: 'mult' },
  { id: 'emperor',    zh: '皇帝',     desc: '生成最多 2 张随机塔罗牌', targets: 0 },
  { id: 'hierophant', zh: '教皇',     desc: '最多 2 张选中牌 → 奖励牌', targets: { min: 1, max: 2 }, enhance: 'bonus' },
  { id: 'lovers',     zh: '恋人',     desc: '1 张选中牌 → 万能牌', targets: { min: 1, max: 1 }, enhance: 'wild' },
  { id: 'chariot',    zh: '战车',     desc: '1 张选中牌 → 钢铁牌', targets: { min: 1, max: 1 }, enhance: 'steel' },
  { id: 'justice',    zh: '正义',     desc: '1 张选中牌 → 玻璃牌', targets: { min: 1, max: 1 }, enhance: 'glass' },
  { id: 'hermit',     zh: '隐者',     desc: '金钱翻倍（最多 +$20）', targets: 0 },
  { id: 'wheel_of_fortune', zh: '命运之轮', desc: '1/4 概率为随机小丑牌添加版本', targets: 0 },
  { id: 'strength',   zh: '力量',     desc: '最多 2 张选中牌点数 +1', targets: { min: 1, max: 2 } },
  { id: 'hanged_man', zh: '倒吊人',   desc: '销毁最多 2 张选中牌', targets: { min: 1, max: 2 } },
  { id: 'death',      zh: '死神',     desc: '选中 2 张：左边变为右边的复制', targets: { min: 2, max: 2 } },
  { id: 'temperance', zh: '节制',     desc: '获得全部小丑牌出售价值（最多 $50）', targets: 0 },
  { id: 'devil',      zh: '恶魔',     desc: '1 张选中牌 → 黄金牌', targets: { min: 1, max: 1 }, enhance: 'gold' },
  { id: 'tower',      zh: '塔',       desc: '1 张选中牌 → 石头牌', targets: { min: 1, max: 1 }, enhance: 'stone' },
  { id: 'star',       zh: '星星',     desc: '最多 3 张选中牌 → ♦', targets: { min: 1, max: 3 }, suit: 'diamonds' },
  { id: 'moon',       zh: '月亮',     desc: '最多 3 张选中牌 → ♣', targets: { min: 1, max: 3 }, suit: 'clubs' },
  { id: 'sun',        zh: '太阳',     desc: '最多 3 张选中牌 → ♥', targets: { min: 1, max: 3 }, suit: 'hearts' },
  { id: 'judgement',  zh: '审判',     desc: '生成一张随机小丑牌', targets: 0 },
  { id: 'world',      zh: '世界',     desc: '最多 3 张选中牌 → ♠', targets: { min: 1, max: 3 }, suit: 'spades' },
];
export const TAROT_MAP = Object.fromEntries(TAROTS.map(t => [t.id, t]));
