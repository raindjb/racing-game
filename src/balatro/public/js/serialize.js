// serialize.js — 存档序列化/反序列化（G ↔ 纯 JSON）
// 字段变更需同步 SAVE_VERSION 并加 migrate。
import { SAVE_VERSION } from './version.js';
import { G, PHASES, setPhase, initRun } from './state.js';
import { createRng } from './rng.js';
import { BOSS_MAP } from './data/bosses.js';
import { setNextCardId, peekNextCardId } from './data/card-data.js';
import { setNextJokerUid, peekNextJokerUid } from './joker-manager.js';
import { setNextConsumableUid, peekNextConsumableUid } from './consumable-manager.js';

/** G → 可 JSON 化对象 */
export function serializeRun() {
  // 结算/卡包中不落档：把打出区并回弃牌堆、丢弃卡包，回退到安全阶段
  const phase = [PHASES.SCORING, PHASES.BOOSTER].includes(G.phase)
    ? (G.phase === PHASES.BOOSTER ? PHASES.SHOP : PHASES.PLAYING)
    : G.phase;

  return {
    version: SAVE_VERSION,
    seed: G.seed,
    rngState: G.rng.getState(),
    nextIds: { card: peekNextCardId(), joker: peekNextJokerUid(), consumable: peekNextConsumableUid() },
    phase,
    deck: G.deck, hand: G.hand, discardPile: G.discardPile,
    playedZone: [], removedCards: G.removedCards,
    selected: [],
    jokers: G.jokers, consumables: G.consumables,
    money: G.money, ante: G.ante, blindIndex: G.blindIndex, round: G.round,
    handsLeft: G.handsLeft, discardsLeft: G.discardsLeft,
    roundScore: G.roundScore, target: G.target,
    handLevels: G.handLevels, handPlayed: G.handPlayed,
    roundPlayedTypes: G.roundPlayedTypes,
    bossId: G.boss?.id ?? null, bossState: G.bossState,
    upcomingBossId: G.upcomingBoss?.id ?? null, upcomingBossAnte: G.upcomingBossAnte,
    recentBosses: G.recentBosses ?? [],
    shop: G.shop, shopReroll: G.shopReroll,
    vouchers: G.vouchers, lastConsumableUsed: G.lastConsumableUsed,
    config: G.config, stats: G.stats,
  };
}

/** JSON → G（返回 false 表示版本不兼容/数据损坏） */
export function deserializeRun(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.version !== SAVE_VERSION) return false;   // M2+: migrate_vN_to_vN+1
  if (!data.seed || !Array.isArray(data.deck)) return false;

  initRun({ seed: data.seed });                       // 重置骨架
  G.rng = createRng(data.seed);
  G.rng.setState(data.rngState >>> 0);
  setNextCardId(data.nextIds?.card ?? 1);
  setNextJokerUid(data.nextIds?.joker ?? 1);
  setNextConsumableUid(data.nextIds?.consumable ?? 1000);

  G.deck = data.deck; G.hand = data.hand; G.discardPile = data.discardPile;
  G.playedZone = []; G.removedCards = data.removedCards ?? [];
  G.selected = [];
  G.jokers = data.jokers ?? []; G.consumables = data.consumables ?? [];
  G.money = data.money; G.ante = data.ante; G.blindIndex = data.blindIndex; G.round = data.round;
  G.handsLeft = data.handsLeft; G.discardsLeft = data.discardsLeft;
  G.roundScore = data.roundScore; G.target = data.target;
  G.handLevels = data.handLevels; G.handPlayed = data.handPlayed;
  G.roundPlayedTypes = data.roundPlayedTypes ?? [];
  G.boss = data.bossId ? BOSS_MAP[data.bossId] : null;
  G.bossState = data.bossState ?? {};
  G.upcomingBoss = data.upcomingBossId ? BOSS_MAP[data.upcomingBossId] : null;
  G.upcomingBossAnte = data.upcomingBossAnte ?? 0;
  G.recentBosses = data.recentBosses ?? [];
  G.shop = data.shop; G.shopReroll = data.shopReroll ?? 0;
  G.vouchers = data.vouchers ?? [];
  G.lastConsumableUsed = data.lastConsumableUsed ?? null;
  G.config = { ...G.config, ...data.config };
  G.stats = data.stats ?? G.stats;

  setPhase(data.phase);
  return true;
}
