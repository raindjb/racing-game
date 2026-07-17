// joker-manager.js — Joker 实例：创建/添加/出售/槽位（纯逻辑）
import { JOKER_MAP } from './data/jokers.js';
import { getJokerHandlers } from './effects/index.js';
import { bus } from './state.js';

let nextUid = 1;

/** 创建 Joker 实例（商店/卡包购得时） */
export function makeJokerInstance(defId, opts = {}) {
  const def = JOKER_MAP[defId];
  if (!def) throw new Error(`未知 Joker: ${defId}`);
  return {
    uid: nextUid++,
    id: def.id, zh: def.zh, desc: def.desc, rarity: def.rarity,
    cost: opts.cost ?? def.cost,
    edition: opts.edition ?? null,
    state: 0,        // 成长型计数
    sellBonus: 0,    // 鸡蛋等增加的出售价值
    art: def.art,
  };
}

/** 当前 Joker 槽位上限（负片版本 +1） */
export function jokerSlotsOf(G) {
  return G.config.jokerSlots + G.jokers.filter(j => j.edition === 'negative').length;
}

/** 出售价值 */
export function sellValue(j) {
  return Math.max(1, Math.floor(j.cost / 2)) + (j.sellBonus ?? 0);
}

/** 添加（槽位满返回 false） */
export function addJoker(G, inst) {
  const slots = jokerSlotsOf(G) + (inst.edition === 'negative' ? 1 : 0);
  if (G.jokers.length >= slots) return false;
  G.jokers.push(inst);
  getJokerHandlers(inst.id).onAdded?.(G, inst);
  G.stats.jokersBought++;
  bus.emit('jokers:change');
  return true;
}

/** 出售 */
export function sellJoker(G, uid) {
  const i = G.jokers.findIndex(j => j.uid === uid);
  if (i < 0) return false;
  const j = G.jokers[i];
  getJokerHandlers(j.id).onRemoved?.(G, j);
  G.jokers.splice(i, 1);
  G.money += sellValue(j);
  bus.emit('jokers:change');
  return true;
}
