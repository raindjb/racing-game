// audio/music.js — lo-fi 循环音乐 + 雨声氛围底（原黑胶爆点电流声已移除）
import { ac, masterNode } from './sfx.js';

const BPM = 84;
const SWING = 0.62;               // 摇摆比例（>0.5 后八分音符延迟）
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.15;

// 音名 → 频率
const N = (() => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const map = {};
  for (let oct = 1; oct <= 6; oct++) names.forEach((n, i) => {
    map[`${n}${oct}`] = 440 * Math.pow(2, (i - 9) / 12 + (oct - 4));
  });
  return map;
})();

// 主循环：Fmaj7 – Dm7 – Gm7 – C7（I–vi–ii–V）
const PROG_NORMAL = [
  { bass: 'F2',  chord: ['F3', 'A3', 'C4', 'E4'] },
  { bass: 'D2',  chord: ['D3', 'F3', 'A3', 'C4'] },
  { bass: 'G2',  chord: ['G3', 'A#3', 'D4', 'F4'] },
  { bass: 'C2',  chord: ['C3', 'E3', 'G3', 'A#3'] },
];
// Boss 变奏：Dm7 – A#maj7 – Gm7 – A7
const PROG_BOSS = [
  { bass: 'D2',  chord: ['D3', 'F3', 'A3', 'C4'] },
  { bass: 'A#1', chord: ['A#2', 'D3', 'F3', 'A3'] },
  { bass: 'G2',  chord: ['G3', 'A#3', 'D4', 'F4'] },
  { bass: 'A1',  chord: ['A2', 'C#3', 'E3', 'G3'] },
];

let running = false;
let musicGain = null;
let timer = null;
let nextBeat = 0;      // 下一个待调度拍的时间
let beatIdx = 0;       // 全局八分音符计数
let prog = PROG_NORMAL;
let rainNodes = [];    // 雨声层节点（替代原黑胶噪声）
let nextDrop = 0;      // 下一枚雨滴时间

export function setBossMode(on) { prog = on ? PROG_BOSS : PROG_NORMAL; }
export function isMusicOn() { return running; }

export function startMusic() {
  if (running) return;
  const c = ac();
  running = true;
  musicGain = c.createGain();
  musicGain.gain.value = 0.16;
  musicGain.connect(masterNode());
  nextBeat = c.currentTime + 0.1;
  nextDrop = c.currentTime + 0.1;
  beatIdx = 0;
  startRain(c);
  timer = setInterval(schedule, LOOKAHEAD_MS);
}

export function stopMusic() {
  running = false;
  clearInterval(timer); timer = null;
  rainNodes.forEach(n => { try { n.src.stop(); } catch (e) {} n.src.disconnect(); });
  rainNodes = [];
  if (musicGain) { musicGain.disconnect(); musicGain = null; }
}
export function toggleMusic() { running ? stopMusic() : startMusic(); return running; }

/** 前瞻调度：每个八分音符为一拍；雨滴独立随机调度 */
function schedule() {
  const c = ac();
  const eighth = 60 / BPM / 2;
  while (nextBeat < c.currentTime + SCHEDULE_AHEAD) {
    scheduleBeat(beatIdx, nextBeat, c);
    // 摇摆：偶数八分正常长、奇数缩短
    nextBeat += (beatIdx % 2 === 0) ? eighth * 2 * SWING : eighth * 2 * (1 - SWING);
    beatIdx++;
  }
  // 雨滴：随机间隔 60-240ms 一枚（稀疏点缀不盖过音乐）
  while (nextDrop < c.currentTime + SCHEDULE_AHEAD) {
    nextDrop += 0.06 + Math.random() * 0.18;
    raindrop(nextDrop, c);
  }
}

function scheduleBeat(i, t, c) {
  const eighthInBar = i % 8;      // 每小节 8 个八分音符
  const bar = Math.floor(i / 8) % 4;
  const ch = prog[bar];

  // 鼓
  if (eighthInBar === 0 || eighthInBar === 4) kick(t, c);
  if (eighthInBar === 2 || eighthInBar === 6) snare(t, c);
  hat(t, c, eighthInBar % 2 === 1 ? 0.02 : 0.036);

  // 贝斯：1 拍根音、3 拍五度
  if (eighthInBar === 0) bassNote(N[ch.bass], t, c);
  if (eighthInBar === 4) bassNote(N[ch.bass] * 1.5, t, c, 0.7);

  // 和弦：1 拍 + 3 拍半（切分）轻扫
  if (eighthInBar === 0) strum(ch.chord, t, c, 0.05);
  if (eighthInBar === 5) strum(ch.chord, t, c, 0.035);
}

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
  // 6kHz 低通上限：削掉过尖的高频（原 7.5kHz 高通导致刺耳）
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

/** 电钢风和弦轻扫（音符错峰 12ms） */
function strum(chordNotes, t, c, vol) {
  chordNotes.forEach((name, i) => {
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = N[name] * (1 + (Math.random() - 0.5) * 0.0015); // 轻微失谐
    f.type = 'lowpass'; f.frequency.value = 1600;
    const at = t + i * 0.012;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, at + 1.15);
    o.connect(f); f.connect(g); g.connect(musicGain);
    o.start(at); o.stop(at + 1.2);
  });
}

// ===== 雨声氛围层（替代原黑胶噪声：无爆点、频段柔和） =====
function startRain(c) {
  // 中层雨幕：粉噪 + 带通 900Hz
  rainLayer(c, { dur: 2.7, type: 'bandpass', freq: 900, q: 0.6, gain: 0.055 });
  // 低层远雨：粉噪 + 低通 320Hz
  rainLayer(c, { dur: 3.2, type: 'lowpass', freq: 320, q: 0.5, gain: 0.045 });
}

function rainLayer(c, { dur, type, freq, q, gain }) {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  // 粉噪近似（无随机爆点 — 原电流声来源就是这里的 0.25 振幅爆点）
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

/** 单枚雨滴：短促滤波噪点（2-5kHz，音量低于乐器层） */
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
