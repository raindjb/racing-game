// tags.js — 跳盲注标签系统：获得/立即生效/商店消耗（纯逻辑）
import { G, bus, PHASES, setPhase } from './state.js';
import { TAG_MAP } from './data/tags.js';
import { TAGS } from './data/tags.js';
import { JOKERS } from './data/jokers.js';
import { HAND_TYPES } from './data/card-data.js';
import { makeJokerInstance, addJoker } from './joker-manager.js';
import { interestOf } from './data/blinds.js';
import { pickBoss } from './data/bosses.js';

/** 跳过盲注时获得随机标签（「加倍标签」使下一个标签×2） */
export function gainRandomTag() {
  gainTag(G.rng.pick(TAGS).id);
}

export function gainTag(id) {
  const def = TAG_MAP[id];
  if (!def) return;
  let times = 1;
  if (G.tagDouble && id !== 'double') { times = 2; G.tagDouble = false; }
  for (let t = 0; t < times; t++) applyTag(def);
  bus.emit('tag:gained', { id, zh: def.zh, times });
}

function applyTag(def) {
  switch (def.fx) {
    case 'double': G.tagDouble = true; break;
    case 'rare_joker': {
      const owned = new Set(G.jokers.map(j => j.id));
      const pool = JOKERS.filter(j => j.rarity === def.rarity && !owned.has(j.id));
      if (pool.length) addJoker(G, makeJokerInstance(G.rng.pick(pool).id));
      break;
    }
    case 'edition': (G.pendingJokerEditions ??= []).push(def.edition); break;
    case 'investment': G.investmentTags = (G.investmentTags ?? 0) + 1; break;
    case 'coupon': G.shopFlags = { ...(G.shopFlags ?? {}), coupon: true }; break;
    case 'voucher': G.shopFlags = { ...(G.shopFlags ?? {}), extraVoucher: true }; break;
    case 'boss': {
      G.upcomingBoss = pickBoss(G.rng, [G.upcomingBoss?.id, ...(G.recentBosses ?? [])].filter(Boolean), G.ante);
      break;
    }
    case 'shop_flag': G.shopFlags = { ...(G.shopFlags ?? {}), [def.config]: true }; break;
    case 'juggle_bonus': G.nextBlindBonus = { ...(G.nextBlindBonus ?? {}), handSize: 3 }; break;
    case 'orbital': {
      const h = G.rng.pick(HAND_TYPES);
      G.handLevels[h.id] = (G.handLevels[h.id] ?? 1) + 3;
      break;
    }
    case 'top_up': {
      const owned = new Set(G.jokers.map(j => j.id));
      for (let i = 0; i < 2; i++) {
        const pool = JOKERS.filter(j => j.rarity === 'common' && !owned.has(j.id));
        if (!pool.length) break;
        const inst = makeJokerInstance(G.rng.pick(pool).id);
        if (!addJoker(G, inst)) break;
        owned.add(inst.id);
      }
      break;
    }
    case 'handy': G.nextBlindBonus = { ...(G.nextBlindBonus ?? {}), hands: 1, discards: 1 }; break;
    case 'economy': {
      if (def.v === 2) G.money += Math.min(40, Math.max(0, G.money));    // 经济标签：翻倍
      else if (def.id === 'garbage') G.money += G.config.discards;        // 垃圾（近似）
      else G.money += def.v;                                              // 速度等固定
      break;
    }
    case 'mega_pack': (G.pendingMegaPacks ??= []).push(def.packId); break;
  }
}

/** 下一盲注开始时应用标签加成（round.startBlind 调用） */
export function applyNextBlindBonus() {
  if (!G.nextBlindBonus) return;
  G.handsLeft += G.nextBlindBonus.hands ?? 0;
  G.discardsLeft += G.nextBlindBonus.discards ?? 0;
  if (G.nextBlindBonus.handSize) {
    G.bossState.handSizeDelta = (G.bossState.handSizeDelta ?? 0) + G.nextBlindBonus.handSize;
  }
  G.nextBlindBonus = null;
}

/** Boss 击败时投资标签兑现 */
export function cashInvestmentTags() {
  if (!G.investmentTags) return 0;
  const v = 25 * G.investmentTags;
  G.money += v;
  G.investmentTags = 0;
  return v;
}
