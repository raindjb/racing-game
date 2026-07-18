// state.js — 全局游戏状态 G + 阶段机 + 轻量事件总线（纯逻辑，无 DOM）
import { SUITS, RANKS, HAND_TYPES, makeCard, resetCardIds } from './data/card-data.js';
import { createRng, randomSeedString } from './rng.js';

export const PHASES = {
  MENU: 'menu',
  BLIND_SELECT: 'blind_select',
  PLAYING: 'playing',
  SCORING: 'scoring',       // 结算动画期间锁输入
  ROUND_END: 'round_end',   // 现金结算面板
  SHOP: 'shop',
  BOOSTER: 'booster',       // 卡包开启
  GAME_OVER: 'game_over',
  WIN: 'win',
};

/** 轻量事件总线：引擎 emit，UI/音频 on。 */
function createBus() {
  const map = new Map();
  return {
    on(ev, fn) { (map.get(ev) ?? map.set(ev, []).get(ev)).push(fn); return () => this.off(ev, fn); },
    off(ev, fn) { const l = map.get(ev); if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
    emit(ev, payload) { (map.get(ev) ?? []).forEach(fn => fn(payload)); },
  };
}
export const bus = createBus();

/** 运行配置（默认值，可被优惠券/套牌修改） */
export function defaultConfig() {
  return {
    hands: 4,            // 每回合出牌数
    discards: 3,         // 每回合弃牌数
    handSize: 8,         // 手牌上限
    jokerSlots: 5,
    consumableSlots: 2,
    startMoney: 4,
    interestCap: 5,      // 利息上限 $5
    interestPer: 5,      // 每 $5 得 $1
    rerollBase: 5,       // 商店重掷起价
    blindScale: 1,       // 盲注分数倍率（<1 = 简单；1 = 标准）
    // 商店/优惠券相关
    shopSlots: 2,
    shopDiscount: 1,     // 清仓甩卖 → 0.75
    rerollDiscount: 0,   // 重掷盈余 → 2
    editionRateMult: 1,  // 磨砺 → 2
    telescope: false,    // 望远镜
  };
}

/** 难度预设 */
export const DIFFICULTIES = {
  beginner: {
    zh: '新手', desc: '盲注分 ×0.6 | +1 出牌 | +$2 起始',
    blindScale: 0.6, hands: 5, startMoney: 6,
  },
  easy: {
    zh: '简单', desc: '盲注分 ×0.8 | 标准手牌/金币',
    blindScale: 0.8, hands: 4, startMoney: 4,
  },
  normal: {
    zh: '标准', desc: '原版 White Stake 数值',
    blindScale: 1, hands: 4, startMoney: 4,
  },
}

/** 全局状态（单例）。字段变更需同步 serialize 测试与 SAVE_VERSION。 */
export const G = {
  phase: PHASES.MENU,
  seed: '',
  rng: null,             // createRng 实例（不序列化，存 rngState）

  // 牌
  deck: [],              // 抽牌堆（末尾为顶）
  hand: [],
  discardPile: [],
  playedZone: [],        // 正在结算展示的牌
  removedCards: [],      // 永久移除（玻璃碎裂等）
  selected: [],          // 选中的 card.id（有序，最多 5）

  // 持有物
  jokers: [],            // { ...jokerData 实例 }
  consumables: [],       // 塔罗/星球实例

  // 资源
  money: 4,
  ante: 1,
  blindIndex: 0,         // 0 小盲 / 1 大盲 / 2 Boss
  round: 0,              // 全局回合计数
  handsLeft: 4,
  discardsLeft: 3,
  roundScore: 0,
  target: 300,

  // 手型
  handLevels: {},        // handTypeId -> level（1 起）
  handPlayed: {},        // handTypeId -> 本局打出次数
  roundPlayedTypes: [],  // 本回合打出的手型（Boss「眼」用）

  boss: null,            // 当前 Boss 数据（仅 Boss 关）
  bossState: {},         // Boss 运行时状态（如「嘴」锁定的手型）

  shop: null,            // 当前商店库存（Task 08）
  vouchers: [],          // 已购优惠券 id

  stats: { bestHandScore: 0, totalHandsPlayed: 0, jokersBought: 0 },
  config: defaultConfig(),
};

/** 阶段切换（唯一入口，广播事件） */
export function setPhase(phase) {
  const prev = G.phase;
  G.phase = phase;
  bus.emit('phase', { prev, phase });
}

/** 开新局：重置 G 并生成整副牌 */
export function initRun({ seed, difficulty = 'normal' } = {}) {
  G.seed = seed || randomSeedString();
  G.rng = createRng(G.seed);
  resetCardIds();

  G.deck = [];
  for (const suit of SUITS) for (const rank of RANKS) G.deck.push(makeCard(suit, rank));
  G.rng.shuffle(G.deck);

  G.hand = []; G.discardPile = []; G.playedZone = []; G.removedCards = []; G.selected = [];
  G.jokers = []; G.consumables = [];
  G.config = defaultConfig();
  // 应用难度预设
  const diff = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
  Object.assign(G.config, diff);
  // 应用永久升级
  import('./upgrades.js').then(m => m.applyUpgrades(G.config));
  G.config.diffKey = difficulty;
  G.money = G.config.startMoney;
  G.ante = 1; G.blindIndex = 0; G.round = 0;
  G.handsLeft = G.config.hands; G.discardsLeft = G.config.discards;
  G.roundScore = 0; G.target = Math.floor(300 * (G.config.blindScale ?? 1));
  G.handLevels = Object.fromEntries(HAND_TYPES.map(h => [h.id, 1]));
  G.handPlayed = Object.fromEntries(HAND_TYPES.map(h => [h.id, 0]));
  G.roundPlayedTypes = [];
  G.boss = null; G.bossState = {};
  G.shop = null; G.vouchers = [];
  G.booster = null;
  G.shopReroll = 0;
  G.lastConsumableUsed = null;
  G.recentBosses = [];
  G.upcomingBoss = null; G.upcomingBossAnte = 0;
  // M2 字段（与 serialize.EXTRA_KEYS 对应）
  G.blindsSkipped = 0;
  G.tagDouble = false;
  G.pendingJokerEditions = [];
  G.investmentTags = 0;
  G.shopFlags = null; G.activeShopFlags = null;
  G.nextBlindBonus = null;
  G.pendingMegaPacks = [];
  G.pendingSpectral = 0;
  G.consumableUsedCount = 0; G.tarotUsedCount = 0; G.planetUsedCount = 0;
  G.planetsUsed = [];
  G.boosterReturnPhase = null;
  G.bossDisabled = false;
  G.stats = { bestHandScore: 0, totalHandsPlayed: 0, jokersBought: 0 };

  bus.emit('run:new', { seed: G.seed });
  return G;
}

/** 全部卡牌（用于塔罗随机强化等遍历场景） */
export function allOwnedCards() {
  return [...G.deck, ...G.hand, ...G.discardPile, ...G.playedZone];
}

export function selectedCards() {
  return G.selected.map(id => G.hand.find(c => c.id === id)).filter(Boolean);
}
