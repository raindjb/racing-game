// consumable-manager.js — 消耗牌（塔罗/星球）：创建/使用/出售 + 塔罗效果实现
import { G, bus, selectedCards } from './state.js';
import { TAROT_MAP, TAROTS } from './data/tarots.js';
import { PLANET_MAP, PLANETS } from './data/planets.js';
import { JOKERS } from './data/jokers.js';
import { RANKS } from './data/card-data.js';
import { destroyCards } from './deck.js';
import { makeJokerInstance, addJoker, sellValue } from './joker-manager.js';

let nextUid = 1000;
export function setNextConsumableUid(n) { nextUid = Math.max(1000, n); }
export function peekNextConsumableUid() { return nextUid; }

export function makeConsumable(kind, defId) {
  const def = kind === 'tarot' ? TAROT_MAP[defId] : PLANET_MAP[defId];
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
  G.consumables.splice(i, 1);
  G.money += 1;
  bus.emit('consumables:change');
  return true;
}

/** 随机星球（秘密手型需本局打出过） */
export function randomPlanetId(rng) {
  const pool = PLANETS.filter(p => !p.secret || (G.handPlayed[p.hand] ?? 0) > 0);
  return rng.pick(pool).id;
}
export function randomTarotId(rng) { return rng.pick(TAROTS).id; }

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
  } else {
    res = useTarot(inst.id);
  }

  if (res.ok) {
    if (inst.id !== 'fool') G.lastConsumableUsed = { kind: inst.kind, id: inst.id };
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
