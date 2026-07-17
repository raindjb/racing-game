// audio/sfx.js — Web Audio 合成音效（无音频文件，全程序化）
let actx = null;
let master = null;
let sfxMuted = false;

export function ac() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain();
    master.gain.value = 0.5;
    master.connect(actx.destination);
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
export function masterNode() { ac(); return master; }
export function isSfxMuted() { return sfxMuted; }
export function toggleSfx() { sfxMuted = !sfxMuted; return sfxMuted; }

/** 单音：freq 可滑向 slideTo */
function tone(freq, { type = 'sine', dur = 0.1, gain = 0.2, ff = 6000, slideTo = 0, delay = 0 } = {}) {
  if (sfxMuted) return;
  try {
    const c = ac(), t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(ff, t);
    o.connect(f); f.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* 音频不可用时静默 */ }
}

/** 噪声扫频（发牌/洗牌/弃牌质感） */
function noise({ dur = 0.15, from = 5000, to = 500, gain = 0.12, type = 'bandpass', delay = 0 } = {}) {
  if (sfxMuted) return;
  try {
    const c = ac(), t = c.currentTime + delay, len = Math.ceil(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type;
    f.frequency.setValueAtTime(from, t);
    f.frequency.linearRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  } catch (e) { /* noop */ }
}

/** 琶音序列 */
function seq(freqs, { step = 0.07, dur = 0.09, gain = 0.16, type = 'square' } = {}) {
  freqs.forEach((f, i) => f && tone(f, { type, dur, gain, delay: i * step }));
}

export const SFX = {
  // 卡牌
  cardDeal()   { noise({ dur: 0.1, from: 3500, to: 900, gain: 0.07 }); },
  cardSelect() { tone(760, { dur: 0.05, gain: 0.1, ff: 7000 }); },
  cardDeselect() { tone(520, { dur: 0.05, gain: 0.08 }); },
  cardPlay()   { tone(170, { type: 'triangle', dur: 0.18, gain: 0.28, ff: 1200 }); noise({ dur: 0.12, from: 4200, to: 700, gain: 0.1, delay: 0.05 }); },
  discard()    { noise({ dur: 0.16, from: 2600, to: 300, gain: 0.11 }); },
  drag()       { noise({ dur: 0.05, from: 2000, to: 1400, gain: 0.04 }); },

  // 结算
  chipTick(i = 0) { tone(500 + i * 60, { type: 'square', dur: 0.05, gain: 0.09, ff: 4500 }); },
  multTick(i = 0) { tone(300 + i * 45, { type: 'sawtooth', dur: 0.06, gain: 0.08, ff: 2500 }); },
  xmult()      { tone(220, { type: 'sawtooth', dur: 0.22, gain: 0.16, ff: 2000, slideTo: 440 }); },
  jokerTrigger() { tone(1180, { dur: 0.07, gain: 0.13, ff: 9000 }); tone(1570, { dur: 0.06, gain: 0.09, delay: 0.05 }); },
  scoreTotal() { seq([523, 659, 784, 1047], { step: 0.06, gain: 0.15 }); },
  bigScore()   { seq([392, 523, 659, 784, 1047, 1319], { step: 0.05, gain: 0.18 }); },
  glassBreak() { noise({ dur: 0.3, from: 8000, to: 2500, gain: 0.2, type: 'highpass' }); tone(2400, { dur: 0.12, gain: 0.08, slideTo: 900 }); },
  seal()       { tone(880, { dur: 0.08, gain: 0.1 }); tone(1174, { dur: 0.08, gain: 0.08, delay: 0.06 }); },

  // 经济/商店
  money()      { seq([784, 988, 1319], { step: 0.05, type: 'triangle', gain: 0.14 }); },
  buy()        { seq([659, 880], { step: 0.06, type: 'triangle', gain: 0.15 }); tone(1319, { dur: 0.06, gain: 0.08, delay: 0.12 }); },
  sell()       { seq([880, 659], { step: 0.06, type: 'triangle', gain: 0.12 }); },
  reroll()     { noise({ dur: 0.12, from: 1500, to: 4000, gain: 0.09 }); tone(660, { dur: 0.05, gain: 0.08, delay: 0.06 }); },
  packOpen()   { noise({ dur: 0.2, from: 600, to: 5200, gain: 0.1 }); seq([523, 784], { step: 0.09, gain: 0.1, type: 'triangle' }); },
  voucher()    { seq([587, 740, 880, 1175], { step: 0.07, type: 'triangle', gain: 0.13 }); },
  tarotUse()   { tone(440, { type: 'sine', dur: 0.35, gain: 0.14, slideTo: 880 }); tone(1760, { dur: 0.2, gain: 0.05, delay: 0.15 }); },
  planetUse()  { tone(330, { type: 'sine', dur: 0.4, gain: 0.14, slideTo: 660 }); seq([1047, 1319], { step: 0.12, gain: 0.06, type: 'sine' }); },

  // 流程
  blindStart() { seq([262, 330, 392], { step: 0.08, type: 'triangle', gain: 0.16 }); },
  bossWarn()   { tone(110, { type: 'sawtooth', dur: 0.5, gain: 0.18, ff: 700 }); tone(104, { type: 'sawtooth', dur: 0.5, gain: 0.12, ff: 600, delay: 0.05 }); },
  roundWin()   { seq([523, 659, 784, 1047, 1319], { step: 0.09, gain: 0.17 }); },
  gameOver()   { seq([392, 330, 262, 196, 131], { step: 0.14, type: 'triangle', gain: 0.2 }); },
  gameWin()    { seq([523, 659, 784, 1047, 784, 1047, 1319, 1568], { step: 0.1, gain: 0.18 }); },
  click()      { tone(600, { dur: 0.04, gain: 0.08 }); },
  reject()     { tone(196, { type: 'square', dur: 0.12, gain: 0.12, ff: 900 }); tone(185, { type: 'square', dur: 0.14, gain: 0.1, ff: 800, delay: 0.1 }); },
};
