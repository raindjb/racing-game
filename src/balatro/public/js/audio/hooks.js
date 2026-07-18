// audio/hooks.js — 引擎事件 → 音效映射 + 手势解锁 + 静音按钮
import { bus, G, PHASES } from '../state.js';
import { SFX, ac, toggleSfx, isSfxMuted } from './sfx.js';
import { startMusic, toggleMusic, isMusicOn, setBossMode } from './music.js';
import { setBossBackground } from '../shaders/background.js';

let unlocked = false;

export function initAudio() {
  // 浏览器自动播放策略：首次手势解锁并起音乐
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    ac();
    startMusic();
    updateButtons();
  };
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });

  // 事件映射
  bus.on('cards:drawn', throttle(() => SFX.cardDeal(), 90));
  bus.on('select:change', () => SFX.cardSelect());
  bus.on('hand:played', ({ result }) => {
    SFX.cardPlay();
    setTimeout(() => (result.score >= 1500 ? SFX.bigScore() : SFX.scoreTotal()), 350);
  });
  bus.on('hand:discarded', () => SFX.discard());
  bus.on('cards:destroyed', () => SFX.glassBreak());
  bus.on('hand:reordered', () => SFX.drag());
  bus.on('round:won', () => { SFX.roundWin(); setTimeout(() => SFX.money(), 500); });
  bus.on('run:lost', () => SFX.gameOver());
  bus.on('run:won', () => SFX.gameWin());
  bus.on('ui:reject', () => SFX.reject());
  bus.on('consumable:used', ({ inst }) => inst.kind === 'tarot' ? SFX.tarotUse() : SFX.planetUse());
  bus.on('voucher:bought', () => SFX.voucher());
  bus.on('jokers:change', () => SFX.buy());
  bus.on('shop:enter', () => SFX.packOpen());
  bus.on('blind:start', ({ boss }) => {
    setBossMode(!!boss);
    setBossBackground(!!boss);
    boss ? SFX.bossWarn() : SFX.blindStart();
  });
  bus.on('phase', ({ phase }) => {
    if (phase === PHASES.BOOSTER) SFX.packOpen();
    if (phase === PHASES.BLIND_SELECT) { setBossMode(false); setBossBackground(false); }
  });

  // 静音按钮
  document.getElementById('btn-sfx')?.addEventListener('click', () => { toggleSfx(); updateButtons(); });
  document.getElementById('btn-music')?.addEventListener('click', () => { ac(); toggleMusic(); updateButtons(); });
  updateButtons();
}

function updateButtons() {
  const s = document.getElementById('btn-sfx');
  const m = document.getElementById('btn-music');
  if (s) s.textContent = isSfxMuted() ? '🔇 音效' : '🔊 音效';
  if (m) m.textContent = isMusicOn() ? '🎵 音乐' : '🎵 关';
}

function throttle(fn, ms) {
  let last = 0;
  return (...a) => { const n = Date.now(); if (n - last > ms) { last = n; fn(...a); } };
}
