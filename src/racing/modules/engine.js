// === engine.js — Racing Game ===
// Main game loop, state machine, canvas bootstrap, camera, and math utilities.
// Attaches all exports to window.R.

window.R = window.R || {};

// ---------------------------------------------------------------------------
// Default engine constants (extend R.CONFIG if not already set)
// ---------------------------------------------------------------------------
R.CONFIG = R.CONFIG || {};
R.CONFIG.CANVAS_WIDTH        = R.CONFIG.CANVAS_WIDTH        || 1280;
R.CONFIG.CANVAS_HEIGHT       = R.CONFIG.CANVAS_HEIGHT       || 720;
R.CONFIG.MAX_DT              = R.CONFIG.MAX_DT              || 33;     // ms cap — spiral-of-death protection
R.CONFIG.CAMERA_SMOOTH       = R.CONFIG.CAMERA_SMOOTH       || 0.08;   // lerp factor per frame
R.CONFIG.CAMERA_OFFSET_Y     = R.CONFIG.CAMERA_OFFSET_Y     || -80;    // vertical screen offset from player
R.CONFIG.FINISH_DELAY        = R.CONFIG.FINISH_DELAY        || 5;      // seconds before restart allowed
R.CONFIG.COUNTDOWN_DURATION  = R.CONFIG.COUNTDOWN_DURATION  || 3;      // seconds

// ---------------------------------------------------------------------------
// Object pools / shared arrays — pre-allocated, no allocations in hot path
// ---------------------------------------------------------------------------
R.aiCars          = [];
R.particles       = [];
R.sceneryObjects  = [];

// ---------------------------------------------------------------------------
// Internal helpers (not exported on R)
// ---------------------------------------------------------------------------

/**
 * Safely invoke a zero-argument function on R if it exists; otherwise no-op.
 * Allows the engine to boot even when optional module files are missing.
 * @param {string} fnName Property name on R
 */
function _callIfExists(fnName) {
  if (typeof R[fnName] === 'function') {
    R[fnName]();
  }
}

// ---------------------------------------------------------------------------
// Built-in keyboard fallback — guarantees R.input._keys exists even if the
// input module is not loaded.  initInput() may override/extend this.
// ---------------------------------------------------------------------------

function _attachBuiltinInput() {
  if (R._inputAttached) return;
  R._inputAttached = true;

  R.input = R.input || { throttle: 0, brake: 0, steer: 0, boost: 0, _keys: {} };

  window.addEventListener('keydown', function (e) {
    if(!R.input._keys)R.input._keys={}; R.input._keys[e.code] = true;
    // Prevent default for game keys so the page doesn't scroll
    if (e.code === 'ArrowUp'   || e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' || e.code === 'ArrowRight' ||
        e.code === 'Space'     || e.code === 'Enter') {
      e.preventDefault();
    }
    // Map arrows directly to driving inputs
    if (e.code === 'ArrowUp')    { R.input.throttle = 1; }
    if (e.code === 'ArrowDown')  { R.input.brake    = 1; }
    if (e.code === 'ArrowLeft')  { R.input.steer    = -1; }
    if (e.code === 'ArrowRight') { R.input.steer    =  1; }
  });

  window.addEventListener('keyup', function (e) {
    if(!R.input._keys)R.input._keys={}; R.input._keys[e.code] = false;
    if (e.code === 'ArrowUp')    { R.input.throttle = 0; }
    if (e.code === 'ArrowDown')  { R.input.brake    = 0; }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { R.input.steer = 0; }
  });
}

// ---------------------------------------------------------------------------
// R.init() — Bootstrap the entire game
// ---------------------------------------------------------------------------

/**
 * Create the canvas element (1280×720), append to document.body, get 2d
 * context, initialise all subsystems, and start the game loop.
 *
 * Safe to call multiple times — subsequent calls are ignored.
 *
 * Usage:
 *   window.addEventListener('DOMContentLoaded', function () { R.init(); });
 */
R.init = function () {
  if (R._initialised) return;
  R._initialised = true;

  // --- canvas element ---------------------------------------------------
  var canvas = document.createElement('canvas');
  canvas.id            = 'gameCanvas';
  canvas.width         = R.CONFIG.CANVAS_WIDTH;
  canvas.height        = R.CONFIG.CANVAS_HEIGHT;
  canvas.style.display     = 'block';
  canvas.style.margin      = '0 auto';
  canvas.style.background  = '#000';
  canvas.style.maxWidth    = '100%';
  canvas.style.maxHeight   = '100vh';
  canvas.style.touchAction = 'manipulation';

  document.body.style.margin          = '0';
  document.body.style.overflow        = 'hidden';
  document.body.style.backgroundColor = '#111';
  document.body.style.display         = 'flex';
  document.body.style.alignItems      = 'center';
  document.body.style.justifyContent  = 'center';
  document.body.style.minHeight       = '100vh';
  document.body.appendChild(canvas);

  R.canvas = canvas;
  R.ctx    = canvas.getContext('2d');

  // --- game state -------------------------------------------------------
  R.state = {
    phase:           'menu',          // 'menu' | 'countdown' | 'racing' | 'finished'
    time:            0,               // wall-clock elapsed seconds
    countdownTimer:  R.CONFIG.COUNTDOWN_DURATION,
    raceTime:        0,               // seconds since race start
    bestLap:         Infinity,
    finishTimer:     0,
    playerLap:       0,
    playerFinished:  false
  };

  // --- camera -----------------------------------------------------------
  R.camera = R.camera || { x: 0, y: 0, zoom: 1 };

  // --- built-in keyboard support ----------------------------------------
  _attachBuiltinInput();

  // --- bootstrap subsystems (each call is a no-op if the module is not loaded)
  _callIfExists('initInput');
  _callIfExists('initAudio');
  _callIfExists('initTrack');
  _callIfExists('initPlayer');
  _callIfExists('initAI');
  _callIfExists('initHUD');
  _callIfExists('initEffects');
  _callIfExists('initScenery');

  // --- responsive canvas scaling ----------------------------------------
  window.addEventListener('resize', _onResize);
  _onResize();

  // --- launch -----------------------------------------------------------
  R._lastTimestamp = undefined;
  requestAnimationFrame(R.loop);
};

/**
 * Scale the canvas CSS size to fit the viewport while keeping the internal
 * resolution fixed at CANVAS_WIDTH × CANVAS_HEIGHT.
 */
function _onResize() {
  var c = R.canvas;
  if (!c) return;
  var ratio = R.CONFIG.CANVAS_WIDTH / R.CONFIG.CANVAS_HEIGHT;
  var w, h;
  if (window.innerWidth / window.innerHeight > ratio) {
    h = window.innerHeight;
    w = h * ratio;
  } else {
    w = window.innerWidth;
    h = w / ratio;
  }
  c.style.width  = Math.floor(w) + 'px';
  c.style.height = Math.floor(h) + 'px';
}

// ---------------------------------------------------------------------------
// R.loop(timestamp) — Main game loop
// ---------------------------------------------------------------------------

/**
 * Called every frame via requestAnimationFrame.
 * Calculates dt (capped at MAX_DT ms), runs all update and render passes,
 * then re-queues itself for the next frame.
 *
 * @param {DOMHighResTimeStamp} timestamp RAF timestamp in ms
 */
R.loop = function (timestamp) {
  // --- delta-time with spiral-of-death protection -----------------------
  if (R._lastTimestamp === undefined) {
    R._lastTimestamp = timestamp;
  }
  var rawDt = timestamp - R._lastTimestamp;
  R._lastTimestamp = timestamp;
  var dt = Math.min(rawDt, R.CONFIG.MAX_DT) / 1000; // ms → seconds

  // --- update phase -----------------------------------------------------
  _callIfExists('updateInput');

  R.updateStateMachine(dt);

  var racing = R.state.phase === 'racing';

  if (racing) {
    if (typeof R.updatePlayer === 'function') { R.updatePlayer(dt); }
    if (typeof R.updateAI === 'function')     { R.updateAI(dt); }
  }

  if (typeof R.updateCamera === 'function')  { R.updateCamera(dt); }
  if (typeof R.updateEffects === 'function') { R.updateEffects(dt); }
  if (typeof R.updateHUD === 'function')     { R.updateHUD(dt); }

  // --- render phase -----------------------------------------------------
  R.render();

  // --- schedule next frame ----------------------------------------------
  requestAnimationFrame(R.loop);
};

// ---------------------------------------------------------------------------
// R.updateStateMachine(dt) — Phase transitions
// ---------------------------------------------------------------------------

/**
 * Advances the game state machine one tick.
 *
 *   'menu'      — wait for Enter/Space → countdown
 *   'countdown' — tick down to 0 → racing
 *   'racing'    — raceTime increments; when playerFinished → finished
 *   'finished'  — hold FINISH_DELAY seconds, then Enter/Space → menu
 *
 * @param {number} dt Delta-time in seconds
 */
R.updateStateMachine = function (dt) {
  var input = R.input;
  var state = R.state;
  if (!input || !state) return;

  switch (state.phase) {

    // ---- menu ----------------------------------------------------------
    case 'menu':
      if (input._keys && (input._keys['Enter'] || input._keys[' '] || input._keys['Space'])) {
        state.phase          = 'countdown';
        state.countdownTimer = R.CONFIG.COUNTDOWN_DURATION;
        state.raceTime       = 0;
        state.playerLap      = 0;
        state.playerFinished = false;
        state.bestLap        = Infinity;
        // Consume keys so a held key doesn't skip the countdown
        input._keys['Enter'] = false;
        input._keys[' ']     = false;
        input._keys['Space'] = false;
      }
      break;

    // ---- countdown -----------------------------------------------------
    case 'countdown':
      state.countdownTimer -= dt;
      if (state.countdownTimer <= 0) {
        state.countdownTimer = 0;
        state.phase          = 'racing';
        state.raceTime       = 0;
        state.playerLap      = 0;
        state.playerFinished = false;
        state.bestLap        = Infinity;
      }
      break;

    // ---- racing --------------------------------------------------------
    case 'racing':
      state.raceTime += dt;

      // Check finish condition
      if (state.playerFinished) {
        state.phase       = 'finished';
        state.finishTimer = 0;
      }
      break;

    // ---- finished ------------------------------------------------------
    case 'finished':
      state.finishTimer += dt;
      if (state.finishTimer >= R.CONFIG.FINISH_DELAY) {
        if (input._keys && (input._keys['Enter'] || input._keys[' '] || input._keys['Space'])) {
          state.phase          = 'menu';
          state.finishTimer    = 0;
          state.raceTime       = 0;
          state.playerLap      = 0;
          state.playerFinished = false;
          state.bestLap        = Infinity;
          input._keys['Enter'] = false;
          input._keys[' ']     = false;
          input._keys['Space'] = false;
        }
      }
      break;

    default:
      // Unknown phase — reset to menu
      state.phase = 'menu';
      break;
  }
};

// ---------------------------------------------------------------------------
// R.render() — Render pipeline
// ---------------------------------------------------------------------------

/**
 * Clears the canvas and runs the full ordered render pass:
 *   sky → track → scenery → cars → effects → HUD → overlay
 *
 * Applies camera transform for world-space layers and restores it before
 * screen-space HUD/overlay layers.
 */
R.render = function () {
  var ctx = R.ctx;
  if (!ctx) return;

  ctx.save();

  // Clear the full canvas
  ctx.clearRect(0, 0, R.CONFIG.CANVAS_WIDTH, R.CONFIG.CANVAS_HEIGHT);

  // --- world-space layers (camera-relative) -----------------------------
  _applyCameraTransform(ctx);

  if (typeof R.renderSky     === 'function') { R.renderSky(ctx); }
  if (typeof R.renderTrack   === 'function') { R.renderTrack(ctx); }
  if (typeof R.renderScenery === 'function') { R.renderScenery(ctx); }
  if (typeof R.renderCars    === 'function') { R.renderCars(ctx); }
  if (typeof R.renderEffects === 'function') { R.renderEffects(ctx); }

  // --- screen-space layers ----------------------------------------------
  ctx.restore();
  ctx.save();

  if (typeof R.renderHUD     === 'function') { R.renderHUD(ctx); }
  if (typeof R.renderOverlay === 'function') { R.renderOverlay(ctx); }

  ctx.restore();
};

/**
 * Apply the camera translation and zoom to the canvas context.
 * World-space render calls should happen between apply and restore.
 * @param {CanvasRenderingContext2D} ctx
 */
function _applyCameraTransform(ctx) {
  var cam = R.camera;
  if (!cam) return;
  ctx.translate(R.CONFIG.CANVAS_WIDTH / 2, R.CONFIG.CANVAS_HEIGHT / 2);
  ctx.scale(cam.zoom || 1, cam.zoom || 1);
  ctx.translate(-cam.x, -cam.y);
}

// ---------------------------------------------------------------------------
// R.updateCamera(dt) — Smooth camera follow
// ---------------------------------------------------------------------------

/**
 * Lerp the camera toward the player car for smooth following.
 *
 * Uses a frame-rate-independent lerp so the feel is consistent at any FPS:
 *   t = 1 - (1 - CAMERA_SMOOTH) ^ (dt * 60)
 *   camera.x += (player.x - camera.x) * t
 *   camera.y += (player.y + CAMERA_OFFSET_Y - camera.y) * t
 *
 * @param {number} dt Delta-time in seconds
 */
R.updateCamera = function (dt) {
  var player = R.player;
  if (!player) return;

  var cam    = R.camera;
  var smooth = R.CONFIG.CAMERA_SMOOTH;
  var offY   = R.CONFIG.CAMERA_OFFSET_Y;

  // Frame-rate-independent lerp factor
  var t = 1 - Math.pow(1 - smooth, dt * 60);

  // Snap on first frame (camera not yet positioned)
  if (cam.x === undefined || cam.y === undefined) {
    cam.x = player.x;
    cam.y = player.y + offY;
    return;
  }

  cam.x += (player.x - cam.x) * t;
  cam.y += (player.y + offY - cam.y) * t;
};

// ---------------------------------------------------------------------------
// Math utilities
// ---------------------------------------------------------------------------

/**
 * Linear interpolation between a and b.
 * @param {number} a Start value
 * @param {number} b End value
 * @param {number} t Interpolation factor [0, 1]
 * @returns {number} Interpolated value
 */
R.lerp = function (a, b, t) {
  return a + (b - a) * t;
};

/**
 * Clamp a value between lo and hi (inclusive).
 * @param {number} v  Value to clamp
 * @param {number} lo Lower bound
 * @param {number} hi Upper bound
 * @returns {number} Clamped value
 */
R.clamp = function (v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
};

/**
 * Euclidean distance between two 2D points.
 * @param {number} x1 First point x
 * @param {number} y1 First point y
 * @param {number} x2 Second point x
 * @param {number} y2 Second point y
 * @returns {number} Distance
 */
R.dist = function (x1, y1, x2, y2) {
  var dx = x2 - x1;
  var dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Random float in [min, max).
 * @param {number} min Lower bound (inclusive)
 * @param {number} max Upper bound (exclusive)
 * @returns {number} Random value
 */
R.randomRange = function (min, max) {
  return min + Math.random() * (max - min);
};

// ---------------------------------------------------------------------------
// Exports (all attached to window.R)
// ---------------------------------------------------------------------------
// init, loop, updateStateMachine, render, updateCamera
// lerp, clamp, dist, randomRange
// aiCars[], particles[], sceneryObjects[]
