// === audio.js — Racing Game ===
// Sound system using Web Audio API. All sounds procedurally generated (no external files).
// Exports: R.initAudio, R.playSound, R.updateAudio, R.stopAllSounds, R.setMasterVolume, R.toggleMute

// ---------------------------------------------------------------------------
// Internal module state (closure-scoped, not on R)
// ---------------------------------------------------------------------------

/** @type {AudioContext|null} */
let _ctx = null;

/** @type {GainNode|null} — master gain, connected to destination */
let _masterGain = null;

/** @type {boolean} */
let _muted = false;

/** @type {number} — saved volume level before muting, so toggleMute can restore */
let _preMuteVolume = 0.7;

/** @type {boolean} — true once initAudio succeeds; guards against operations on dead context */
let _initialized = false;

// ---- Oscillator pool (reuse for one-shot sounds) ----
/** @type {OscillatorNode[]} */
let _oscPool = [];
const _MAX_OSC_POOL = 16;       // pre-allocate this many oscillators

/** @type {GainNode[]} */
let _gainPool = [];
const _MAX_GAIN_POOL = 16;

// ---- Active continuous-sound references ----
/** @type {{ osc1: OscillatorNode, osc2: OscillatorNode, gain: GainNode, filter: BiquadFilterNode }|null} */
let _engineNodes = null;

/** @type {{ gain: GainNode, filter: BiquadFilterNode, noiseGen: (() => AudioBufferSourceNode)|null }|null} */
let _skidNodes = null;

/** @type {Set<AudioNode>} — all one-shot oscillators currently playing */
let _activeOneShots = new Set();

// ---- Reusable noise buffer (generated once, used for crash + skid) ----
/** @type {AudioBuffer|null} */
let _noiseBuffer = null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely retrieve a config value with a fallback default.
 * @param {string} key - Config key (e.g. 'VOLUME_MASTER')
 * @param {number} fallback
 * @returns {number}
 */
function _cfg(key, fallback) {
  return (R.CONFIG && typeof R.CONFIG[key] === 'number') ? R.CONFIG[key] : fallback;
}

/**
 * Ensure default config values exist on R.CONFIG.
 * Only sets values that are absent — never overwrites user config.
 */
function _ensureConfigDefaults() {
  if (!R.CONFIG) R.CONFIG = {};
  const defaults = {
    VOLUME_MASTER:   0.7,
    VOLUME_SFX:      0.6,
    VOLUME_ENGINE:   0.25,
    VOLUME_SKID:     0.35,
    ENGINE_FREQ_MIN: 80,
    ENGINE_FREQ_MAX: 400,
    ENGINE_DETUNE:   6,        // cents detune between two engine oscillators
    SKID_FREQ_MIN:   200,
    SKID_FREQ_MAX:   2000,
    COUNTDOWN_BEEP_FREQ: 440,
    COUNTDOWN_GO_FREQ:    880,
    COUNTDOWN_BEEP_DUR:   0.1,
    COUNTDOWN_GO_DUR:     0.3,
    COUNTDOWN_INTERVAL:   0.6,  // seconds between beeps
    MENU_SELECT_FREQ: 1000,
    MENU_SELECT_DUR:  0.03,
    CRASH_DURATION:   0.3,
    CRASH_CENTER_FREQ: 800,
    CRASH_BANDWIDTH:   600,
    FINISH_START_FREQ: 200,
    FINISH_END_FREQ:   800,
    FINISH_DURATION:   1.0,
    FINISH_DELAY_TIME: 0.15,
    FINISH_DELAY_FEEDBACK: 0.35
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (R.CONFIG[k] === undefined) R.CONFIG[k] = v;
  }
}

/**
 * Create a stereo white-noise buffer (2 seconds, single-channel is fine — we use mono).
 * Generated once and cached in _noiseBuffer.
 * @returns {AudioBuffer|null}
 */
function _getNoiseBuffer() {
  if (_noiseBuffer) return _noiseBuffer;
  if (!_ctx) return null;
  try {
    const sampleRate = _ctx.sampleRate;
    const length = sampleRate * 2; // 2 seconds of noise
    const buffer = _ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    _noiseBuffer = buffer;
    return buffer;
  } catch (e) {
    return null;
  }
}

/**
 * Acquire an oscillator from the pool or create a new one.
 * Returns null if AudioContext is unavailable.
 * @returns {OscillatorNode|null}
 */
function _acquireOsc() {
  if (!_ctx) return null;
  if (_oscPool.length > 0) return _oscPool.pop();
  try { return _ctx.createOscillator(); } catch (e) { return null; }
}

/**
 * Acquire a gain node from the pool or create new.
 * @returns {GainNode|null}
 */
function _acquireGain() {
  if (!_ctx) return null;
  if (_gainPool.length > 0) return _gainPool.pop();
  try { return _ctx.createGain(); } catch (e) { return null; }
}

/**
 * Return an oscillator to the pool for reuse.
 * @param {OscillatorNode} osc
 */
function _releaseOsc(osc) {
  if (!osc) return;
  try { osc.disconnect(); } catch (e) { /* already disconnected */ }
  _activeOneShots.delete(osc);
  if (_oscPool.length < _MAX_OSC_POOL) _oscPool.push(osc);
}

/**
 * Return a gain node to the pool.
 * @param {GainNode} gain
 */
function _releaseGain(gain) {
  if (!gain) return;
  try { gain.disconnect(); } catch (e) { /* ignore */ }
  if (_gainPool.length < _MAX_GAIN_POOL) _gainPool.push(gain);
}

/**
 * Schedule a gain ramp to 0 and auto-cleanup after `duration` seconds.
 * @param {GainNode} gain
 * @param {number} startValue
 * @param {number} duration - seconds from now until silent
 * @param {OscillatorNode} [osc] - if provided, stop + release after fade
 * @param {AudioBufferSourceNode} [src] - if provided, stop + disconnect after fade
 */
function _scheduleFadeOut(gain, startValue, duration, osc, src) {
  if (!gain || !_ctx) return;
  const now = _ctx.currentTime;
  try {
    gain.gain.setValueAtTime(startValue, now);
    gain.gain.linearRampToValueAtTime(0, now + duration + 0.01);
  } catch (e) { /* ignore */ }

  const cleanupTime = now + duration + 0.05;
  if (osc) {
    try { osc.stop(cleanupTime); } catch (e) { /* already stopped */ }
    setTimeout(() => _releaseOsc(osc), (cleanupTime - _ctx.currentTime) * 1000 + 100);
  }
  if (src) {
    try { src.stop(cleanupTime); } catch (e) { /* already stopped */ }
    setTimeout(() => { try { src.disconnect(); } catch (e) { /* ignore */ } }, (cleanupTime - _ctx.currentTime) * 1000 + 100);
  }
}

/**
 * Small helper: schedule a precise beep.
 * @param {number} freq - Hz
 * @param {number} startTime - AudioContext time
 * @param {number} duration - seconds
 * @param {number} volume - gain 0-1
 */
function _scheduleBeep(freq, startTime, duration, volume) {
  if (!_ctx || !_masterGain) return;
  const osc = _acquireOsc();
  const g = _acquireGain();
  if (!osc || !g) return;

  try {
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, startTime);
  } catch (e) { _releaseOsc(osc); _releaseGain(g); return; }

  try { g.gain.setValueAtTime(0, startTime); } catch (e) { /* ignore */ }
  try { g.gain.linearRampToValueAtTime(volume, startTime + 0.005); } catch (e) { /* ignore */ }
  try { g.gain.setValueAtTime(volume, startTime + duration * 0.7); } catch (e) { /* ignore */ }
  try { g.gain.linearRampToValueAtTime(0, startTime + duration + 0.01); } catch (e) { /* ignore */ }

  try { osc.connect(g); } catch (e) { _releaseOsc(osc); _releaseGain(g); return; }
  try { g.connect(_masterGain); } catch (e) { _releaseOsc(osc); _releaseGain(g); return; }

  _activeOneShots.add(osc);
  try { osc.start(startTime); } catch (e) { /* ignore */ }
  try { osc.stop(startTime + duration + 0.02); } catch (e) { /* ignore */ }

  // Cleanup after the note ends
  const cleanupDelay = (duration + 0.1) * 1000;
  setTimeout(() => {
    _releaseOsc(osc);
    _releaseGain(g);
  }, cleanupDelay);
}

// ===================================================================
// PUBLIC API — attached to window.R
// ===================================================================

/**
 * Initialize the audio system. Must be called once, typically after a user
 * gesture (click / tap / keypress) so the browser allows AudioContext creation.
 *
 * On failure (e.g. browser blocks autoplay), all R.playSound calls become
 * no-ops and the game continues silently.
 */
R.initAudio = function () {
  if (_initialized) return;

  _ensureConfigDefaults();

  try {
    // Some browsers use webkitAudioContext
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      console.warn('[audio] Web Audio API not available in this browser.');
      return;
    }
    _ctx = new AudioCtx();
  } catch (e) {
    console.warn('[audio] Failed to create AudioContext:', e.message);
    _ctx = null;
    return;
  }

  try {
    _masterGain = _ctx.createGain();
    _masterGain.gain.value = _cfg('VOLUME_MASTER', 0.7);
    _masterGain.connect(_ctx.destination);
  } catch (e) {
    console.warn('[audio] Failed to create master gain:', e.message);
    _ctx = null;
    _masterGain = null;
    return;
  }

  // Pre-fill oscillator and gain pools
  for (let i = 0; i < _MAX_OSC_POOL; i++) {
    try {
      const osc = _ctx.createOscillator();
      _oscPool.push(osc);
    } catch (e) { break; }
  }
  for (let i = 0; i < _MAX_GAIN_POOL; i++) {
    try {
      const g = _ctx.createGain();
      _gainPool.push(g);
    } catch (e) { break; }
  }

  // Generate the noise buffer eagerly
  _getNoiseBuffer();

  _initialized = true;
  console.log('[audio] Audio system initialized. Sample rate:', _ctx.sampleRate, 'Hz');
};

/**
 * Play a procedural sound effect.
 *
 * @param {string} type - One of: 'engine', 'crash', 'skid', 'countdown', 'go',
 *   'finish', 'menu_select'
 * @param {Object} [params={}] - Type-specific parameters:
 *   - crash: { intensity: 0..1 }
 *   - engine: { speed: number, maxSpeed: number }
 */
R.playSound = function (type, params) {
  if (!_initialized || !_ctx || !_masterGain) return;
  if (_muted) return; // Respect mute state

  params = params || {};

  switch (type) {

    // ------------------------------------------------------------------
    // ENGINE — continuous rumble, started once and updated per frame
    // ------------------------------------------------------------------
    case 'engine':
      {
        if (_engineNodes) return; // Already running
        const vol = _cfg('VOLUME_ENGINE', 0.25);

        // Low-pass filter for muffled engine character
        let filter;
        try { filter = _ctx.createBiquadFilter(); } catch (e) { return; }
        filter.type = 'lowpass';
        filter.frequency.value = 300;
        filter.Q.value = 1;

        // Two detuned oscillators for richness
        const osc1 = _acquireOsc();
        const osc2 = _acquireOsc();
        const gain = _acquireGain();
        if (!osc1 || !osc2 || !gain) {
          _releaseOsc(osc1); _releaseOsc(osc2); _releaseGain(gain);
          return;
        }

        const detuneCents = _cfg('ENGINE_DETUNE', 6);
        const freqMin = _cfg('ENGINE_FREQ_MIN', 80);

        try {
          osc1.type = 'sawtooth';
          osc2.type = 'sawtooth';
          osc1.frequency.value = freqMin;
          osc2.frequency.value = freqMin;
          osc1.detune.value = -detuneCents;
          osc2.detune.value = detuneCents;

          gain.gain.value = 0; // Start silent, fade in

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(filter);
          filter.connect(_masterGain);

          osc1.start();
          osc2.start();
        } catch (e) {
          _releaseOsc(osc1); _releaseOsc(osc2); _releaseGain(gain);
          return;
        }

        // Fade engine in over 0.3s to avoid pop
        try {
          const now = _ctx.currentTime;
          gain.gain.linearRampToValueAtTime(vol, now + 0.3);
        } catch (e) { /* ignore */ }

        _engineNodes = { osc1, osc2, gain, filter };
      }
      break;

    // ------------------------------------------------------------------
    // CRASH — short noise burst
    // ------------------------------------------------------------------
    case 'crash':
      {
        const intensity = Math.max(0, Math.min(1, params.intensity || 0.5));
        const vol = _cfg('VOLUME_SFX', 0.6) * (0.4 + intensity * 0.6);
        const duration = _cfg('CRASH_DURATION', 0.3);

        const noiseBuf = _getNoiseBuffer();
        if (!noiseBuf) return;

        let src, bandpass, gain;
        try {
          src = _ctx.createBufferSource();
          bandpass = _ctx.createBiquadFilter();
          gain = _acquireGain();
          if (!gain) { src = null; throw new Error('no gain'); }
        } catch (e) { return; }

        src.buffer = noiseBuf;
        src.loop = false;

        bandpass.type = 'bandpass';
        bandpass.frequency.value = _cfg('CRASH_CENTER_FREQ', 800);
        bandpass.Q.value = bandpass.frequency.value / _cfg('CRASH_BANDWIDTH', 600);

        try {
          src.connect(bandpass);
          bandpass.connect(gain);
          gain.connect(_masterGain);
        } catch (e) {
          try { src.disconnect(); } catch (ex) { /* ignore */ }
          _releaseGain(gain);
          return;
        }

        _scheduleFadeOut(gain, vol, duration, null, src);
        try { src.start(); } catch (e) { /* ignore */ }

        // Auto-cleanup
        setTimeout(() => {
          try { bandpass.disconnect(); } catch (e) { /* ignore */ }
          _releaseGain(gain);
        }, (duration + 0.2) * 1000);
      }
      break;

    // ------------------------------------------------------------------
    // SKID — continuous noise, started when drifting
    // ------------------------------------------------------------------
    case 'skid':
      {
        if (_skidNodes) return; // Already skidding
        const vol = _cfg('VOLUME_SKID', 0.35);

        const noiseBuf = _getNoiseBuffer();
        if (!noiseBuf) return;

        let src, filter, gain;
        try {
          src = _ctx.createBufferSource();
          filter = _ctx.createBiquadFilter();
          gain = _acquireGain();
          if (!gain) { src = null; throw new Error('no gain'); }
        } catch (e) { return; }

        src.buffer = noiseBuf;
        src.loop = true;

        filter.type = 'bandpass';
        filter.frequency.value = _cfg('SKID_FREQ_MIN', 200);
        filter.Q.value = 1.5;

        try {
          gain.gain.value = 0;
          src.connect(filter);
          filter.connect(gain);
          gain.connect(_masterGain);
        } catch (e) {
          try { src.disconnect(); } catch (ex) { /* ignore */ }
          _releaseGain(gain);
          return;
        }

        // Fade in
        try {
          const now = _ctx.currentTime;
          gain.gain.linearRampToValueAtTime(vol, now + 0.15);
        } catch (e) { /* ignore */ }

        try { src.start(); } catch (e) { /* ignore */ }

        _skidNodes = { gain, filter, noiseGen: null }; // noiseGen unused but kept for shape
      }
      break;

    // ------------------------------------------------------------------
    // COUNTDOWN — three low beeps then one high "GO!" beep
    // ------------------------------------------------------------------
    case 'countdown':
      {
        const beepFreq = _cfg('COUNTDOWN_BEEP_FREQ', 440);
        const goFreq = _cfg('COUNTDOWN_GO_FREQ', 880);
        const beepDur = _cfg('COUNTDOWN_BEEP_DUR', 0.1);
        const interval = _cfg('COUNTDOWN_INTERVAL', 0.6);
        const sfxVol = _cfg('VOLUME_SFX', 0.6);
        const now = _ctx.currentTime;

        // 3… 2… 1…
        for (let i = 0; i < 3; i++) {
          _scheduleBeep(beepFreq, now + i * interval, beepDur, sfxVol);
        }
        // GO! — also handled separately via 'go' sound, but include here for completeness
        // (The 'go' sound type below handles the higher-pitched final beep.)
      }
      break;

    // ------------------------------------------------------------------
    // GO — the higher-pitched final countdown beep
    // ------------------------------------------------------------------
    case 'go':
      {
        const goFreq = _cfg('COUNTDOWN_GO_FREQ', 880);
        const goDur = _cfg('COUNTDOWN_GO_DUR', 0.3);
        const sfxVol = _cfg('VOLUME_SFX', 0.6);
        const now = _ctx.currentTime;
        _scheduleBeep(goFreq, now, goDur, sfxVol * 1.1);
      }
      break;

    // ------------------------------------------------------------------
    // FINISH — ascending sweep with delay (reverb-like)
    // ------------------------------------------------------------------
    case 'finish':
      {
        const startFreq = _cfg('FINISH_START_FREQ', 200);
        const endFreq = _cfg('FINISH_END_FREQ', 800);
        const duration = _cfg('FINISH_DURATION', 1.0);
        const delayTime = _cfg('FINISH_DELAY_TIME', 0.15);
        const delayFeedback = _cfg('FINISH_DELAY_FEEDBACK', 0.35);
        const sfxVol = _cfg('VOLUME_SFX', 0.6);

        const osc = _acquireOsc();
        const gain = _acquireGain();
        const delay = _ctx.createDelay(2.0);
        const feedbackGain = _acquireGain();
        const dryGain = _acquireGain();
        if (!osc || !gain || !delay || !feedbackGain || !dryGain) {
          _releaseOsc(osc); _releaseGain(gain); _releaseGain(feedbackGain); _releaseGain(dryGain);
          return;
        }

        try {
          // Delay setup with feedback
          delay.delayTime.value = delayTime;
          feedbackGain.gain.value = delayFeedback;

          // Dry/wet mix: dry at full vol, wet (delayed) at ~60%
          dryGain.gain.value = 1.0;
          const wetGain = _acquireGain();
          if (wetGain) { try { wetGain.gain.value = 0.6; } catch (e) { /* ignore */ } }

          osc.type = 'sine';
          const now = _ctx.currentTime;
          osc.frequency.setValueAtTime(startFreq, now);
          osc.frequency.linearRampToValueAtTime(endFreq, now + duration);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(sfxVol, now + 0.05);
          gain.gain.setValueAtTime(sfxVol, now + duration * 0.6);
          gain.gain.linearRampToValueAtTime(0, now + duration + 0.05);

          // Routing: osc → gain → dryGain → masterGain
          //                   → delay → feedbackGain → delay (feedback)
          //                   → delay → wetGain → masterGain
          osc.connect(gain);

          // Dry path
          gain.connect(dryGain);
          dryGain.connect(_masterGain);

          // Delay path
          gain.connect(delay);
          delay.connect(feedbackGain);
          feedbackGain.connect(delay); // feedback loop
          if (wetGain) {
            delay.connect(wetGain);
            wetGain.connect(_masterGain);
          }

          _activeOneShots.add(osc);
          osc.start(now);
          osc.stop(now + duration + 0.1);
        } catch (e) {
          _releaseOsc(osc); _releaseGain(gain); _releaseGain(feedbackGain); _releaseGain(dryGain);
          return;
        }

        // Cleanup after sound finishes + reverb tail
        const cleanupMs = (duration + delayTime * 4 + 0.5) * 1000;
        setTimeout(() => {
          _releaseOsc(osc);
          _releaseGain(gain);
          _releaseGain(feedbackGain);
          _releaseGain(dryGain);
          try { delay.disconnect(); } catch (e) { /* ignore */ }
        }, cleanupMs);
      }
      break;

    // ------------------------------------------------------------------
    // MENU_SELECT — short click
    // ------------------------------------------------------------------
    case 'menu_select':
      {
        const freq = _cfg('MENU_SELECT_FREQ', 1000);
        const dur = _cfg('MENU_SELECT_DUR', 0.03);
        const sfxVol = _cfg('VOLUME_SFX', 0.6);
        const now = _ctx.currentTime;

        const osc = _acquireOsc();
        const gain = _acquireGain();
        if (!osc || !gain) { _releaseOsc(osc); _releaseGain(gain); return; }

        try {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(sfxVol * 0.5, now + 0.002);
          gain.gain.linearRampToValueAtTime(0, now + dur);

          osc.connect(gain);
          gain.connect(_masterGain);

          _activeOneShots.add(osc);
          osc.start(now);
          osc.stop(now + dur + 0.01);
        } catch (e) {
          /* cleanup handled below */
        }

        setTimeout(() => {
          _releaseOsc(osc);
          _releaseGain(gain);
        }, (dur + 0.1) * 1000);
      }
      break;

    default:
      // Unknown sound type — silently ignored
      break;
  }
};

// ===================================================================
// CONTINUOUS SOUND UPDATE — called every frame by the game loop
// ===================================================================

/**
 * Update continuous sounds (engine pitch, skid filter). Called each frame with
 * the delta time in seconds. Reads current car state from R.playerCar (or the
 * first car in R.cars if that convention is used).
 *
 * @param {number} dt - Delta time in seconds
 */
R.updateAudio = function (dt) {
  if (!_initialized || !_ctx || !_masterGain) return;
  if (_muted && _engineNodes) {
    // Keep engine silent while muted but don't tear it down
    return;
  }

  const now = _ctx.currentTime;

  // ---- Engine sound update ----
  if (_engineNodes) {
    const en = _engineNodes;
    const car = (R.playerCar) || (R.cars && R.cars[0]) || null;

    let speed = 0;
    let maxSpeed = 300; // fallback
    if (car && typeof car.speed === 'number') {
      speed = Math.abs(car.speed);
      maxSpeed = (typeof car.maxSpeed === 'number' && car.maxSpeed > 0) ? car.maxSpeed : 300;
    }

    // Clamp speed ratio
    const ratio = Math.max(0, Math.min(1, speed / maxSpeed));
    const freqMin = _cfg('ENGINE_FREQ_MIN', 80);
    const freqMax = _cfg('ENGINE_FREQ_MAX', 400);
    const targetFreq = freqMin + ratio * (freqMax - freqMin);

    // Smooth frequency transition to avoid pops (exponential smoothing)
    try {
      // Ramp over a short window rather than instantaneous set
      en.osc1.frequency.linearRampToValueAtTime(targetFreq, now + 0.05);
      en.osc2.frequency.linearRampToValueAtTime(targetFreq, now + 0.05);

      // Adjust filter cutoff: higher speed = more open filter
      const filterFreq = 150 + ratio * 350;
      en.filter.frequency.linearRampToValueAtTime(filterFreq, now + 0.05);
    } catch (e) { /* ignore — oscillators may have been stopped */ }
  }

  // ---- Skid sound update ----
  if (_skidNodes) {
    const sk = _skidNodes;
    const car = (R.playerCar) || (R.cars && R.cars[0]) || null;

    let driftMag = 0;
    if (car && typeof car.driftFactor === 'number') {
      driftMag = Math.abs(car.driftFactor);
    }

    // If drift is negligible, stop skid sound
    if (driftMag < 0.05) {
      // Fade out and tear down
      try {
        sk.gain.gain.linearRampToValueAtTime(0, now + 0.1);
      } catch (e) { /* ignore */ }
      setTimeout(() => {
        if (_skidNodes === sk) {
          _stopSkidInternal();
        }
      }, 150);
      _skidNodes = null;
      return;
    }

    // Sweep bandpass filter based on drift magnitude
    const skidFreqMin = _cfg('SKID_FREQ_MIN', 200);
    const skidFreqMax = _cfg('SKID_FREQ_MAX', 2000);
    const targetFilterFreq = skidFreqMin + driftMag * (skidFreqMax - skidFreqMin);
    const targetVol = _cfg('VOLUME_SKID', 0.35) * (0.3 + driftMag * 0.7);

    try {
      sk.filter.frequency.linearRampToValueAtTime(targetFilterFreq, now + 0.05);
      sk.gain.gain.linearRampToValueAtTime(targetVol, now + 0.05);
    } catch (e) { /* ignore */ }
  }
};

// ===================================================================
// SOUND LIFECYCLE
// ===================================================================

/**
 * Internal: tear down the engine sound nodes.
 */
function _stopEngineInternal() {
  if (!_engineNodes) return;
  const en = _engineNodes;
  try {
    const now = _ctx ? _ctx.currentTime : 0;
    if (en.gain && now > 0) {
      en.gain.gain.linearRampToValueAtTime(0, now + 0.05);
    }
  } catch (e) { /* ignore */ }

  // Schedule actual disconnect after the ramp
  setTimeout(() => {
    try { en.osc1.stop(); } catch (e) { /* ignore */ }
    try { en.osc2.stop(); } catch (e) { /* ignore */ }
    _releaseOsc(en.osc1);
    _releaseOsc(en.osc2);
    _releaseGain(en.gain);
    try { en.filter.disconnect(); } catch (e) { /* ignore */ }
  }, 100);

  _engineNodes = null;
}

/**
 * Internal: tear down the skid sound nodes.
 */
function _stopSkidInternal() {
  if (!_skidNodes) return;
  const sk = _skidNodes;
  try { sk.gain.gain.value = 0; } catch (e) { /* ignore */ }
  setTimeout(() => {
    _releaseGain(sk.gain);
    try { sk.filter.disconnect(); } catch (e) { /* ignore */ }
  }, 100);
  _skidNodes = null;
}

/**
 * Stop all active continuous and one-shot sounds immediately.
 * Called when leaving a race or resetting state.
 */
R.stopAllSounds = function () {
  if (!_initialized || !_ctx) return;

  // Tear down engine
  _stopEngineInternal();

  // Tear down skid
  _stopSkidInternal();

  // Stop all active one-shot oscillators
  const now = _ctx.currentTime;
  for (const osc of _activeOneShots) {
    try {
      // Quick fade to avoid click
      osc.stop(now + 0.01);
    } catch (e) { /* already stopped */ }
    try { osc.disconnect(); } catch (e) { /* ignore */ }
  }
  _activeOneShots.clear();
};

// ===================================================================
// VOLUME CONTROL
// ===================================================================

/**
 * Set the master volume level.
 * @param {number} v - Volume 0..1 (clamped internally)
 */
R.setMasterVolume = function (v) {
  const clamped = Math.max(0, Math.min(1, v));
  if (_masterGain) {
    try {
      const now = _ctx ? _ctx.currentTime : 0;
      _masterGain.gain.linearRampToValueAtTime(clamped, now + 0.02);
    } catch (e) {
      try { _masterGain.gain.value = clamped; } catch (e2) { /* ignore */ }
    }
  }
  // Sync config
  if (R.CONFIG) R.CONFIG.VOLUME_MASTER = clamped;
  if (!_muted) _preMuteVolume = clamped;
};

/**
 * Toggle mute on/off. Restores previous volume when unmuting.
 */
R.toggleMute = function () {
  _muted = !_muted;

  if (_muted) {
    // Save current volume, then set gain to 0
    if (_masterGain) {
      try {
        _preMuteVolume = _masterGain.gain.value;
        _masterGain.gain.value = 0;
      } catch (e) { /* ignore */ }
    }
  } else {
    // Restore
    if (_masterGain) {
      try {
        _masterGain.gain.linearRampToValueAtTime(_preMuteVolume, (_ctx ? _ctx.currentTime : 0) + 0.02);
      } catch (e) {
        try { _masterGain.gain.value = _preMuteVolume; } catch (e2) { /* ignore */ }
      }
    }
  }
};

// ===================================================================
// LIFECYCLE — resume AudioContext after browser suspension
// ===================================================================

/**
 * Resume the AudioContext if it was suspended (e.g. browser autoplay policy).
 * Should be called on the first user gesture (click/touch/keypress).
 * Safe to call multiple times.
 */
R.resumeAudio = function () {
  if (_ctx && _ctx.state === 'suspended') {
    _ctx.resume().catch(function (e) {
      console.warn('[audio] Failed to resume AudioContext:', e.message);
    });
  }
};

// ===================================================================
// EXPORTED: R.initAudio, R.playSound, R.updateAudio, R.stopAllSounds,
//           R.setMasterVolume, R.toggleMute, R.resumeAudio
// ===================================================================
