// save-client.js — 前端存档客户端：REST 优先，localStorage 兜底
import { G, PHASES, bus } from './state.js';
import { serializeRun } from './serialize.js';
import { awardChips } from './upgrades.js';

const LS_RUN = 'balatro_run';
const LS_STATS = 'balatro_stats';
const RUN_ID = 'current';

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.status === 204 ? null : res.json();
}

/** 保存当前对局（自动兜底 localStorage） */
export async function saveNow() {
  const payload = serializeRun();
  try {
    await api(`/runs/${RUN_ID}`, { method: 'PUT', body: JSON.stringify(payload) });
  } catch (e) {
    try { localStorage.setItem(LS_RUN, JSON.stringify(payload)); } catch (e2) { /* 忽略 */ }
  }
}

/** 读取存档（服务器 → localStorage → null） */
export async function loadSave() {
  try {
    const data = await api(`/runs/${RUN_ID}`);
    if (data) return data;
  } catch (e) { /* 降级 */ }
  try {
    const raw = localStorage.getItem(LS_RUN);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export async function clearSave() {
  try { await api(`/runs/${RUN_ID}`, { method: 'DELETE' }); } catch (e) { /* 忽略 */ }
  try { localStorage.removeItem(LS_RUN); } catch (e) { /* 忽略 */ }
}

/** 记录一局结果 */
async function recordResult(won) {
  const entry = {
    won, ante: Math.min(G.ante, 8), round: G.round,
    bestHand: G.stats.bestHandScore, money: G.money, seed: G.seed,
    endedAt: new Date().toISOString(),
  };
  try {
    await api('/stats/record', { method: 'POST', body: JSON.stringify(entry) });
  } catch (e) {
    try {
      const s = JSON.parse(localStorage.getItem(LS_STATS) ?? '{"games":0,"wins":0,"bestScore":0,"history":[]}');
      s.games++; if (won) s.wins++;
      s.bestScore = Math.max(s.bestScore, entry.bestHand);
      s.history.unshift(entry); s.history = s.history.slice(0, 50);
      localStorage.setItem(LS_STATS, JSON.stringify(s));
    } catch (e2) { /* 忽略 */ }
  }
}

export async function fetchStats() {
  try { return await api('/stats'); } catch (e) { /* 降级 */ }
  try { return JSON.parse(localStorage.getItem(LS_STATS)) ?? null; } catch (e) { return null; }
}

const LS_CHIP_RESULT = 'balatro_last_chip';
function saveChipResult(info) { try { localStorage.setItem(LS_CHIP_RESULT, JSON.stringify(info)); } catch (e) {} }
export function getLastChipResult() { try { return JSON.parse(localStorage.getItem(LS_CHIP_RESULT)); } catch (e) { return null; } }

/** 自动存档挂钩：盲注选择/商店/每次出弃牌落地后保存；终局清档+记录 */
export function initSaveClient() {
  bus.on('phase', ({ phase }) => {
    if (phase === PHASES.BLIND_SELECT || phase === PHASES.SHOP) saveNow();
    if (phase === PHASES.GAME_OVER) {
      const gambled = G._gambled && !G._cashedOut;
      const chip = awardChips(G.ante, gambled);
      saveChipResult({ ...chip, gambled });
      recordResult(false); clearSave();
    }
    if (phase === PHASES.WIN) { const chip = awardChips(G.ante, false); saveChipResult(chip); recordResult(true); clearSave(); }
  });
  bus.on('hand:resolved', saveNow);
  bus.on('hand:discarded', saveNow);
}
