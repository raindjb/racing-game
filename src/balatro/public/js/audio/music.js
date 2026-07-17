// audio/music.js — 雨声环境音效引擎（多层滤波噪点 + 离散雨滴 + Boss 远雷）
import { ac, masterNode } from './sfx.js';

// 调度参数
const LOOKAHEAD_S = 0.2;
const TICK_MS = 80;

let running = false;
let musicGain = null;
let timer = null;
let nextDrop = 0;
let bossMode = false;

// 持续噪点层（不需要调度，loop）
let bgNodes = [];

export function setBossMode(on) { bossMode = on; }
export function isMusicOn() { return running; }

export function startMusic() {
  if (running) return;
  const c = ac();
  running = true;
  musicGain = c.createGain();
  musicGain.gain.value = 0.22;
  musicGain.connect(masterNode());
  nextDrop = c.currentTime + 0.05;
  startBackgroundRain(c);
  timer = setInterval(schedule, TICK_MS);
}

export function stopMusic() {
  running = false;
  clearInterval(timer); timer = null;
  bgNodes.forEach(n => { try { n.src.stop(); } catch (e) {} n.src.disconnect(); n.gain.disconnect(); n.filter.disconnect(); });
  bgNodes = [];
  if (musicGain) { musicGain.disconnect(); musicGain = null; }
}

export function toggleMusic() { return running ? stopMusic() : startMusic(), running; }

// ===== 调度雨滴 =====
function schedule() {
  const c = ac();
  const now = c.currentTime;
  while (nextDrop < now + LOOKAHEAD_S) {
    // 随机间隔 20-120ms 一枚雨滴
    const interval = 0.02 + Math.random() * 0.10;
    nextDrop += interval;
    raindrop(nextDrop, c);
  }
  // Boss 模式：偶尔远方雷声
  if (bossMode && Math.random() < 0.004) {
    thunder(now + Math.random() * 0.5, c);
  }
}

/** 单枚雨滴：短促噪点脉冲 + 随机音高 */
function raindrop(t, c) {
  const dur = 0.03 + Math.random() * 0.06;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = 1 - i / len;
    d[i] = (Math.random() * 2 - 1) * env * env;
  }
  const src = c.createBufferSource(); src.buffer = buf;

  // 带通滤波聚焦 2-6kHz（雨滴声的自然频段）
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2000 + Math.random() * 4000;
  bp.Q.value = 1.2 + Math.random() * 1.8;

  const g = c.createGain();
  const vol = 0.04 + Math.random() * 0.08;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);

  src.connect(bp); bp.connect(g); g.connect(musicGain);
  src.start(t);
  src.stop(t + dur + 0.01);
}

// ===== 背景持续雨声（3 层噪点 loop） =====
function startBackgroundRain(c) {
  // 底层：低频轰隆（远处雨幕）
  createNoiseLayer(c, {
    dur: 3.2,
    filterType: 'lowpass',
    freq: 320,
    q: 0.5,
    gain: 0.09,
  });
  // 中层：中频沙沙（主要雨声体感）
  createNoiseLayer(c, {
    dur: 2.7,
    filterType: 'bandpass',
    freq: 900,
    q: 0.6,
    gain: 0.11,
  });
  // 高层：微亮顶（叶面滴水 / 窗沿）
  createNoiseLayer(c, {
    dur: 2.3,
    filterType: 'highpass',
    freq: 3800,
    q: 0.7,
    gain: 0.03,
  });
}

function createNoiseLayer(c, { dur, filterType, freq, q, gain }) {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);

  // 粉噪近似：白噪 → 每采样点累加低频倾向
  let b0 = 0, b1 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + 0.03 * white;
    b1 = 0.985 * b1 + 0.015 * white;
    d[i] = (b0 + b1) * 0.5;
  }

  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = c.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  if (q !== undefined) f.Q.value = q;
  const g = c.createGain();
  g.gain.value = gain;

  src.connect(f); f.connect(g); g.connect(musicGain);
  src.start();
  bgNodes.push({ src, filter: f, gain: g });
}

// ===== 雷声（Boss 模式） =====
function thunder(t, c) {
  const dur = 1.4 + Math.random() * 1.8;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);

  for (let i = 0; i < len; i++) {
    const env = Math.exp(-i / (c.sampleRate * 0.5)); // 指数衰减
    d[i] = (Math.random() * 2 - 1) * env * 0.5;
  }

  const src = c.createBufferSource(); src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(110, t);
  lp.frequency.exponentialRampToValueAtTime(40, t + dur);

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);

  src.connect(lp); lp.connect(g); g.connect(musicGain);
  src.start(t);
  src.stop(t + dur + 0.1);
}
