// audio/music.js — 三模音乐引擎：普通 lo-fi + Boss 诡异 + 商店暖爵
import { ac, masterNode } from './sfx.js';

const NORMAL_BPM = 84;
const BOSS_BPM = 56;
const SHOP_BPM = 78;             // 商店轻松摇摆
const SWING = 0.62;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.15;

const N = (() => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const map = {};
  for (let oct = 1; oct <= 6; oct++) names.forEach((n, i) => {
    map[`${n}${oct}`] = 440 * Math.pow(2, (i - 9) / 12 + (oct - 4));
  });
  return map;
})();

// 普通：Fmaj7-Dm7-Gm7-C7
const PROG_NORMAL = [
  { bass: 'F2',  chord: ['F3','A3','C4','E4'] },
  { bass: 'D2',  chord: ['D3','F3','A3','C4'] },
  { bass: 'G2',  chord: ['G3','A#3','D4','F4'] },
  { bass: 'C2',  chord: ['C3','E3','G3','A#3'] },
];
// Boss：Dm7–B♭m6–Gm7–A♭dim
const PROG_BOSS = [
  { bass: 'D2',  chord: ['D3','F3','A3','C4'] },
  { bass: 'A#1', chord: ['A#2','C#3','F3','G3'] },
  { bass: 'G2',  chord: ['G3','A#3','D4','F4'] },
  { bass: 'G#1', chord: ['G#2','B2','D3','F3'] },
];
// 商店：Cmaj7–Am7–Dm7–G7（暖爵，轻松逛店感）
const PROG_SHOP = [
  { bass: 'C2',  chord: ['C3','E3','G3','B3'] },          // Cmaj7
  { bass: 'A1',  chord: ['A2','C3','E3','G3'] },          // Am7
  { bass: 'D2',  chord: ['D3','F3','A3','C4'] },          // Dm7
  { bass: 'G1',  chord: ['G2','B2','D3','F3'] },          // G7
];
// 旋律库：C 大调五声音阶 (C D E G A)，按和弦音挑
const MELODY = [
  [N['C5'], N['E5'], N['G5'], N['B5']],   // Cmaj7 上
  [N['A4'], N['C5'], N['E5'], N['G5']],   // Am7 上
  [N['D5'], N['F5'], N['A5'], N['C5']],   // Dm7 上
  [N['G4'], N['B4'], N['D5'], N['F5']],   // G7 上
];

let running = false;
let musicGain = null;
let timer = null;
let nextBeat = 0, beatIdx = 0;
let bpm = NORMAL_BPM;
let prog = PROG_NORMAL;
let rainNodes = [];
let nextDrop = 0;
let shopMode = false;

// Boss 持续 pad
let bossPadOscs = [];

export function setBossMode(on) {
  if (on) { shopMode = false; prog = PROG_BOSS; bpm = BOSS_BPM; if (musicGain) musicGain.gain.value = 0.22; if (running) startBossPad(); }
  else if (!shopMode) { prog = PROG_NORMAL; bpm = NORMAL_BPM; if (musicGain) musicGain.gain.value = 0.16; stopBossPad(); }
}
export function setShopMode(on) {
  shopMode = on;
  if (on) {
    stopBossPad();
    prog = PROG_SHOP; bpm = SHOP_BPM;
    if (musicGain) musicGain.gain.value = 0.14;
  } else {
    prog = PROG_NORMAL; bpm = NORMAL_BPM;
    if (musicGain) musicGain.gain.value = 0.16;
  }
}
export function isMusicOn() { return running; }

export function startMusic() {
  if (running) return;
  const c = ac();
  running = true;
  musicGain = c.createGain();
  musicGain.gain.value = prog === PROG_BOSS ? 0.22 : shopMode ? 0.14 : 0.16;
  musicGain.connect(masterNode());
  nextBeat = c.currentTime + 0.1;
  nextDrop = c.currentTime + 0.1;
  beatIdx = 0;
  if (!shopMode) startRain(c);
  if (prog === PROG_BOSS) startBossPad();
  timer = setInterval(schedule, LOOKAHEAD_MS);
}

export function stopMusic() {
  running = false;
  stopBossPad();
  clearInterval(timer); timer = null;
  rainNodes.forEach(n => { try { n.src.stop(); } catch (e) {} n.src.disconnect(); });
  rainNodes = [];
  if (musicGain) { musicGain.disconnect(); musicGain = null; }
}
export function toggleMusic() { running ? stopMusic() : startMusic(); return running; }

// ===== 调度 =====
function schedule() {
  const c = ac();
  const eighth = 60 / bpm / 2;
  const isBoss = prog === PROG_BOSS;
  const isShop = shopMode;
  // 商店模式：无雨声（室内逛店）
  if (!isShop) {
    const perCycle = isBoss ? 2 : 5;
    const interval = isBoss ? 0.18 : 0.04;
    while (nextDrop < c.currentTime + SCHEDULE_AHEAD) {
      for (let d = 0; d < perCycle; d++) raindrop(nextDrop + d * 0.006, c);
      nextDrop += interval + Math.random() * interval * 1.2;
    }
  }
  while (nextBeat < c.currentTime + SCHEDULE_AHEAD) {
    if (isShop) shopBeat(beatIdx, nextBeat, c);
    else scheduleBeat(beatIdx, nextBeat, c, isBoss);
    nextBeat += (beatIdx % 2 === 0) ? eighth * 2 * SWING : eighth * 2 * (1 - SWING);
    beatIdx++;
  }
}

function scheduleBeat(i, t, c, isBoss) {
  const eighthInBar = i % 8;
  const bar = Math.floor(i / 8) % 4;
  const ch = prog[bar];

  // 鼓（Boss 态：更重更沉，去掉 hi-hat 保持压迫）
  if (isBoss) {
    // pad 跟随当前小节和弦变化
    if (eighthInBar === 0) updateBossPadChord(ch.chord);
    // 重 kick：第 1、5 拍
    if (eighthInBar === 0 || eighthInBar === 4) bossKick(t, c);
    // 低频军鼓：第 3、7 拍
    if (eighthInBar === 2 || eighthInBar === 6) bossSnare(t, c);
    // 暗色踩镲：仅奇数弱拍，很轻（不是明亮 hi-hat，是低沉刷音）
    if (eighthInBar % 2 === 1) darkHat(t, c);
  } else {
    if (eighthInBar === 0 || eighthInBar === 4) kick(t, c);
    if (eighthInBar === 2 || eighthInBar === 6) snare(t, c);
    hat(t, c, eighthInBar % 2 === 1 ? 0.02 : 0.036);
  }

  // 贝斯（两模式共用，Boss 更重更长）
  if (eighthInBar === 0) bassNote(N[ch.bass], t, c, 1, isBoss);
  if (eighthInBar === 4) bassNote(N[ch.bass] * 1.5, t, c, 0.7, isBoss);

  // 和弦（Boss：全部方波+低通，更暗）
  if (eighthInBar === 0) strum(ch.chord, t, c, isBoss ? 0.06 : 0.05, isBoss);
  if (eighthInBar === 5) strum(ch.chord, t, c, isBoss ? 0.04 : 0.035, isBoss);
}

// ===== 普通鼓 =====
function kick(t, c) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(115, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  o.connect(g); g.connect(musicGain);
  o.start(t); o.stop(t + 0.18);
}

// ===== 商店编曲（暖爵 lo-fi：软电钢+行走贝斯+刷鼓+五声旋律） =====
function shopBeat(i, t, c) {
  const eighthInBar = i % 8;
  const bar = Math.floor(i / 8) % 4;
  const ch = prog[bar];
  if (eighthInBar === 0 || eighthInBar === 4) shopKick(t, c);
  if (eighthInBar === 2 || eighthInBar === 6) shopSnare(t, c);
  shopHat(t, c, eighthInBar % 2 === 1 ? 0.012 : 0.022);
  const bi = (bar * 2 + (eighthInBar >= 4 ? 1 : 0)) % ch.chord.length;
  shopBass(N[ch.chord[bi]] * 0.5, t, c, eighthInBar === 0 || eighthInBar === 4 ? 0.9 : 0.55);
  if (eighthInBar === 0) shopChord(ch.chord, t, c, 0.05);
  if (eighthInBar === 4) shopChord(ch.chord, t, c, 0.035);
  if (eighthInBar === 0) shopMelodyNote(MELODY[bar][i % MELODY[bar].length], t, c);
}
function shopKick(t, c) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
  g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.15);
}
function shopSnare(t, c) {
  const len = Math.ceil(c.sampleRate * 0.07);
  const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
  for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 1.8);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3200; f.Q.value = 0.4;
  const g = c.createGain(); g.gain.setValueAtTime(0.08, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  src.connect(f); f.connect(g); g.connect(musicGain); src.start(t);
}
function shopHat(t, c, vol) {
  const len = Math.ceil(c.sampleRate * 0.025);
  const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
  for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
  const g = c.createGain(); g.gain.setValueAtTime(vol * (0.8 + Math.random() * 0.2), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
  src.connect(f); f.connect(g); g.connect(musicGain); src.start(t);
}
function shopBass(freq, t, c, vol) {
  const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  o.type = 'sine'; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = 380;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22 * vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(f); f.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.4);
}
function shopChord(chordNotes, t, c, vol) {
  chordNotes.forEach((name, i) => {
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = N[name] * (1 + (Math.random() - 0.5) * 0.002);
    f.type = 'lowpass'; f.frequency.value = 1100;
    const at = t + i * 0.018;
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol, at + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, at + 1.4);
    o.connect(f); f.connect(g); g.connect(musicGain); o.start(at); o.stop(at + 1.45);
  });
}
function shopMelodyNote(freq, t, c) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.65);
}

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

// ===== Boss 鼓（更沉更重） =====
function bossKick(t, c) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(32, t + 0.16);
  g.gain.setValueAtTime(0.62, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  o.connect(g); g.connect(musicGain);
  o.start(t); o.stop(t + 0.24);
}

function bossSnare(t, c) {
  const len = Math.ceil(c.sampleRate * 0.13);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 2.2);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 1.2;
  const g = c.createGain(); g.gain.setValueAtTime(0.28, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  src.connect(f); f.connect(g); g.connect(musicGain);
  src.start(t);
}

/** Boss 暗色刷音（替代明亮 hi-hat — 低频噪点轻刷） */
function darkHat(t, c) {
  const len = Math.ceil(c.sampleRate * 0.04);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.5;
  const g = c.createGain();
  g.gain.setValueAtTime(0.04 + Math.random() * 0.03, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  src.connect(f); f.connect(g); g.connect(musicGain);
  src.start(t);
}

// ===== 贝斯（Boss 加 sub 层） =====
function bassNote(freq, t, c, vol = 1, isBoss = false) {
  const gain = isBoss ? 0.38 : 0.34;
  const dur = isBoss ? 0.7 : 0.5;
  // 主贝斯
  const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  o.type = isBoss ? 'sawtooth' : 'sine';
  o.frequency.value = freq;
  f.type = 'lowpass'; f.frequency.value = isBoss ? 200 : 320;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain * vol, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f); f.connect(g); g.connect(musicGain);
  o.start(t); o.stop(t + dur + 0.05);
  // Boss：子八度层（频率除 2）
  if (isBoss && vol === 1) {
    const o2 = c.createOscillator(), g2 = c.createGain(), f2 = c.createBiquadFilter();
    o2.type = 'sine'; o2.frequency.value = freq / 2;
    f2.type = 'lowpass'; f2.frequency.value = 140;
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.linearRampToValueAtTime(0.15, t + 0.04);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o2.connect(f2); f2.connect(g2); g2.connect(musicGain);
    o2.start(t); o2.stop(t + dur + 0.05);
  }
}

// ===== 和弦（Boss：方波+深低通，普通：三角波+浅低通） =====
function strum(chordNotes, t, c, vol, isBoss = false) {
  chordNotes.forEach((name, i) => {
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = isBoss ? 'sawtooth' : 'triangle';
    o.frequency.value = N[name] * (1 + (Math.random() - 0.5) * 0.0015);
    f.type = 'lowpass'; f.frequency.value = isBoss ? 480 : 1600;
    const at = t + i * (isBoss ? 0.022 : 0.012);  // Boss 和弦更散
    const dur = isBoss ? 1.6 : 1.15;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol * (isBoss ? 1.3 : 1), at + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(f); f.connect(g); g.connect(musicGain);
    o.start(at); o.stop(at + dur + 0.02);
  });
}

// ===== Boss 持续暗黑 pad（低通锯齿波全和弦延音） =====
function startBossPad() {
  if (bossPadOscs.length) return;
  const c = ac();
  const chord = PROG_BOSS[0].chord;  // Dm7
  chord.forEach(note => {
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.value = N[note] * 0.5;  // 降八度（更暗）
    f.type = 'lowpass'; f.frequency.value = 350;
    g.gain.value = 0.04;
    o.connect(f); f.connect(g); g.connect(musicGain);
    o.start();
    bossPadOscs.push({ osc: o, filt: f, gain: g });
  });
}

/** 平滑过渡 pad 和弦（每小节切换） */
function updateBossPadChord(chordNotes) {
  const c = ac();
  const now = c.currentTime;
  bossPadOscs.slice(0, chordNotes.length).forEach((node, i) => {
    if (i < chordNotes.length) {
      const targetFreq = N[chordNotes[i]] * 0.5;
      node.osc.frequency.setTargetAtTime(targetFreq, now, 0.25);
    }
  });
}

function stopBossPad() {
  bossPadOscs.forEach(({ osc, filt, gain }) => {
    try { osc.stop(); } catch (e) {}
    osc.disconnect(); filt.disconnect(); gain.disconnect();
  });
  bossPadOscs = [];
}

// ===== 雨声氛围（写实多层引擎） =====
function startRain(c) {
  // Hiss 宽带丝声（真实雨的核心：万千细滴同时落下 → 白噪高频底）
  rainHiss(c, { dur: 3.1, hpFreq: 1800, gain: 0.035 });
  // 中层雨幕：粉噪 + 带通 ~800Hz（主要 pitter-patter 体感）
  pinkLayer(c, { dur: 2.5, type: 'bandpass', freq: 800, q: 0.55, gain: 0.05 });
  // 低层远雨轰隆（远处雨帘的低频震动）
  pinkLayer(c, { dur: 3.8, type: 'lowpass', freq: 250, q: 0.4, gain: 0.04 });
  // 亚低音大气 rumb（非常安静，添加"氛围重量"）
  pinkLayer(c, { dur: 4.2, type: 'lowpass', freq: 80, q: 0.3, gain: 0.025 });
}

/** Hiss 层：白噪 → 高通（模拟万千微小水滴的集体嘶嘶声） */
function rainHiss(c, { dur, hpFreq, gain }) {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = hpFreq; hp.Q.value = 0.3;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(hp); hp.connect(g); g.connect(musicGain);
  src.start(); rainNodes.push({ src });
}

/** 粉噪层（IIR 近似粉噪：每采样点累加低频倾向，比白噪自然） */
function pinkLayer(c, { dur, type, freq, q, gain }) {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.985   * b2 + white * 0.1;
    d[i] = (b0 + b1 + b2) * 0.25;
  }
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(musicGain);
  src.start(); rainNodes.push({ src });
}

/** 雨滴：锐起音 + 快衰减 + 立体声随机 pan + 偶尔重滴水 */
function raindrop(t, c) {
  const heavy = Math.random() < 0.15;  // 15% 概率重滴水（檐边/叶面积水坠落）
  const dur = heavy ? 0.06 + Math.random() * 0.08 : 0.02 + Math.random() * 0.04;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    // 锐起音包络：瞬时峰值 → 陡降（模拟水滴撞击瞬态）
    const attack = Math.min(1, i / (len * 0.06));  // 6% 时长即达峰
    const decay = Math.exp(-i / (len * 0.18));       // 指数衰减尾巴
    d[i] = (Math.random() * 2 - 1) * attack * decay * (heavy ? 1.5 : 1);
  }
  const src = c.createBufferSource(); src.buffer = buf;

  // 带通：重滴水低频（300-1800Hz），普通滴中频（1.5-5kHz）
  const bp = c.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.value = heavy ? (300 + Math.random() * 1500) : (1500 + Math.random() * 3500);
  bp.Q.value = heavy ? 1.8 : 1.2;

  const g = c.createGain();
  const vol = heavy ? (0.04 + Math.random() * 0.06) : (0.015 + Math.random() * 0.025);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);

  // 立体声 pan：随机左右（-0.6~0.6）
  const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  if (pan) {
    pan.pan.value = (Math.random() - 0.5) * 1.2;
    src.connect(bp); bp.connect(pan); pan.connect(g); g.connect(musicGain);
  } else {
    src.connect(bp); bp.connect(g); g.connect(musicGain);
  }
  src.start(t); src.stop(t + dur + 0.02);
}
