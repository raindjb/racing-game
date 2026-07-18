// upgrades.js — 永久升级系统：筹码币 + 升级面板 + 赌注解锁
// localStorage 持久化：balatro_chips（筹码余额）、balatro_upgrades（已购升级列表）

const LS_CHIPS = 'balatro_chips';
const LS_UPGRADES = 'balatro_upgrades';

// 升级定义：id / 中文名 / 描述 / 最大等级 / 每级价格(递增) / config 补丁
export const UPGRADES = [
  { id: 'extra_cash',      zh: '额外资金',   desc: '起始金币 +$2',         max: 5,  baseCost: 100,  costStep: 50,  patch: (lv, cfg) => { cfg.startMoney += lv * 2; } },
  { id: 'extra_hand',      zh: '额外出牌',   desc: '每回合出牌 +1',        max: 3,  baseCost: 200,  costStep: 100, patch: (lv, cfg) => { cfg.hands += lv; } },
  { id: 'extra_discard',   zh: '额外弃牌',   desc: '每回合弃牌 +1',        max: 3,  baseCost: 150,  costStep: 75,  patch: (lv, cfg) => { cfg.discards += lv; } },
  { id: 'extra_jokerslot', zh: '额外小丑槽', desc: '小丑槽位 +1',          max: 4,  baseCost: 400,  costStep: 200, patch: (lv, cfg) => { cfg.jokerSlots += lv; } },
  { id: 'extra_consumable',zh: '额外消耗槽', desc: '消耗牌槽位 +1',        max: 2,  baseCost: 300,  costStep: 150, patch: (lv, cfg) => { cfg.consumableSlots += lv; } },
  { id: 'extra_handsize',  zh: '额外手牌',   desc: '手牌上限 +1',          max: 4,  baseCost: 250,  costStep: 125, patch: (lv, cfg) => { cfg.handSize += lv; } },
  { id: 'golden_run',      zh: '黄金开局',   desc: '起始金币 +$10',        max: 1,  baseCost: 600,  costStep: 0,   patch: (lv, cfg) => { if (lv > 0) cfg.startMoney += 10 - (cfg.startMoney - 6); } },
  { id: 'gilded_deck',     zh: '镀金牌组',   desc: '牌组中 2 张牌变为黄金牌', max: 3, baseCost: 350, costStep: 175, patch: (lv, cfg) => { cfg.gildedCards = lv; } },
  { id: 'lucky_draw',      zh: '幸运抽牌',   desc: '手牌中 1 张变为幸运牌',  max: 3, baseCost: 300, costStep: 150, patch: (lv, cfg) => { cfg.luckyStarting = lv; } },
];

// 赌注解锁条件（不消耗筹码，达标自动解锁）
export const STAKES = [
  { id: 'white',  zh: '白注',  desc: '标准难度',      unlock: 0,  blindScale: 1,    hands: 4, startMoney: 4 },
  { id: 'red',    zh: '红注',  desc: '无弃牌奖励',    unlock: 1,  blindScale: 1,    hands: 4, startMoney: 4, noDiscardBonus: true },
  { id: 'green',  zh: '绿注',  desc: '利息减半',      unlock: 3,  blindScale: 1,    hands: 4, startMoney: 4, interestPer: 10, interestCap: 3 },
  { id: 'black',  zh: '黑注',  desc: '商店卡位 +1',   unlock: 5,  blindScale: 1,    hands: 4, startMoney: 4, shopSlots: 3 },
  { id: 'blue',   zh: '蓝注',  desc: '每回合出牌 -1', unlock: 7,  blindScale: 1,    hands: 3, startMoney: 4 },
  { id: 'purple', zh: '紫注',  desc: '起始金币少',    unlock: 10, blindScale: 1,    hands: 4, startMoney: 2 },
  { id: 'orange', zh: '橙注',  desc: '盲注 +20%',     unlock: 15, blindScale: 1.2,  hands: 4, startMoney: 4 },
  { id: 'gold',   zh: '金注',  desc: 'Joker 价格 +$2',unlock: 20, blindScale: 1.2,  hands: 4, startMoney: 4, jokerPriceExtra: 2 },
];

// ===== 持久化读写 =====
export function getChips() {
  try { return Number(localStorage.getItem(LS_CHIPS)) || 0; } catch (e) { return 0; }
}
function setChips(v) { localStorage.setItem(LS_CHIPS, Math.max(0, Math.floor(v))); }

export function getUpgrades() {
  try { return JSON.parse(localStorage.getItem(LS_UPGRADES)) || {}; } catch (e) { return {}; }
}
function setUpgrades(up) { localStorage.setItem(LS_UPGRADES, JSON.stringify(up)); }

// ===== 每局奖励结算 =====
export function awardChips(won, ante, bestScore) {
  let chips = 0;
  if (won) {
    chips += 50 + ante * 40;                      // 通关：底分 + 每 ante 加成
    chips += Math.floor(bestScore / 500);          // 高分加成
  } else {
    chips += Math.floor(ante * 8);                 // 败局：按进度少量奖励
    chips += Math.floor(bestScore / 2000);
  }
  chips = Math.max(5, Math.min(800, chips));       // 上下限
  const total = getChips() + chips;
  setChips(total);
  return { earned: chips, total };
}

// ===== 升级购买 =====
export function buyUpgrade(id) {
  const def = UPGRADES.find(u => u.id === id);
  if (!def) return { ok: false, msg: '未知升级' };
  const ups = getUpgrades();
  const lv = ups[id] || 0;
  if (lv >= def.max) return { ok: false, msg: '已达最高等级' };
  const cost = def.baseCost + lv * def.costStep;
  const chips = getChips();
  if (chips < cost) return { ok: false, msg: `筹码不足 (需 ${cost}，现有 ${chips})` };
  setChips(chips - cost);
  ups[id] = lv + 1;
  setUpgrades(ups);
  return { ok: true, msg: `升级成功！${def.zh} Lv${lv + 1}`, cost, remaining: getChips() };
}

// ===== 应用已购升级到 config =====
export function applyUpgrades(config) {
  const ups = getUpgrades();
  for (const def of UPGRADES) {
    const lv = ups[def.id] || 0;
    if (lv > 0 && def.patch) def.patch(lv, config);
  }
}

// ===== 赌注解锁检查 =====
export function unlockedStakes(games) {
  return STAKES.filter(s => games >= s.unlock).map(s => s.id);
}

// ===== 应用赌注到 config =====
export function applyStake(stakeId, config) {
  const s = STAKES.find(s => s.id === stakeId);
  if (!s) return;
  if (s.blindScale) config.blindScale = s.blindScale;
  if (s.hands) config.hands = s.hands;
  if (s.startMoney) config.startMoney = s.startMoney;
  if (s.shopSlots) config.shopSlots = s.shopSlots;
  if (s.interestPer) { config.interestPer = s.interestPer; config.interestCap = s.interestCap ?? config.interestCap; }
  if (s.noDiscardBonus) config.noDiscardBonus = true;
  if (s.jokerPriceExtra) config.jokerPriceExtra = s.jokerPriceExtra;
}
