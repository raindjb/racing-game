// consumable-manager.js — 消耗牌（塔罗/星球/幻灵）：创建/使用/出售 + 效果实现
import { G, bus, selectedCards } from './state.js';
import { TAROT_MAP, TAROTS } from './data/tarots.js';
import { PLANET_MAP, PLANETS } from './data/planets.js';
import { SPECTRAL_MAP, SPECTRALS } from './data/spectrals.js';
import { JOKERS } from './data/jokers.js';
import { RANKS, SUITS, makeCard, HAND_TYPES } from './data/card-data.js';
import { destroyCards } from './deck.js';
import { makeJokerInstance, addJoker, sellValue } from './joker-manager.js';
import { dispatchHook, getJokerHandlers, resolveHandlers } from './effects/index.js';

let nextUid = 1000;
export function setNextConsumableUid(n) { nextUid = Math.max(1000, n); }
export function peekNextConsumableUid() { return nextUid; }

export function makeConsumable(kind, defId) {
  const def = kind === 'tarot' ? TAROT_MAP[defId]
    : kind === 'planet' ? PLANET_MAP[defId]
    : SPECTRAL_MAP[defId];
  if (!def) throw new Error(`未知消耗牌: ${kind}/${defId}`);
  return { uid: nextUid++, kind, id: def.id, zh: def.zh,
           desc: kind === 'planet' ? `升级「${handZh(def.hand)}」等级` : def.desc };
}

function handZh(handId) {
  // 延迟 import 避免环：直接查 HAND_TYPE_MAP 会引 card-data，安全
  return { high_card: '高牌', pair: '对子', two_pair: '两对', three_of_a_kind: '三条',
    straight: '顺子', flush: '同花', full_house: '葫芦', four_of_a_kind: '四条',
    straight_flush: '同花顺', five_of_a_kind: '五条', flush_house: '同花葫芦', flush_five: '同花五条' }[handId] ?? handId;
}

export function consumableSlotsOf(G_) { return G_.config.consumableSlots; }

export function addConsumable(inst) {
  if (G.consumables.length >= consumableSlotsOf(G)) return false;
  G.consumables.push(inst);
  bus.emit('consumables:change');
  return true;
}

export function sellConsumable(uid) {
  const i = G.consumables.findIndex(c => c.uid === uid);
  if (i < 0) return false;
  const inst = G.consumables[i];
  G.consumables.splice(i, 1);
  G.money += 1;
  bus.emit('consumables:change');
  // 供 campfire 等监听
  dispatchHook(G.jokers, 'onConsumableSold', G, inst);
  return true;
}

/** 随机星球（秘密手型需本局打出过） */
export function randomPlanetId(rng) {
  const pool = PLANETS.filter(p => !p.secret || (G.handPlayed[p.hand] ?? 0) > 0);
  return rng.pick(pool).id;
}
export function randomTarotId(rng) { return rng.pick(TAROTS).id; }

/** 随机幻灵（灵魂/黑洞低权重） */
export function randomSpectralId(rng) {
  const total = SPECTRALS.reduce((s, x) => s + x.weight, 0);
  let r = rng.random() * total;
  for (const s of SPECTRALS) { r -= s.weight; if (r <= 0) return s.id; }
  return SPECTRALS[0].id;
}

/** 使用消耗牌。targets 默认取当前选中的手牌。返回 {ok, msg} */
export function useConsumable(uid) {
  const idx = G.consumables.findIndex(c => c.uid === uid);
  if (idx < 0) return { ok: false, msg: '不存在' };
  const inst = G.consumables[idx];

  // 先移出槽位（生成类效果需要用它腾出的位置），失败再放回
  G.consumables.splice(idx, 1);

  let res;
  if (inst.kind === 'planet') {
    const def = PLANET_MAP[inst.id];
    G.handLevels[def.hand] = (G.handLevels[def.hand] ?? 1) + 1;
    res = { ok: true, msg: `${def.zh}：${handZh(def.hand)} → Lv.${G.handLevels[def.hand]}` };
  } else if (inst.kind === 'spectral') {
    res = useSpectral(inst.id);
  } else {
    res = useTarot(inst.id);
  }

  if (res.ok) {
    if (inst.id !== 'fool') G.lastConsumableUsed = { kind: inst.kind, id: inst.id };
    G.consumableUsedCount = (G.consumableUsedCount ?? 0) + 1;
    G.tarotUsedCount = (G.tarotUsedCount ?? 0) + (inst.kind === 'tarot' ? 1 : 0);
    G.planetUsedCount = (G.planetUsedCount ?? 0) + (inst.kind === 'planet' ? 1 : 0);
    if (inst.kind === 'planet') {
      G.planetsUsed = G.planetsUsed ?? [];
      if (!G.planetsUsed.includes(inst.id)) G.planetsUsed.push(inst.id);
    }
    dispatchHook(G.jokers, 'onConsumableUsed', G, inst);
    bus.emit('consumables:change');
    bus.emit('consumable:used', { inst, msg: res.msg });
  } else {
    G.consumables.splice(Math.min(idx, G.consumables.length), 0, inst);
  }
  return res;
}

/** 塔罗效果实现 */
function useTarot(id) {
  const def = TAROT_MAP[id];
  const targets = selectedCards();
  const rng = G.rng;

  // 目标数校验
  if (def.targets) {
    if (targets.length < def.targets.min || targets.length > def.targets.max) {
      return { ok: false, msg: `${def.zh}：需选中 ${def.targets.min === def.targets.max ? def.targets.min : `${def.targets.min}-${def.targets.max}`} 张手牌` };
    }
  }

  // 强化类（魔术师/女皇/教皇/恋人/战车/正义/恶魔/塔）
  if (def.enhance) {
    for (const c of targets) c.enhancement = def.enhance;
    G.selected = [];
    bus.emit('cards:changed', { cards: targets });
    return { ok: true, msg: `${def.zh}：${targets.length} 张牌已强化` };
  }
  // 花色转换（星星/月亮/太阳/世界）
  if (def.suit) {
    for (const c of targets) c.suit = def.suit;
    G.selected = [];
    bus.emit('cards:changed', { cards: targets });
    return { ok: true, msg: `${def.zh}：${targets.length} 张牌已转换花色` };
  }

  switch (id) {
    case 'hermit': {
      const gain = Math.min(20, Math.max(0, G.money));
      G.money += gain;
      return { ok: true, msg: `隐者：+$${gain}` };
    }
    case 'temperance': {
      const gain = Math.min(50, G.jokers.reduce((s, j) => s + sellValue(j), 0));
      G.money += gain;
      return { ok: true, msg: `节制：+$${gain}` };
    }
    case 'strength': {
      for (const c of targets) {
        if (c.enhancement === 'stone') continue;
        const i = RANKS.indexOf(c.rank);
        c.rank = RANKS[(i + 1) % RANKS.length]; // K→A, A→2
      }
      G.selected = [];
      bus.emit('cards:changed', { cards: targets });
      return { ok: true, msg: `力量：${targets.length} 张牌点数 +1` };
    }
    case 'hanged_man':
      destroyCards(targets);
      G.selected = [];
      return { ok: true, msg: `倒吊人：销毁 ${targets.length} 张牌` };
    case 'death': {
      const [left, right] = targets;
      left.suit = right.suit; left.rank = right.rank;
      left.enhancement = right.enhancement; left.edition = right.edition; left.seal = right.seal;
      G.selected = [];
      bus.emit('cards:changed', { cards: [left] });
      return { ok: true, msg: '死神：复制完成' };
    }
    case 'priestess': {
      let n = 0;
      for (let i = 0; i < 2; i++) if (addConsumable(makeConsumable('planet', randomPlanetId(rng)))) n++;
      return n ? { ok: true, msg: `女祭司：生成 ${n} 张星球牌` } : { ok: false, msg: '消耗牌槽已满' };
    }
    case 'emperor': {
      let n = 0;
      for (let i = 0; i < 2; i++) if (addConsumable(makeConsumable('tarot', randomTarotId(rng)))) n++;
      return n ? { ok: true, msg: `皇帝：生成 ${n} 张塔罗牌` } : { ok: false, msg: '消耗牌槽已满' };
    }
    case 'judgement': {
      const owned = new Set(G.jokers.map(j => j.id));
      const pool = JOKERS.filter(j => !owned.has(j.id));
      if (!pool.length) return { ok: false, msg: '没有可生成的小丑牌' };
      const inst = makeJokerInstance(rng.pick(pool).id);
      return addJoker(G, inst)
        ? { ok: true, msg: `审判：获得「${inst.zh}」` }
        : { ok: false, msg: '小丑牌槽已满' };
    }
    case 'wheel_of_fortune': {
      const cands = G.jokers.filter(j => !j.edition);
      if (!cands.length) return { ok: false, msg: '没有可强化的小丑牌' };
      if (!rng.chance(0.25)) return { ok: true, msg: '命运之轮：什么都没发生…' };
      const j = rng.pick(cands);
      const roll = rng.random();
      j.edition = roll < 0.5 ? 'foil' : roll < 0.85 ? 'holographic' : 'polychrome';
      bus.emit('jokers:change');
      return { ok: true, msg: `命运之轮：「${j.zh}」获得版本!` };
    }
    case 'fool': {
      const last = G.lastConsumableUsed;
      if (!last) return { ok: false, msg: '愚者：本局还未使用过塔罗/星球' };
      return addConsumable(makeConsumable(last.kind, last.id))
        ? { ok: true, msg: '愚者：复制成功' }
        : { ok: false, msg: '消耗牌槽已满' };
    }
  }
  return { ok: false, msg: '未实现' };
}

/** 幻灵牌效果实现 */
function useSpectral(id) {
  const def = SPECTRAL_MAP[id];
  const rng = G.rng;
  const targets = selectedCards();

  if (def.targets) {
    if (targets.length < def.targets.min || targets.length > def.targets.max)
      return { ok: false, msg: `需选中 ${def.targets.min === def.targets.max ? def.targets.min : `${def.targets.min}-${def.targets.max}`} 张手牌` };
  }

  // 蜡封类
  if (def.seal) {
    targets[0].seal = def.seal;
    G.selected = [];
    return { ok: true, msg: `${def.zh}：已附上蜡封` };
  }

  switch (id) {
    case 'familiar':
    case 'grim':
    case 'incantation': {
      // 销毁随机手牌 → 生成指定强化牌
      if (!G.hand.length) return { ok: false, msg: '手中无牌' };
      const victim = rng.pick(G.hand);
      destroyCards([victim]);
      const count = id === 'familiar' ? 3 : id === 'grim' ? 2 : 4;
      const ranks = id === 'familiar' ? ['K', 'Q', 'J'] : id === 'grim' ? ['A'] : RANKS.filter(r => !['K', 'Q', 'J', 'A'].includes(r));
      const enhPool = ['bonus', 'mult', 'wild', 'glass', 'gold', 'lucky'];
      for (let i = 0; i < count; i++) {
        const card = makeCard(rng.pick(SUITS), rng.pick(ranks), { enhancement: rng.pick(enhPool) });
        G.hand.push(card);
        dispatchHook(G.jokers, 'onCardAdded', G, card);
      }
      return { ok: true, msg: `${def.zh}：${count} 张强化牌已加入手牌` };
    }
    case 'aura': {
      const roll = rng.random();
      targets[0].edition = roll < 0.5 ? 'foil' : roll < 0.85 ? 'holographic' : 'polychrome';
      G.selected = [];
      return { ok: true, msg: `${def.zh}：已附上版本` };
    }
    case 'wraith': {
      const pool = JOKERS.filter(j => j.rarity === 'rare' && !G.jokers.some(x => x.id === j.id));
      const inst = makeJokerInstance(rng.pick(pool.length ? pool : JOKERS.filter(j => j.rarity !== 'legendary')).id);
      if (!addJoker(G, inst)) return { ok: false, msg: '小丑牌槽已满' };
      G.money = 0;
      return { ok: true, msg: `怨灵：获得「${inst.zh}」，金钱归零` };
    }
    case 'sigil': {
      const s = rng.pick(SUITS);
      for (const c of G.hand) if (c.enhancement !== 'stone') c.suit = s;
      return { ok: true, msg: `印记：全部转换为 ${s === 'spades' ? '♠' : s === 'hearts' ? '♥' : s === 'diamonds' ? '♦' : '♣'}` };
    }
    case 'ouija': {
      const r = rng.pick(RANKS);
      for (const c of G.hand) if (c.enhancement !== 'stone') c.rank = r;
      G.config.handSize = Math.max(0, G.config.handSize - 1);
      return { ok: true, msg: `通灵板：全部 → ${r}，手牌上限 -1` };
    }
    case 'ectoplasm': {
      if (!G.jokers.length) return { ok: false, msg: '没有小丑牌' };
      const j = rng.pick(G.jokers);
      j.edition = 'negative';
      return { ok: true, msg: `灵质：「${j.zh}」获得负片` };
    }
    case 'immolate': {
      if (!G.hand.length) return { ok: false, msg: '手中无牌' };
      const n = Math.min(5, G.hand.length);
      // Fisher-Yates shuffle to pick uniformly (旧版 rng.random * 递减长度导致偏斜)
      const shuffled = [...G.hand]; rng.shuffle(shuffled);
      const victims = shuffled.slice(0, n);
      for (const v of victims) destroyCards([v]);
      G.money += 20;
      return { ok: true, msg: `献祭：销毁 ${n} 张牌 +$20` };
    }
    case 'ankh': {
      if (!G.jokers.length) return { ok: false, msg: '没有小丑牌' };
      const target = rng.pick(G.jokers);
      const dup = makeJokerInstance(target.id, { edition: target.edition });
      dup.state = target.state;
      // 清除所有旧 Joker 的被动效果
      for (const j of G.jokers) { getJokerHandlers(j.id).onRemoved?.(G, j); getJokerHandlers(j.id).onSelfSold?.(G, j); }
      G.jokers.length = 0;
      G.jokers.push(dup);
      bus.emit('jokers:change');
      return { ok: true, msg: `安卡：仅保留复制的「${dup.zh}」` };
    }
    case 'hex': {
      if (!G.jokers.length) return { ok: false, msg: '没有小丑牌' };
      const target = rng.pick(G.jokers);
      target.edition = 'polychrome';
      // 清除被销毁 Joker 的被动效果
      for (const j of G.jokers) { if (j !== target) { getJokerHandlers(j.id).onRemoved?.(G, j); getJokerHandlers(j.id).onSelfSold?.(G, j); } }
      G.jokers = [target];
      bus.emit('jokers:change');
      return { ok: true, msg: `妖术：「${target.zh}」获得多彩，其余销毁` };
    }
    case 'cryptid': {
      for (let i = 0; i < 2; i++) {
        const copy = makeCard(targets[0].suit, targets[0].rank,
          { enhancement: targets[0].enhancement, edition: targets[0].edition, seal: targets[0].seal });
        G.hand.push(copy);
        dispatchHook(G.jokers, 'onCardAdded', G, copy);
      }
      G.selected = [];
      return { ok: true, msg: '秘影：已复制 2 张' };
    }
    case 'soul': {
      const leg = JOKERS.filter(j => j.rarity === 'legendary');
      const inst = makeJokerInstance(rng.pick(leg).id);
      return addJoker(G, inst) ? { ok: true, msg: `灵魂：获得传奇「${inst.zh}」!` } : { ok: false, msg: '小丑牌槽已满' };
    }
    case 'black_hole': {
      for (const h of HAND_TYPES) G.handLevels[h.id] = (G.handLevels[h.id] ?? 1) + 1;
      return { ok: true, msg: '黑洞：全部手型升 1 级!' };
    }
  }
  return { ok: false, msg: '未实现' };
}
