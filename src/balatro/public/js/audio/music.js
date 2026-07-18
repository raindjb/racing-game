// audio/music.js — 双引擎音乐系统：普通 lo-fi 循环 + Boss 工业压迫曲
// Boss 完全独立编曲（非普通曲变体），无和弦进行，鼓+脉冲+金属击打+攀升低音
import { ac, masterNode } from './sfx.js';

const BPM = 84;
const BOSS_BPM = 60;              // Boss 更慢更沉重
const SWING = 0.62;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.15;

// 音名 → 频率（普通模式用）
const N = (() => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const map = {};
  for (let oct = 1; oct <= 6; oct++) names.forEach((n, i) => {
    map[`${n}${oct}`] = 440 * Math.pow(2, (i - 9) / 12 + (oct - 4));
  });
  return map;
})();

const PROG_NORMAL = [
  { bass: 'F2',  chord: ['F3', 'A3', 'C4', 'E4'] },
  { bass: 'D2',  chord: ['D3', 'F3', 'A3', 'C4'] },
  { bass: 'G2',  chord: ['G3', 'A#3', 'D4', 'F4'] },
  { bass: 'C2',  chord: ['C3', 'E3', 'G3', 'A#3'] },
];

let running = false;
let musicGain = null;
let timer = null;
let nextBeat = 0, beatIdx = 0;
let prog = PROG_NORMAL;
let rainNodes = [];
let nextDrop = 0;

// === Boss 引擎独立状态 ===
let bossMode = false;
let bossNext = 0;           // 下一个 boss 事件时间
let bossPhase = 0;          // 16 拍循环中的位置
let bossRiseFreq = 0;       // 攀升低音当前频率
let bossRiseGain = null;    // 攀升低音增益节点
let bossRiseOsc = null;
let bossMetalNext = 0;      // 金属打击下次时间
let bossPulseOsc = null, bossPulseGain = null;   // 心跳脉冲

export function setBossMode(on) {
  bossMode = on;
  if (on && running) {
    startBossEngine();
  } else {
    stopBossEngine();
  }
}
export function isMusicOn() { return running; }

export function startMusic() {
  if (running) return;
  const c = ac();
  running = true;
  musicGain = c.createGain();
  musicGain.gain.value = bossMode ? 0.18 : 0.16;
  musicGain.connect(masterNode());
  nextBeat = c.currentTime + 0.1;
  nextDrop = c.currentTime + 0.1;
  beatIdx = 0;
  startRain(c);
  if (bossMode) startBossEngine();
  timer = setInterval(schedule, LOOKAHEAD_MS);
}

export function stopMusic() {
  running = false;
  stopBossEngine();
  clearInterval(timer); timer = null;
  rainNodes.forEach(n => { try { n.src.stop(); } catch (e) {} n.src.disconnect(); });
  rainNodes = [];
  if (musicGain) { musicGain.disconnect(); musicGain = null; }
}
export function toggleMusic() { running ? stopMusic() : startMusic(); return running; }

// ============================================================
//  调度入口
// ============================================================
function schedule() {
  const c = ac();
  if (bossMode) {
    scheduleBoss(c);
  } else {
    scheduleNormal(c);
  }
  // 雨滴（两模式共用）
  while (nextDrop < c.currentTime + SCHEDULE_AHEAD) {
    nextDrop += 0.06 + Math.random() * 0.18;
    raindrop(nextDrop, c);
  }
}

// ============================================================
//  普通模式（原 lo-fi 和弦循环，不变）
// ============================================================
function scheduleNormal(c) {
  const eighth = 60 / BPM / 2;
  while (nextBeat < c.currentTime + SCHEDULE_AHEAD) {
    normalBeat(beatIdx, nextBeat, c);
    nextBeat += (beatIdx % 2 === 0) ? eighth * 2 * SWING : eighth * 2 * (1 - SWING);
    beatIdx++;
  }
}

function normalBeat(i, t, c) {
  const eighthInBar = i % 8;
  const bar = Math.floor(i / 8) % 4;
  const ch = prog[bar];
  if (eighthInBar === 0 || eighthInBar === 4) kick(t, c, false);
  if (eighthInBar === 2 || eighthInBar === 6) snare(t, c);
  hat(t, c, eighthInBar % 2 === 1 ? 0.02 : 0.036);
  if (eighthInBar === 0) bassNote(N[ch.bass], t, c);
  if (eighthInBar === 4) bassNote(N[ch.bass] * 1.5, t, c, 0.7);
  if (eighthInBar === 0) strum(ch.chord, t, c, 0.05);
  if (eighthInBar === 5) strum(ch.chord, t, c, 0.035);
}

// ============================================================
//  Boss 模式 — 工业压迫编曲（独立节奏/音色/结构）
// ============================================================
function startBossEngine() {
  const c = ac();
  bossNext = c.currentTime + 0.15;
  bossPhase = 0;
  bossRiseFreq = 34;                      // 从极低频开始攀升
  bossMetalNext = c.currentTime + (1.2 + Math.random() * 3.5);
  // 攀升低音持续音
  if (!bossRiseOsc) {
    bossRiseGain = c.createGain();
    bossRiseGain.gain.setValueAtTime(0.06, c.currentTime);
    bossRiseGain.connect(musicGain);
    bossRiseOsc = c.createOscillator();
    bossRiseOsc.type = 'sawtooth';
    bossRiseOsc.frequency.value = bossRiseFreq;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    bossRiseOsc.connect(lp); lp.connect(bossRiseGain);
    bossRiseOsc.start();
  }
  // 心跳脉冲（50BPM）
  if (!bossPulseOsc) {
    bossPulseGain = c.createGain();
    bossPulseGain.gain.value = 0;
    bossPulseGain.connect(musicGain);
    bossPulseOsc = c.createOscillator();
    bossPulseOsc.type = 'sine';
    bossPulseOsc.frequency.value = 48;   // 极低音
    bossPulseOsc.connect(bossPulseGain);
    bossPulseOsc.start();
  }
}

function stopBossEngine() {
  if (bossRiseOsc) { try { bossRiseOsc.stop(); } catch (e) {} bossRiseOsc.disconnect(); bossRiseOsc = null; }
  if (bossRiseGain) { bossRiseGain.disconnect(); bossRiseGain = null; }
  if (bossPulseOsc) { try { bossPulseOsc.stop(); } catch (e) {} bossPulseOsc.disconnect(); bossPulseOsc = null; }
  if (bossPulseGain) { bossPulseGain.disconnect(); bossPulseGain = null; }
}

function scheduleBoss(c) {
  const step = 60 / BOSS_BPM;     // 每拍 1 秒（60 BPM）
  while (bossNext < c.currentTime + SCHEDULE_AHEAD) {
    bossBeat(bossPhase, bossNext, c);
    bossNext += step;
    bossPhase = (bossPhase + 1) % 16;
    // 攀升低音频率线性上升（每个 16 拍循环从 34Hz 爬到 68Hz）
    bossRiseFreq = 34 + (bossPhase / 15) * 34;
    if (bossRiseOsc) bossRiseOsc.frequency.linearRampToValueAtTime(bossRiseFreq, bossNext);
  }
  // 不规则金属打击
  if (bossMetalNext < c.currentTime + 0.3) {
    bossHit(c);
    bossMetalNext = c.currentTime + 1.5 + Math.random() * 4.5;
  }
}

/** Boss 一拍：心跳+重击+噪点 */
function bossBeat(phase, t, c) {
  // 心跳脉冲（每拍）
  if (bossPulseGain) {
    bossPulseGain.gain.setValueAtTime(0.45, t);
    bossPulseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  }
  // 第一拍加沉重 kick（双重打击：低频 sine + 噪声）
  if (phase === 0) {
    kick(t, c, true);
    noiseKick(t, c);
  }
  // 第 8 拍加第二个重击
  if (phase === 8) {
    kick(t, c, true);
    noiseKick(t, c);
  }
  // 每隔 4 拍低沉小打击
  if (phase === 4 || phase === 12) smallHit(t, c);
}

/** 低频正弦 kick */
function kick(t, c, heavy) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(heavy ? 110 : 115, t);
  o.frequency.exponentialRampToValueAtTime(heavy ? 28 : 42, t + 0.14);
  g.gain.setValueAtTime(heavy ? 0.72 : 0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (heavy ? 0.24 : 0.16));
  o.connect(g); g.connect(musicGain);
  o.start(t); o.stop(t + (heavy ? 0.26 : 0.18));
}

/** 噪点爆炸（工业金属感） */
function noiseKick(t, c) {
  const dur = 0.22;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 0.9);
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 160; bp.Q.value = 2.0;
  const g = c.createGain();
  g.gain.setValueAtTime(0.38, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(musicGain);
  src.start(t);
}

/** 金属随机打击（不和谐音簇） */
function bossHit(c) {
  const t = c.currentTime;
  // 两三个不和谐频率同时发出
  for (const f of [180, 247, 335]) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(f * (0.92 + Math.random() * 0.16), t);
    o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.25);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 3;
    g.gain.setValueAtTime(0.08 + Math.random() * 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(bp); bp.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.3);
  }
}

/** 小打击：短促噪点（非节拍上） */
function smallHit(t, c) {
  const dur = 0.06;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
  const g = c.createGain();
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(hp); hp.connect(g); g.connect(musicGain);
  src.start(t);
}

// ============================================================
//  普通模式乐器（保留）
// ============================================================
function snare(t, c) {
  const len = Math.ceil(c.sampleRate * 0.09);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 2);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
  const g = c.createGain(); g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  src.connect(f); f.connect(g); g.connect(musicGain);
  src.start(t);
}

function hat(t, c, vol) {
  const len = Math.ceil(c.sampleRate * 0.03);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 1.2);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 0.7;
  const g = c.createGain(); g.gain.setValueAtTime(vol * (0.85 + Math.random() * 0.3), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  src.connect(f); f.connect(g); g.connect(musicGain);
  src.start(t);
}

function bassNote(freq, t, c, vol = 1) {
  const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  o.type = 'sine'; o.frequency.value = freq;
  f.type = 'lowpass'; f.frequency.value = 320;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.34 * vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  o.connect(f); f.connect(g); g.connect(musicGain);
  o.start(t); o.stop(t + 0.55);
}

function strum(chordNotes, t, c, vol) {
  chordNotes.forEach((name, i) => {
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = N[name] * (1 + (Math.random() - 0.5) * 0.0015);
    f.type = 'lowpass'; f.frequency.value = 1600;
    const at = t + i * 0.012;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, at + 1.15);
    o.connect(f); f.connect(g); g.connect(musicGain);
    o.start(at); o.stop(at + 1.2);
  });
}

// ===== 雨声氛围 =====
function startRain(c) {
  rainLayer(c, { dur: 2.7, type: 'bandpass', freq: 900, q: 0.6, gain: 0.055 });
  rainLayer(c, { dur: 3.2, type: 'lowpass', freq: 320, q: 0.5, gain: 0.045 });
}

function rainLayer(c, { dur, type, freq, q, gain }) {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + 0.03 * white;
    b1 = 0.985 * b1 + 0.015 * white;
    d[i] = (b0 + b1) * 0.5;
  }
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(musicGain);
  src.start();
  rainNodes.push({ src });
}

function raindrop(t, c) {
  const dur = 0.03 + Math.random() * 0.05;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = 1 - i / len;
    d[i] = (Math.random() * 2 - 1) * env * env;
  }
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2000 + Math.random() * 3000;
  bp.Q.value = 1.5;
  const g = c.createGain();
  g.gain.setValueAtTime(0.02 + Math.random() * 0.03, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(musicGain);
  src.start(t);
  src.stop(t + dur + 0.01);
}
