// round.js — 回合/盲注流程状态机（引擎核心协调层）
//
// 流程：BLIND_SELECT → startBlind → PLAYING ⇄ (playSelected → SCORING → resolve)
//        → 达标 winRound → ROUND_END(现金结算) → leaveRoundEnd → SHOP → leaveShop → BLIND_SELECT
//        → 出牌用尽未达标 → GAME_OVER；通关 Ante 8 Boss → WIN
import { G, PHASES, bus, setPhase, initRun, selectedCards } from './state.js';
import { drawToHandSize, discardFromHand, reclaimAll, destroyCards } from './deck.js';
import { evalHand } from './hand-eval.js';
import { buildContext, scoreHand } from './scoring.js';
import { getJokerHandlers } from './effects/index.js';
import { blindTarget, interestOf, BLINDS, ANTE_MAX } from './data/blinds.js';
import { pickBoss, BOSS_MAP } from './data/bosses.js';
import { cardOrder, SUITS } from './data/card-data.js';
import { applyBossOnBlindStart, applyBossOnCardDrawn, validatePlay, applyBossAfterPlay } from './boss-effects.js';
import { makeConsumable, addConsumable, randomTarotId } from './consumable-manager.js';
import { PLANETS } from './data/planets.js';
import { enterShopGen } from './shop.js';

/** 开新局 */
export function startRun({ seed } = {}) {
  initRun({ seed });
  G.recentBosses = [];
  gotoBlindSelect();
}

/** 进入盲注选择（预生成本 Ante 的 Boss，供封面展示） */
export function gotoBlindSelect() {
  if (!G.upcomingBoss || G.upcomingBossAnte !== G.ante) {
    G.upcomingBoss = pickBoss(G.rng, G.recentBosses ?? []);
    G.upcomingBossAnte = G.ante;
  }
  setPhase(PHASES.BLIND_SELECT);
}

/** 跳过当前盲注（仅小盲/大盲；标签奖励 M2） */
export function skipBlind() {
  if (G.phase !== PHASES.BLIND_SELECT || G.blindIndex >= 2) return false;
  G.blindIndex++;
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
  applyBossOnBlindStart();
  G.target = blindTarget(G.ante, G.blindIndex, G.boss);

  const drawn = drawToHandSize();
  for (const c of drawn) applyBossOnCardDrawn(c);

  for (const j of G.jokers) getJokerHandlers(j.id).onBlindStart?.(G, j);

  setPhase(PHASES.PLAYING);
  bus.emit('blind:start', { ante: G.ante, blindIndex: G.blindIndex, boss: G.boss, target: G.target });
}

/** 选牌/取消（最多 5 张） */
export function toggleSelect(cardId) {
  if (G.phase !== PHASES.PLAYING) return;
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

  const ev = evalHand(cards);
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

  // 记录
  G.handPlayed[ev.handType] = (G.handPlayed[ev.handType] ?? 0) + 1;
  G.roundPlayedTypes.push(ev.handType);
  G.stats.totalHandsPlayed++;
  if (result.score > G.stats.bestHandScore) G.stats.bestHandScore = result.score;

  // Joker 出牌后钩子（累积型计数等）
  for (const j of G.jokers) getJokerHandlers(j.id).onHandPlayed?.(G, ev, j);

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
  discardFromHand([]);                            // no-op：保持接口一致
  G.discardPile.push(...G.playedZone);            // 打出的牌进弃牌堆
  G.playedZone = [];

  applyBossAfterPlay(ev);                         // 钩子弃牌 / 嘴锁定

  if (G.roundScore >= G.target) return winRound();
  if (G.handsLeft <= 0) return gameOver(false);

  const drawn = drawToHandSize();
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
  for (const j of G.jokers) getJokerHandlers(j.id).onDiscard?.(G, cards, j);
  // 紫蜡封：被弃置时生成塔罗牌
  for (const c of cards) {
    if (c.seal === 'purple') addConsumable(makeConsumable('tarot', randomTarotId(G.rng)));
  }
  discardFromHand(cards);
  const drawn = drawToHandSize();
  for (const c of drawn) applyBossOnCardDrawn(c);
  bus.emit('hand:discarded', { cards });
  return true;
}

/** 过关：现金结算 */
export function winRound() {
  const reward = BLINDS[G.blindIndex].reward;
  const interest = interestOf(G.money, G.config);
  const handsBonus = G.handsLeft;                  // 每剩 1 次出牌 +$1
  let jokerMoney = 0;
  for (const j of G.jokers) jokerMoney += getJokerHandlers(j.id).onRoundEnd?.(G, j) ?? 0;
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
    G.ante++;
    G.blindIndex = 0;
    if (G.ante > ANTE_MAX) {
      setPhase(PHASES.WIN);
      bus.emit('run:won');
      return;
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
  setPhase(won ? PHASES.WIN : PHASES.GAME_OVER);
  bus.emit(won ? 'run:won' : 'run:lost', {
    ante: G.ante, round: G.round, bestHand: G.stats.bestHandScore,
  });
}
