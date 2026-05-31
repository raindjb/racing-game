// === input.js — Racing Game ===
// Handles all player input: keyboard (desktop), touch (mobile), gamepad stub.
// All functions and state attached to window.R.
// Depends on: R.canvas, R.ctx, R.input, R.CONFIG, R.state

// ---------------------------------------------------------------------------
// Default R.input structure (filled if not already populated by engine-core)
// ---------------------------------------------------------------------------

R.input = R.input || {};
R.input.throttle = R.input.throttle ?? 0;
R.input.brake    = R.input.brake    ?? 0;
R.input.steer    = R.input.steer    ?? 0;
R.input.boost    = R.input.boost    ?? 0;
R.input.confirm  = R.input.confirm  ?? false;
R.input.pause    = R.input.pause    ?? false;

// ---------------------------------------------------------------------------
// Internal key-state tracker — holds key down state for continuous actions
// ---------------------------------------------------------------------------

const _keysDown = {};        // e.code → true/false
const _gameKeys = new Set(); // keys we care about (for fast lookup)
let   _touchActive = false;  // whether a touch is currently held
let   _touchStartX  = 0;
let   _touchStartY  = 0;
let   _touchStartTime = 0;
let   _touchCurrentX = 0;
let   _touchCurrentY = 0;
let   _touchMoved   = false; // has the finger moved beyond a tap threshold
let   _edgeTriggeredConfirm = false;
let   _edgeTriggeredPause   = false;
let   _gamepadIndex   = -1;  // detected gamepad index, -1 if none
let   _gamepadActive  = false;

// Tap / swipe thresholds (in px)
const TAP_DISTANCE    = 30;  // max movement to count as tap
const SWIPE_DISTANCE  = 60;  // min movement to count as swipe
const TAP_MAX_TIME    = 300; // ms — max duration for tap

// Game keys we intercept with preventDefault
const GAME_KEY_CODES = [
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ShiftLeft', 'ShiftRight', 'Space',
  'Enter', 'Escape', 'KeyP'
];

// Build the fast-lookup set
GAME_KEY_CODES.forEach(function (c) { _gameKeys.add(c); });

// ---------------------------------------------------------------------------
// Keyboard state → R.input mapping (called each frame)
// ---------------------------------------------------------------------------

function _syncKeyboardState() {
  // Steering — left takes priority over right when both held
  const left  = _keysDown['ArrowLeft']  || _keysDown['KeyA'] || false;
  const right = _keysDown['ArrowRight'] || _keysDown['KeyD'] || false;
  if (left && !right) {
    R.input.steer = -1;
  } else if (right && !left) {
    R.input.steer = 1;
  } else if (left && right) {
    R.input.steer = 0; // both held → cancel (rare)
  } else {
    R.input.steer = 0;
  }

  // Throttle
  R.input.throttle = (_keysDown['ArrowUp'] || _keysDown['KeyW']) ? 1 : 0;

  // Brake
  R.input.brake = (_keysDown['ArrowDown'] || _keysDown['KeyS']) ? 1 : 0;

  // Boost
  R.input.boost = (_keysDown['ShiftLeft'] || _keysDown['ShiftRight'] || _keysDown['Space']) ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Touch state → R.input mapping (called each frame)
// ---------------------------------------------------------------------------

function _syncTouchState() {
  if (!_touchActive) {
    // No finger down — clear touch-driven input unless keyboard is handling it
    return;
  }
  if (!_touchMoved) {
    // Finger hasn't moved enough for a swipe — no steering/throttle/brake yet
    return;
  }

  const dx = _touchCurrentX - _touchStartX;
  const dy = _touchCurrentY - _touchStartY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Only override if touch actually provides meaningful input
  if (absDx < TAP_DISTANCE && absDy < TAP_DISTANCE) return;

  // Steer: horizontal position on screen
  const halfW = R.canvas.width * 0.5;
  if (_touchCurrentX < halfW - 30) {
    // Left half → steer left (proportional)
    const zone = halfW - 30;
    R.input.steer = -Math.min(1, (zone - _touchCurrentX) / zone);
  } else if (_touchCurrentX > halfW + 30) {
    // Right half → steer right (proportional)
    const zone = halfW - 30;
    R.input.steer = Math.min(1, (_touchCurrentX - halfW - 30) / zone);
  }

  // Swipe up → throttle, swipe down → brake (dominant vertical direction)
  if (absDy > absDx && absDy > SWIPE_DISTANCE) {
    if (dy < 0) {
      R.input.throttle = 1;
      R.input.brake    = 0;
    } else {
      R.input.brake    = 1;
      R.input.throttle = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Gamepad state → R.input mapping (called each frame when gamepad is active)
// ---------------------------------------------------------------------------

function _syncGamepadState() {
  if (!_gamepadActive || _gamepadIndex < 0) return;

  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = gamepads[_gamepadIndex];
  if (!gp) {
    _gamepadActive = false;
    _gamepadIndex = -1;
    return;
  }

  // Left stick horizontal → steering (axis 0)
  // Apply a small deadzone to avoid drift
  const rawSteer = gp.axes[0] || 0;
  if (Math.abs(rawSteer) < 0.15) {
    R.input.steer = 0;
  } else {
    R.input.steer = Math.max(-1, Math.min(1, rawSteer));
  }

  // Right trigger → throttle (axis 5 on standard mapping, 0..1)
  // Left trigger → brake (axis 4 on standard mapping, 0..1)
  // Some controllers map triggers to buttons 6/7 — we handle both
  if (gp.buttons[7] && typeof gp.buttons[7].value === 'number') {
    R.input.throttle = gp.buttons[7].value; // right trigger as button
  } else {
    R.input.throttle = (gp.axes[5] !== undefined) ? (gp.axes[5] + 1) * 0.5 : 0;
  }
  if (gp.buttons[6] && typeof gp.buttons[6].value === 'number') {
    R.input.brake = gp.buttons[6].value; // left trigger as button
  } else {
    R.input.brake = (gp.axes[4] !== undefined) ? (gp.axes[4] + 1) * 0.5 : 0;
  }

  // A button (index 0) → boost
  R.input.boost = gp.buttons[0] && gp.buttons[0].pressed ? 1 : 0;

  // Start button (index 9) → pause (edge-triggered)
  if (gp.buttons[9] && gp.buttons[9].pressed) {
    _edgeTriggeredPause = true;
  }

  // Confirm via A button or Start (edge-triggered in updateInput)
  if (gp.buttons[0] && gp.buttons[0].pressed) {
    _edgeTriggeredConfirm = true;
  }
}

// ---------------------------------------------------------------------------
// Keyboard event handlers
// ---------------------------------------------------------------------------

function _onKeyDown(e) {
  if (!_gameKeys.has(e.code)) return; // not a game key — ignore

  e.preventDefault(); // prevent scrolling / default browser action

  // Edge-triggered actions (set flag once per press)
  if (e.code === 'Enter') {
    _edgeTriggeredConfirm = true;
    return;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    _edgeTriggeredPause = true;
    return;
  }

  // Continuous actions — just track key down
  _keysDown[e.code] = true;
}

function _onKeyUp(e) {
  if (!_gameKeys.has(e.code)) return;

  e.preventDefault();

  // Edge-triggered keys don't need up handling
  if (e.code === 'Enter' || e.code === 'Escape' || e.code === 'KeyP') return;

  _keysDown[e.code] = false;
}

// ---------------------------------------------------------------------------
// Touch event handlers
// ---------------------------------------------------------------------------

function _onTouchStart(e) {
  e.preventDefault(); // prevent scrolling / pinch-zoom

  const t = e.changedTouches[0];
  if (!t) return;

  _touchActive    = true;
  _touchStartX    = t.clientX;
  _touchStartY    = t.clientY;
  _touchStartTime = Date.now();
  _touchCurrentX  = t.clientX;
  _touchCurrentY  = t.clientY;
  _touchMoved     = false;

  // Set boost on touch start if it's a quick double-tap pattern (handled per-frame)
}

function _onTouchMove(e) {
  e.preventDefault();

  if (!_touchActive) return;

  const t = e.changedTouches[0];
  if (!t) return;

  const prevX = _touchCurrentX;
  const prevY = _touchCurrentY;
  _touchCurrentX = t.clientX;
  _touchCurrentY = t.clientY;

  // Mark as moved if beyond tap threshold
  const totalDx = _touchCurrentX - _touchStartX;
  const totalDy = _touchCurrentY - _touchStartY;
  if (Math.abs(totalDx) > TAP_DISTANCE || Math.abs(totalDy) > TAP_DISTANCE) {
    _touchMoved = true;
  }
}

function _onTouchEnd(e) {
  e.preventDefault();

  if (!_touchActive) return;

  const t = e.changedTouches[0];
  if (!t) { _resetTouch(); return; }

  const endX = t.clientX;
  const endY = t.clientY;
  const dx   = endX - _touchStartX;
  const dy   = endY - _touchStartY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const elapsed = Date.now() - _touchStartTime;

  // Tap detection: small movement + short duration
  if (dist < TAP_DISTANCE && elapsed < TAP_MAX_TIME) {
    // Tap center 40% of screen → confirm
    const centerX = R.canvas.width  * 0.5;
    const centerY = R.canvas.height * 0.5;
    const tapRadius = R.canvas.width * 0.2; // center 40% in width
    if (Math.abs(endX - centerX) < tapRadius && Math.abs(endY - centerY) < tapRadius) {
      _edgeTriggeredConfirm = true;
    }
  }

  _resetTouch();
}

function _onTouchCancel(e) {
  _resetTouch();
}

function _resetTouch() {
  _touchActive    = false;
  _touchStartX    = 0;
  _touchStartY    = 0;
  _touchStartTime = 0;
  _touchCurrentX  = 0;
  _touchCurrentY  = 0;
  _touchMoved     = false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * R.initInput()
 * Bind all input event listeners (keyboard, touch).
 * Safe to call multiple times — removes previous listeners first.
 * Call once during game initialization.
 */
R.initInput = function () {
  // Remove old listeners if re-initializing
  if (R._inputListenersBound) {
    R.destroyInput();
  }

  // Keyboard
  window.addEventListener('keydown', _onKeyDown, { passive: false });
  window.addEventListener('keyup',   _onKeyUp,   { passive: false });

  // Touch (only if touch-capable, but safe to bind regardless)
  const cvs = R.canvas;
  if (cvs) {
    cvs.addEventListener('touchstart', _onTouchStart,  { passive: false });
    cvs.addEventListener('touchmove',  _onTouchMove,   { passive: false });
    cvs.addEventListener('touchend',   _onTouchEnd,    { passive: false });
    cvs.addEventListener('touchcancel',_onTouchCancel, { passive: false });
  }

  // Visibility change — clear all keys if tab loses focus
  window.addEventListener('blur', function () {
    // Clear all held keys on blur to prevent stuck inputs
    for (var k in _keysDown) {
      if (_keysDown.hasOwnProperty(k)) _keysDown[k] = false;
    }
    _resetTouch();
    R.input.throttle = 0;
    R.input.brake    = 0;
    R.input.steer    = 0;
    R.input.boost    = 0;
  });

  R._inputListenersBound = true;
};

/**
 * R.destroyInput()
 * Remove all input event listeners. Call before shutdown or re-init.
 */
R.destroyInput = function () {
  window.removeEventListener('keydown', _onKeyDown);
  window.removeEventListener('keyup',   _onKeyUp);

  const cvs = R.canvas;
  if (cvs) {
    cvs.removeEventListener('touchstart',  _onTouchStart);
    cvs.removeEventListener('touchmove',   _onTouchMove);
    cvs.removeEventListener('touchend',    _onTouchEnd);
    cvs.removeEventListener('touchcancel', _onTouchCancel);
  }

  R._inputListenersBound = false;
};

/**
 * R.updateInput()
 * Called every frame. Syncs raw input state to R.input and clears
 * edge-triggered flags that were consumed.
 */
R.updateInput = function () {
  // 1. Sync keyboard continuous state
  _syncKeyboardState();

  // 2. Sync touch state
  _syncTouchState();

  // 3. Sync gamepad (if active)
  if (_gamepadActive) {
    _syncGamepadState();
  }

  // 4. Edge-triggered flags — transfer from internal to R.input
  //    These are set by event handlers and consumed once by the state machine.
  //    We do NOT reset them here — they persist until consumeConfirm/consumePause
  //    is called. But we must NOT double-set them either.
  if (_edgeTriggeredConfirm) {
    R.input.confirm = true;
    _edgeTriggeredConfirm = false;
  }
  if (_edgeTriggeredPause) {
    R.input.pause = true;
    _edgeTriggeredPause = false;
  }
};

/**
 * R.consumeConfirm()
 * Called by the state machine after reading R.input.confirm.
 * Resets the flag so it fires only once per press.
 */
R.consumeConfirm = function () {
  R.input.confirm = false;
};

/**
 * R.consumePause()
 * Called by the state machine after reading R.input.pause.
 * Resets the flag so it fires only once per press.
 */
R.consumePause = function () {
  R.input.pause = false;
};

// ---------------------------------------------------------------------------
// Gamepad support (optional stub)
// ---------------------------------------------------------------------------

/**
 * R.initGamepad()
 * Detect the first connected gamepad and begin polling.
 * Gamepad state is read each frame inside updateInput() via _syncGamepadState().
 * Re-checks for gamepad connection on every call (safe to call each frame
 * or on-demand).
 *
 * Mapping (standard):
 *   Left stick X  → steer
 *   Right trigger → throttle
 *   Left trigger  → brake
 *   A button      → boost
 *   Start button  → pause
 */
R.initGamepad = function () {
  // If we already have an active gamepad, verify it's still connected
  if (_gamepadActive && _gamepadIndex >= 0) {
    var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (gamepads[_gamepadIndex]) return; // still connected
    // Disconnected — fall through to re-detect
    _gamepadActive = false;
    _gamepadIndex = -1;
  }

  // Detect first connected gamepad
  var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (var i = 0; i < gamepads.length; i++) {
    if (gamepads[i] && gamepads[i].connected) {
      _gamepadIndex = i;
      _gamepadActive = true;
      return;
    }
  }

  // No gamepad found
  _gamepadIndex = -1;
  _gamepadActive = false;
};

/**
 * R.isGamepadActive()
 * Returns true if a gamepad is currently detected and being polled.
 * @returns {boolean}
 */
R.isGamepadActive = function () {
  return _gamepadActive;
};

/**
 * R.refreshGamepad()
 * Force a re-scan for newly connected/disconnected gamepads.
 * (Alias for initGamepad — same logic.)
 */
R.refreshGamepad = R.initGamepad;

// ---------------------------------------------------------------------------
// Additional utility: R.getInputDebugInfo()
// Returns a snapshot of current input state for debugging / HUD overlay.
// ---------------------------------------------------------------------------

/**
 * R.getInputDebugInfo()
 * Returns an object with current raw input state for debug display.
 * @returns {{ throttle: number, brake: number, steer: number, boost: number,
 *             confirm: boolean, pause: boolean, touchActive: boolean,
 *             gamepadActive: boolean, keysHeld: string[] }}
 */
R.getInputDebugInfo = function () {
  var held = [];
  for (var k in _keysDown) {
    if (_keysDown.hasOwnProperty(k) && _keysDown[k]) held.push(k);
  }
  return {
    throttle:      R.input.throttle,
    brake:         R.input.brake,
    steer:         R.input.steer,
    boost:         R.input.boost,
    confirm:       R.input.confirm,
    pause:         R.input.pause,
    touchActive:   _touchActive,
    gamepadActive: _gamepadActive,
    keysHeld:      held
  };
};

// ---------------------------------------------------------------------------
// Exported symbols (attached to window.R):
//   R.initInput()
//   R.destroyInput()
//   R.updateInput()
//   R.consumeConfirm()
//   R.consumePause()
//   R.initGamepad()
//   R.isGamepadActive()
//   R.refreshGamepad()
//   R.getInputDebugInfo()
// ---------------------------------------------------------------------------
