// data/planets.js — 12 张星球牌（3 张秘密手型牌需该手型本局打出过才会出现）
export const PLANETS = [
  { id: 'pluto',    zh: '冥王星', hand: 'high_card' },
  { id: 'mercury',  zh: '水星',   hand: 'pair' },
  { id: 'uranus',   zh: '天王星', hand: 'two_pair' },
  { id: 'venus',    zh: '金星',   hand: 'three_of_a_kind' },
  { id: 'saturn',   zh: '土星',   hand: 'straight' },
  { id: 'jupiter',  zh: '木星',   hand: 'flush' },
  { id: 'earth',    zh: '地球',   hand: 'full_house' },
  { id: 'mars',     zh: '火星',   hand: 'four_of_a_kind' },
  { id: 'neptune',  zh: '海王星', hand: 'straight_flush' },
  { id: 'planet_x', zh: 'X 行星', hand: 'five_of_a_kind', secret: true },
  { id: 'ceres',    zh: '谷神星', hand: 'flush_house', secret: true },
  { id: 'eris',     zh: '阋神星', hand: 'flush_five', secret: true },
];
export const PLANET_MAP = Object.fromEntries(PLANETS.map(p => [p.id, p]));
