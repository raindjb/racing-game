// round.js — 回合/盲注流程状态机（引擎核心协调层）
//
// 流程：BLIND_SELECT → startBlind → PLAYING ⇄ (playSelected → SCORING → resolve)
//        → 达标 winRound → ROUND_END(现金结算) → leaveRoundEnd → SHOP → leaveShop → BLIND_SELECT
//        → 出牌用尽未达标 → GAME_OVER；通关 Ante 8 Boss → WIN
import { G, PHASES, bus, setPhase, initRun, selectedCards } from './state.js';
import { drawToHandSize, discardFromHand, reclaimAll, destroyCards } from './deck.js';
import { evalHand } from './hand-eval.js';
import { buildContext, scoreHand } from './scoring.js';
import { dispatchHook } from './effects/index.js';
import { blindTarget, interestOf, BLINDS, ANTE_MAX } from './data/blinds.js';
import { pickBoss, BOSS_MAP } from './data/bosses.js';
import { cardOrder, SUITS } from './data/card-data.js';
import { applyBossOnBlindStart, applyBossOnCardDrawn, validatePlay, applyBossAfterPlay, bossFirstDrawDone } from './boss-effects.js';
import { makeConsumable, addConsumable, randomTarotId, randomSpectralId } from './consumable-manager.js';
import { PLANETS } from './data/planets.js';
import { enterShopGen, openFreePack } from './shop.js';
import { deserializeRun } from './serialize.js';
import { gainRandomTag, applyNextBlindBonus, cashInvestmentTags } from './tags.js';

/** 回主菜单 */
export function toMenu() { setPhase(PHASES.MENU); }

/** 从存档继续 */
export function continueRun(saveData) {
  if (!deserializeRun(saveData)) return false;
  bus.emit('run:continued');
  return true;
}

/** 开新局 */
export function startRun({ seed, difficulty } = {}) {
  initRun({ seed, difficulty });
  G.recentBosses = [];
  gotoBlindSelect();
}

/** 进入盲注选择（预生成本 Ante 的 Boss，供封面展示） */
export function gotoBlindSelect() {
  if (!G.upcomingBoss || G.upcomingBossAnte !== G.ante) {
    G.upcomingBoss = pickBoss(G.rng, G.recentBosses ?? [], G.ante);
    G.upcomingBossAnte = G.ante;
  }
  if (G.pendingMegaPacks?.length) {
    const packId = G.pendingMegaPacks.shift();
    openFreePack(packId, PHASES.BLIND_SELECT);
    return;
  }
  setPhase(PHASES.BLIND_SELECT);
}

/** 机制类 Joker → 手型判定选项（判定/预览共用） */
export function evalOptsFromJokers() {
  const has = id => G.jokers.some(j => j.id === id);
  const four = has('four_fingers');
  return {
    minStraightLen: four ? 4 : 5,
    minFlushLen: four ? 4 : 5,
    shortcut: has('shortcut'),
    smeared: has('smeared_joker'),
    splash: has('splash'),
  };
}

/** 跳过当前盲注（仅小盲/大盲；标签奖励在 M2-F 挂接） */
export function skipBlind() {
  if (G.phase !== PHASES.BLIND_SELECT || G.blindIndex >= 2) return false;
  G.blindsSkipped = (G.blindsSkipped ?? 0) + 1;
  G.blindIndex++;
  gainRandomTag();
  dispatchHook(G.jokers, 'onBlindSkipped', G);
  bus.emit('blind:skipped');
  gotoBlindSelect();
  return true;
}

/** 开始当前盲注 */
export function startBlind({ forceBossId } = {}) {
  reclaimAll();
  G.round++;
  G.roundScore = 0;
  G.selected = [];
  G.roundPlayedTypes = [];
  G.handsLeft = G.config.hands;
  G.discardsLeft = G.config.discards;

  if (G.blindIndex === 2) {
    G.boss = forceBossId ? BOSS_MAP[forceBossId] : G.upcomingBoss;
    (G.recentBosses ??= []).push(G.boss.id);
    if (G.recentBosses.length > 4) G.recentBosses.shift();
  } else {
    G.boss = null;
  }
  G.bossDisabled = false;              // 小丑「奇科」等可禁用 Boss
  G.bossState = {};                    // 清除上一盲注残留（镣铐 handSizeDelta 等）
  for (const j of G.jokers) j.disabled = false;   // 清除绯红之心禁用
  applyBossOnBlindStart();
  applyNextBlindBonus();               // 顺手/杂耍标签：+出牌/弃牌/手牌
  G.target = blindTarget(G.ante, G.blindIndex, G.boss, G.config);

  const drawn = drawToHandSize();
  for (const c of drawn) applyBossOnCardDrawn(c);
  bossFirstDrawDone();                 // 房子/柱子：首发标记

  dispatchHook(G.jokers, 'onBlindStart', G);

  setPhase(PHASES.PLAYING);
  bus.emit('blind:start', { ante: G.ante, blindIndex: G.blindIndex, boss: G.boss, target: G.target });
}

/** 选牌/取消（最多 5 张） */
export function toggleSelect(cardId) {
  if (G.phase !== PHASES.PLAYING) return;
  // Boss「蔚蓝之铃」：强制选中的牌不可取消
  if (G.bossState?.forcedCard === cardId && G.selected.includes(cardId) && !G.bossDisabled) {
    return bus.emit('ui:reject', { reason: '蔚蓝之铃：这张牌无法取消选择' });
  }
  const i = G.selected.indexOf(cardId);
  if (i >= 0) G.selected.splice(i, 1);
  else {
    if (G.selected.length >= 5) return bus.emit('ui:reject', { reason: '最多选择 5 张' });
    if (!G.hand.some(c => c.id === cardId)) return;
    G.selected.push(cardId);
  }
  bus.emit('select:change', { selected: [...G.selected] });
}

/** 理牌：按点数（大→小）或花色 */
export function sortHand(by = 'rank') {
  if (by === 'rank') {
    G.hand.sort((a, b) => cardOrder(b) - cardOrder(a));
  } else {
    G.hand.sort((a, b) =>
      SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || cardOrder(b) - cardOrder(a));
  }
  bus.emit('hand:sorted', { by });
}

/**
 * 出牌。instant=true（默认/测试）同步完成结算+落地；
 * UI 传 instant=false：结算后停在 SCORING，由动画完成后调 resolveAfterScoring()。
 */
export function playSelected({ instant = true } = {}) {
  if (G.phase !== PHASES.PLAYING || G.handsLeft <= 0) return null;
  const cards = selectedCards();
  if (cards.length === 0) return null;

  const ev = evalHand(cards, evalOptsFromJokers());
  const check = validatePlay(cards, ev);
  if (!check.ok) { bus.emit('ui:reject', { reason: check.reason }); return null; }

  // 移出手牌 → 打出区
  for (const c of cards) G.hand.splice(G.hand.indexOf(c), 1);
  G.playedZone = cards;
  G.selected = [];
  G.handsLeft--;

  // 结算
  setPhase(PHASES.SCORING);
  const ctx = buildContext(G, ev, cards);
  const result = scoreHand(ctx);
  G.roundScore += result.score;
  G.money += result.moneyDelta;

  // Joker 出牌后钩子（需在 handPlayed 计数之前——方尖碑/会员卡等读 pre-increment 值）
  dispatchHook(G.jokers, 'onHandPlayed', G, ev);

  // 记录
  G.handPlayed[ev.handType] = (G.handPlayed[ev.handType] ?? 0) + 1;
  G.roundPlayedTypes.push(ev.handType);
  G.stats.totalHandsPlayed++;
  if (result.score > G.stats.bestHandScore) G.stats.bestHandScore = result.score;

  G.lastPlay = { eval: ev, result };
  bus.emit('hand:played', { cards, eval: ev, result });

  if (instant) resolveAfterScoring();
  return result;
}

/** 结算动画完成后的落地：清理打出区 → Boss 后置效果 → 补牌 → 胜负判定 */
export function resolveAfterScoring() {
  if (G.phase !== PHASES.SCORING) return;
  const { eval: ev, result } = G.lastPlay;

  destroyCards(result.destroyed);                 // 玻璃碎裂永久移除
  // 第六感/降神会：本手积攒的幻灵牌
  while (G.pendingSpectral > 0) {
    G.pendingSpectral--;
    const ok = addConsumable(makeConsumable('spectral', randomSpectralId(G.rng)));
    if (!ok) { G.pendingSpectral++; break; }  // 槽位满：退还，不静默丢失
  }
  discardFromHand([]);                            // no-op：保持接口一致
  G.discardPile.push(...G.playedZone);            // 打出的牌进弃牌堆
  G.playedZone = [];

  applyBossAfterPlay(ev);                         // 钩子弃牌 / 嘴锁定

  if (G.roundScore >= G.target) return winRound();
  // Mr. Bones：得分≥目标 25% 时救回一命
  if (G.handsLeft <= 0) {
    if (G.roundScore >= G.target * 0.25 && G.jokers.some(j => j.id === 'mr_bones')) {
      const i = G.jokers.findIndex(j => j.id === 'mr_bones');
      G.jokers.splice(i, 1);
      bus.emit('jokers:change');
      bus.emit('ui:reject', { reason: '「骨头先生」救了你一命!' });
      return winRound({ noReward: true });
    }
    return gameOver(false);
  }

  // Boss「蛇」：出牌后固定抽 3 张
  const serpent = G.boss?.fx === 'serpent' && !G.bossDisabled;
  const drawn = drawToHandSize(serpent ? 3 : Infinity);
  for (const c of drawn) applyBossOnCardDrawn(c);
  setPhase(PHASES.PLAYING);
  bus.emit('hand:resolved');
}

/** 弃牌 */
export function discardSelected() {
  if (G.phase !== PHASES.PLAYING || G.discardsLeft <= 0) return false;
  const cards = selectedCards();
  if (cards.length === 0) return false;

  G.discardsLeft--;
  G.selected = [];
  dispatchHook(G.jokers, 'onDiscard', G, cards);
  // 紫蜡封：被弃置时生成塔罗牌
  for (const c of cards) {
    if (c.seal === 'purple') addConsumable(makeConsumable('tarot', randomTarotId(G.rng)));
  }
  discardFromHand(cards);
  // Boss「蛇」：弃牌后固定抽 3 张
  const serpentD = G.boss?.fx === 'serpent' && !G.bossDisabled;
  const drawn = drawToHandSize(serpentD ? 3 : Infinity);
  for (const c of drawn) applyBossOnCardDrawn(c);
  bus.emit('hand:discarded', { cards });
  return true;
}

/** 过关：现金结算；opts.noReward = Mr. Bones 救回（0 奖励推进） */
export function winRound(opts = {}) {
  const reward = opts.noReward ? 0 : BLINDS[G.blindIndex].reward;
  const interest = interestOf(G.money, G.config);
  const handsBonus = G.handsLeft;                  // 每剩 1 次出牌 +$1
  const jokerMoney = dispatchHook(G.jokers, 'onRoundEnd', G);
  const goldCards = G.hand.filter(c => c.enhancement === 'gold' && !c.debuffed).length * 3;

  // 蓝蜡封：回合结束留在手中 → 生成最后所打手型的星球牌
  const blueSeals = G.hand.filter(c => c.seal === 'blue');
  if (blueSeals.length && G.lastPlay) {
    const planet = PLANETS.find(p => p.hand === G.lastPlay.eval.handType);
    if (planet) for (const _ of blueSeals) addConsumable(makeConsumable('planet', planet.id));
    bus.emit('seal:blue', { cards: blueSeals });
  }

  const total = reward + interest + handsBonus + jokerMoney + goldCards;
  G.money += total;
  G.lastCashout = { reward, interest, handsBonus, jokerMoney, goldCards, total };

  // 推进进度
  if (G.blindIndex === 2) {
    dispatchHook(G.jokers, 'onBossDefeated', G);
    cashInvestmentTags();              // 投资标签：+$25/个
    G.ante++;
    G.blindIndex = 0;
    if (G.ante > ANTE_MAX) {
      // Ante 8 首次通关：触发胜利画面（可选继续无尽）
      if (G.ante === ANTE_MAX + 1 && !G._endless) {
        G._endless = true;
        return gameOver(true);
      }
      // 已在无尽模式：继续推进，分数指数增长
      G._endless = true;
    }
  } else {
    G.blindIndex++;
  }

  setPhase(PHASES.ROUND_END);
  bus.emit('round:won', { cashout: G.lastCashout });
}

/** 离开现金结算 → 商店 */
export function leaveRoundEnd() {
  if (G.phase !== PHASES.ROUND_END) return;
  enterShopGen();                                  // 生成货架
  setPhase(PHASES.SHOP);
  bus.emit('shop:enter');
}

/** 离开商店 → 盲注选择 */
export function leaveShop() {
  if (G.phase !== PHASES.SHOP) return;
  gotoBlindSelect();
}

export function gameOver(won) {
  if (won) {
    // Ante 8+ 通关：显示胜利并记录成就，但允许继续无尽模式
    setPhase(PHASES.WIN);
    bus.emit('run:won', { ante: G.ante, round: G.round, bestHand: G.stats.bestHandScore, endless: G._endless });
  } else {
    setPhase(PHASES.GAME_OVER);
    bus.emit('run:lost', { ante: G.ante, round: G.round, bestHand: G.stats.bestHandScore });
  }
}

/** 在胜利画面选择继续无尽模式 */
export function continueEndless() {
  setPhase(PHASES.ROUND_END);
  bus.emit('round:won', { cashout: G.lastCashout ?? 0 });
}
