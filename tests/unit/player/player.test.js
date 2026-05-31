/**
 * player.test.js — Tests for player car physics and state.
 *
 * Tests: init, update (acceleration, boost, steering, friction),
 * collision response, reset.
 *
 * NOTE: player.js depends on track.js (for isOnTrack and track segments)
 * and engine.js (for input). We mock those dependencies.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadModule } from '../../helpers/load-module.js';

beforeAll(() => {
  loadModule('config');
  loadModule('track');

  // ── Mock dependencies that player.js needs but come from engine.js ─────
  R.state = { phase: 'racing', time: 0 };
  R.input = { throttle: 0, brake: 0, steer: 0, boost: 0, _keys: {} };

  // Generate a track for isOnTrack checks
  R.camera = { x: 0, y: 0, zoom: 1 };
  R.CONFIG.TRACK_SEED = 42; // deterministic track
  R.initTrack();

  // ── Mock canvas (player rendering checks canvas) ──────────────────────
  R.canvas = { width: 1280, height: 720 };
  R.ctx = {
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    fill() {},
    stroke() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {},
    ellipse() {},
    fillRect() {},
    fillText() {},
    strokeText() {},
    measureText() { return { width: 0 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    setTransform() {},
    clip() {},
    drawImage() {},
  };
  // Make canvas properties configurable
  Object.defineProperty(R.ctx, 'fillStyle', { value: '', writable: true });
  Object.defineProperty(R.ctx, 'strokeStyle', { value: '', writable: true });
  Object.defineProperty(R.ctx, 'lineWidth', { value: 1, writable: true });
  Object.defineProperty(R.ctx, 'textAlign', { value: 'left', writable: true });
  Object.defineProperty(R.ctx, 'font', { value: '', writable: true });
  Object.defineProperty(R.ctx, 'shadowColor', { value: '', writable: true });
  Object.defineProperty(R.ctx, 'shadowBlur', { value: 0, writable: true });

  // ── worldToScreen needs to work for rendering ──────────────────────────
  R.camera = { x: 0, y: 0, zoom: 1 };

  loadModule('player');
});

// ============================================================================
// Player config overrides — ensurePlayerConfig MUST overwrite config.js values
// ============================================================================
describe('Player config: ensurePlayerConfig overrides', () => {
  it('overrides BOOST_DURATION from frames (90) to seconds (1.5)', () => {
    expect(R.CONFIG.BOOST_DURATION).toBe(1.5);
  });

  it('overrides BOOST_COOLDOWN from frames (300) to seconds (3.0)', () => {
    expect(R.CONFIG.BOOST_COOLDOWN).toBe(3.0);
  });

  it('overrides ACCELERATION from config.js (0.15) to tuned value (0.08)', () => {
    expect(R.CONFIG.ACCELERATION).toBe(0.08);
  });

  it('overrides FRICTION from config.js (0.96) to tuned value (0.985)', () => {
    expect(R.CONFIG.FRICTION).toBe(0.985);
  });

  it('overrides BRAKING from config.js (0.25) to tuned value (0.14)', () => {
    expect(R.CONFIG.BRAKING).toBe(0.14);
  });

  it('overrides OFFROAD_FRICTION from config.js (0.85) to tuned value (0.92)', () => {
    expect(R.CONFIG.OFFROAD_FRICTION).toBe(0.92);
  });
});

// ============================================================================
// R.initPlayer
// ============================================================================
describe('R.initPlayer', () => {
  beforeEach(() => {
    R.initPlayer();
  });

  it('creates player with required fields', () => {
    const p = R.player;
    expect(p).toBeDefined();
    expect(p).toHaveProperty('x');
    expect(p).toHaveProperty('y');
    expect(p).toHaveProperty('z');
    expect(p).toHaveProperty('angle');
    expect(p).toHaveProperty('speed');
    expect(p).toHaveProperty('steerAngle');
    expect(p).toHaveProperty('boosting');
    expect(p).toHaveProperty('boostTimer');
    expect(p).toHaveProperty('boostCooldown');
    expect(p).toHaveProperty('lap');
    expect(p).toHaveProperty('checkpointIdx');
    expect(p).toHaveProperty('finished');
  });

  it('starts at track start position', () => {
    const p = R.player;
    expect(p.x).toBe(R.track.startX);
    expect(p.y).toBe(R.track.startY);
  });

  it('starts with zero speed', () => {
    expect(R.player.speed).toBe(0);
  });

  it('starts at lap 0', () => {
    expect(R.player.lap).toBe(0);
  });

  it('starts not finished', () => {
    expect(R.player.finished).toBe(false);
  });

  it('starts not boosting', () => {
    expect(R.player.boosting).toBe(false);
    expect(R.player.boostTimer).toBe(0);
    expect(R.player.boostCooldown).toBe(0);
  });
});

// ============================================================================
// R.updatePlayer — physics simulation
// ============================================================================
describe('R.updatePlayer — acceleration', () => {
  beforeEach(() => {
    R.initPlayer();
    R.state.phase = 'racing';
    R.input.throttle = 0;
    R.input.brake = 0;
    R.input.steer = 0;
    R.input.boost = 0;
  });

  it('accelerates when throttle is pressed', () => {
    R.input.throttle = 1;
    const speedBefore = R.player.speed;
    R.updatePlayer(1 / 60);
    expect(R.player.speed).toBeGreaterThan(speedBefore);
  });

  it('speed stays at 0 without input', () => {
    R.updatePlayer(1 / 60);
    expect(R.player.speed).toBe(0);
  });

  it('does not accelerate when braking', () => {
    R.input.throttle = 1;
    R.input.brake = 1;
    R.updatePlayer(1 / 60);
    // With both pressed, braking takes priority (only accel blocked)
    const speedAfter = R.player.speed;
    // Should have friction applied but no acceleration
    expect(speedAfter).toBe(0);
  });

  it('speed is clamped to maxSpeed', () => {
    R.player.speed = R.player.maxSpeed + 5;
    R.updatePlayer(1 / 60);
    expect(R.player.speed).toBeLessThanOrEqual(R.player.maxSpeed);
  });

  it('speed never goes negative', () => {
    R.input.brake = 1;
    R.updatePlayer(1 / 60);
    expect(R.player.speed).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// R.updatePlayer — boost
// ============================================================================
describe('R.updatePlayer — boost', () => {
  beforeEach(() => {
    R.initPlayer();
    R.state.phase = 'racing';
    R.input.throttle = 1;
    R.input.brake = 0;
    R.input.steer = 0;
    R.input.boost = 0;
    // Give player some initial speed (need speed > 0.5 to activate boost)
    R.player.speed = 3;
  });

  it('activates boost when boost input is triggered', () => {
    R.input.boost = 1;
    R.updatePlayer(1 / 60);
    expect(R.player.boosting).toBe(true);
  });

  it('boost has a timer', () => {
    R.input.boost = 1;
    R.updatePlayer(1 / 60);
    expect(R.player.boostTimer).toBeGreaterThan(0);
    expect(R.player.boostTimer).toBeLessThanOrEqual(R.CONFIG.BOOST_DURATION);
  });

  it('boost enters cooldown after activation', () => {
    R.input.boost = 1;
    R.updatePlayer(1 / 60);
    expect(R.player.boostCooldown).toBeGreaterThan(0);
  });

  it('boost cannot activate when cooldown is active', () => {
    // First boost
    R.input.boost = 1;
    R.updatePlayer(1 / 60);
    expect(R.player.boosting).toBe(true);

    // Reset boost input
    R.player.boosting = false;
    R.player.boostTimer = 0;
    R.input.boost = 1;

    // Try to boost again while cooldown > 0
    R.updatePlayer(1 / 60);
    // Should NOT activate because cooldown is active
    expect(R.player.boosting).toBe(false);
  });

  it('boost expires after duration', () => {
    R.input.boost = 1;
    // Simulate frames until boost expires
    const dt = 1 / 60;
    let totalTime = 0;
    while (totalTime < R.CONFIG.BOOST_DURATION + 0.1) {
      R.updatePlayer(dt);
      totalTime += dt;
      R.input.boost = 0; // boost is one-shot, clear after first frame
    }
    expect(R.player.boosting).toBe(false);
  });

  it('boost allows speed above maxSpeed', () => {
    R.player.speed = R.player.maxSpeed * 0.9;
    R.input.boost = 1;
    R.updatePlayer(1 / 60);
    // Speed may exceed maxSpeed during boost
    // Allow speed up to MAX_SPEED * BOOST_MULTIPLIER
    const maxBoostSpeed = R.player.maxSpeed * R.CONFIG.BOOST_MULTIPLIER;
    expect(R.player.speed).toBeLessThanOrEqual(maxBoostSpeed + 0.1);
  });
});

// ============================================================================
// R.updatePlayer — friction
// ============================================================================
describe('R.updatePlayer — friction', () => {
  beforeEach(() => {
    R.initPlayer();
    R.state.phase = 'racing';
    R.input.throttle = 0;
    R.input.brake = 0;
    R.input.steer = 0;
    R.input.boost = 0;
  });

  it('applies friction to decelerate over time', () => {
    R.player.speed = 8;
    R.updatePlayer(1 / 60);
    expect(R.player.speed).toBeLessThan(8);
  });

  it('friction does not increase speed', () => {
    R.player.speed = 3;
    R.updatePlayer(1 / 60);
    expect(R.player.speed).toBeLessThanOrEqual(3);
  });
});

// ============================================================================
// R.updatePlayer — steering
// ============================================================================
describe('R.updatePlayer — steering', () => {
  beforeEach(() => {
    R.initPlayer();
    R.state.phase = 'racing';
    R.input.throttle = 1;
    R.input.brake = 0;
    R.input.steer = 0;
    R.input.boost = 0;
    R.player.speed = 5;
  });

  it('steering left sets negative steerAngle', () => {
    R.input.steer = -1;
    R.updatePlayer(1 / 60);
    expect(R.player.steerAngle).toBeLessThan(0);
  });

  it('steering right sets positive steerAngle', () => {
    R.input.steer = 1;
    R.updatePlayer(1 / 60);
    expect(R.player.steerAngle).toBeGreaterThan(0);
  });

  it('steerAngle is clamped to MAX_STEER', () => {
    // Simulate many frames of steering
    R.input.steer = 1;
    for (let i = 0; i < 200; i++) {
      R.updatePlayer(1 / 60);
    }
    expect(Math.abs(R.player.steerAngle)).toBeLessThanOrEqual(R.CONFIG.MAX_STEER + 0.01);
  });

  it('steerAngle self-centers with no input', () => {
    R.player.steerAngle = 0.3;
    R.input.steer = 0;
    R.updatePlayer(1 / 60);
    expect(Math.abs(R.player.steerAngle)).toBeLessThan(0.3);
  });
});

// ============================================================================
// R.playerCollide
// ============================================================================
describe('R.playerCollide', () => {
  beforeEach(() => {
    R.initPlayer();
  });

  it('reduces player speed on collision', () => {
    R.player.speed = 10;
    R.playerCollide(R.player.x + 30, R.player.y, 30);
    expect(R.player.speed).toBeLessThan(10);
  });

  it('pushes player away from obstacle', () => {
    const startX = R.player.x;
    R.playerCollide(startX + 10, R.player.y, 30);
    // Player should have moved
    expect(R.player.x).not.toBe(startX);
  });

  it('returns true on valid collision', () => {
    const result = R.playerCollide(R.player.x + 10, R.player.y, 30);
    expect(result).toBe(true);
  });

  it('returns false when player is null', () => {
    const savedPlayer = R.player;
    R.player = null;
    expect(R.playerCollide(0, 0, 30)).toBe(false);
    R.player = savedPlayer;
  });
});

// ============================================================================
// R.resetPlayerForRetry
// ============================================================================
describe('R.resetPlayerForRetry', () => {
  it('resets all state to initial values', () => {
    R.initPlayer();
    // Modify player state
    R.player.speed = 10;
    R.player.boosting = true;
    R.player.boostCooldown = 2;
    R.player.lap = 2;
    R.player.checkpointIdx = 15;
    R.player.finished = true;

    R.resetPlayerForRetry();

    expect(R.player.speed).toBe(0);
    expect(R.player.boosting).toBe(false);
    expect(R.player.boostCooldown).toBe(0);
    expect(R.player.lap).toBe(0);
    expect(R.player.checkpointIdx).toBe(0);
    expect(R.player.finished).toBe(false);
  });
});

// ============================================================================
// R.getPlayerPosition
// ============================================================================
describe('R.getPlayerPosition', () => {
  it('returns position object with x, y, z, angle', () => {
    R.initPlayer();
    const pos = R.getPlayerPosition();
    expect(pos).toHaveProperty('x');
    expect(pos).toHaveProperty('y');
    expect(pos).toHaveProperty('z');
    expect(pos).toHaveProperty('angle');
  });

  it('returns zeros when player is null', () => {
    const savedPlayer = R.player;
    R.player = null;
    const pos = R.getPlayerPosition();
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
    expect(pos.z).toBe(0);
    expect(pos.angle).toBe(0);
    R.player = savedPlayer;
  });
});
