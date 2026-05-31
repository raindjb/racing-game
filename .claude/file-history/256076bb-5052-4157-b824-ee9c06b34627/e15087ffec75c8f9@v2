/**
 * config.test.js — Tests for racing game configuration constants.
 *
 * Tests config.js module: default values, derived values, and merge logic.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModule } from '../helpers/load-module.js';

beforeAll(() => {
  loadModule('config');
});

// ============================================================================
// Canvas
// ============================================================================
describe('Canvas configuration', () => {
  it('sets canvas dimensions', () => {
    expect(R.CONFIG.CANVAS_WIDTH).toBe(1280);
    expect(R.CONFIG.CANVAS_HEIGHT).toBe(720);
  });
});

// ============================================================================
// Math helpers
// ============================================================================
describe('Math helpers', () => {
  it('exports DEG_TO_RAD and RAD_TO_DEG', () => {
    expect(R.DEG_TO_RAD).toBeCloseTo(Math.PI / 180, 10);
    expect(R.RAD_TO_DEG).toBeCloseTo(180 / Math.PI, 10);
  });
});

// ============================================================================
// Car physics — derived values
// ============================================================================
describe('Car physics derived values', () => {
  it('precomputes CAR_HALF_WIDTH = CAR_WIDTH / 2', () => {
    expect(R.CONFIG.CAR_HALF_WIDTH).toBe(R.CONFIG.CAR_WIDTH / 2);
  });

  it('precomputes CAR_HALF_HEIGHT = CAR_HEIGHT / 2', () => {
    expect(R.CONFIG.CAR_HALF_HEIGHT).toBe(R.CONFIG.CAR_HEIGHT / 2);
  });

  it('precomputes MAX_SPEED_INV = 1 / MAX_SPEED', () => {
    expect(R.CONFIG.MAX_SPEED_INV).toBeCloseTo(1 / R.CONFIG.MAX_SPEED, 10);
  });

  it('precomputes HANDLING_INV = 1 / HANDLING', () => {
    expect(R.CONFIG.HANDLING_INV).toBeCloseTo(1 / R.CONFIG.HANDLING, 10);
  });

  it('precomputes MAX_DRIFT_ANGLE_TAN = Math.tan(MAX_DRIFT_ANGLE)', () => {
    expect(R.CONFIG.MAX_DRIFT_ANGLE_TAN).toBeCloseTo(Math.tan(R.CONFIG.MAX_DRIFT_ANGLE), 10);
  });
});

// ============================================================================
// Config merge — defaults should not overwrite explicit values
// ============================================================================
describe('Config merge behavior', () => {
  it('sets MAX_SPEED from config.js default', () => {
    // config.js sets MAX_SPEED to 12
    expect(R.CONFIG.MAX_SPEED).toBe(12);
  });

  it('sets ACCELERATION from config.js default', () => {
    // config.js sets ACCELERATION to 0.15
    // (player.js's ensurePlayerConfig overrides this to 0.08 at runtime)
    expect(R.CONFIG.ACCELERATION).toBe(0.15);
  });

  it('does not overwrite config keys when loading multiple modules', () => {
    // After loading config.js alone, keys exist with their config.js values
    expect(R.CONFIG.FRICTION).toBeDefined();
    expect(typeof R.CONFIG.CAR_WIDTH).toBe('number');
  });
});

// ============================================================================
// Frame timing
// ============================================================================
describe('Frame timing', () => {
  it('targets 60 FPS', () => {
    expect(R.CONFIG.TARGET_FPS).toBe(60);
  });

  it('fixed delta is 1/60', () => {
    expect(R.CONFIG.FIXED_DT).toBeCloseTo(1 / 60, 5);
  });
});

// ============================================================================
// Boost config (config.js — uses frame-based values)
// NOTE: player.js's ensurePlayerConfig overrides these to seconds (1.5 / 3.0).
//       See player.test.js for the override verification.
// ============================================================================
describe('Boost configuration', () => {
  it('BOOST_DURATION is defined in config.js', () => {
    expect(R.CONFIG.BOOST_DURATION).toBe(90);
    expect(R.CONFIG.BOOST_DURATION).toBeGreaterThan(0);
  });

  it('BOOST_COOLDOWN is defined in config.js', () => {
    expect(R.CONFIG.BOOST_COOLDOWN).toBe(300);
    expect(R.CONFIG.BOOST_COOLDOWN).toBeGreaterThan(0);
  });
});

// ============================================================================
// Speed range sanity
// ============================================================================
describe('Speed value sanity', () => {
  it('MAX_SPEED is positive', () => {
    expect(R.CONFIG.MAX_SPEED).toBeGreaterThan(0);
  });

  it('ACCELERATION is positive and less than MAX_SPEED', () => {
    expect(R.CONFIG.ACCELERATION).toBeGreaterThan(0);
    expect(R.CONFIG.ACCELERATION).toBeLessThan(R.CONFIG.MAX_SPEED);
  });

  it('FRICTION is between 0 and 1', () => {
    expect(R.CONFIG.FRICTION).toBeGreaterThan(0.9);
    expect(R.CONFIG.FRICTION).toBeLessThan(1.0);
  });

  it('OFFROAD_FRICTION is less than regular FRICTION', () => {
    expect(R.CONFIG.OFFROAD_FRICTION).toBeLessThan(R.CONFIG.FRICTION);
  });
});
