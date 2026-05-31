/**
 * Test environment setup — mocks browser globals for Node.js.
 * Modules use the IIFE pattern and attach to window.R.
 */

// ── Mock window with full R.CONFIG ──────────────────────────────────────────
const _config = {
  CANVAS_WIDTH: 1280,
  CANVAS_HEIGHT: 720,
  CAR_WIDTH: 40,
  CAR_HEIGHT: 70,
  COLLISION_DAMPING: 0.7,
  COLLISION_SPEED_LOSS: 0.85,
  OFFROAD_FRICTION: 0.92,
  OFFROAD_DEEP_PENALTY: 0.80,
  OFFROAD_DEEP_THRESH: 50,
  MIN_SPEED: 0.01,
  MIN_COLLISION_SPEED: 2.0,
  SPARK_SPEED_THRESH: 4.0,
  MAX_SIMULTANEOUS: 8,
  COLLISION_PUSH: 2.0,
  COLLISION_RADIUS: 35,
  COLLISION_DAMPING: 0.7,
  COLLISION_SPEED_LOSS: 0.85,
  INVULN_FRAMES: 8,
  MAX_SPEED: 12,
  ACCELERATION: 0.08,
  BRAKING: 0.14,
  FRICTION: 0.985,
  HANDLING: 0.045,
  DRIFT_FACTOR: 0.92,
  DRIFT_THRESHOLD: 0.15,
  BOOST_MULTIPLIER: 1.6,
  BOOST_DURATION: 1.5,
  BOOST_COOLDOWN: 3.0,
  STEER_CENTER_RATE: 0.85,
  MAX_STEER: 0.6,
  CAR_LENGTH: 48,
  CAR_WIDTH_PX: 24,
  CAR_HALF_WIDTH: 20,
  CAR_HALF_HEIGHT: 35,
  WHEELBASE: 30,
  WHEEL_WIDTH: 7,
  WHEEL_LENGTH: 12,
  CHECKPOINT_PROXIMITY: 60,
  TOTAL_LAPS: 3,
  TRACK_SEGMENTS: 200,
  ROAD_WIDTH: 180,
  PERSPECTIVE_COEFF: 0.0005,
  HORIZON_Y: 200,
  ROAD_V_OFFSET: 0.42,
  RENDER_DISTANCE: 1200,
  LANE_MARKER_DASH: 40,
  LANE_MARKER_GAP: 30,
  LANE_MARKER_COLOR: '#ccc',
  LANE_MARKER_WIDTH: 1.5,
  RUMBLE_WIDTH: 6,
  RUMBLE_COLOR_A: '#ff0000',
  RUMBLE_COLOR_B: '#ffffff',
  CURB_CURVATURE_THRESH: 0.0012,
  LINE_COLOR: '#fff',
  ROAD_COLOR: '#555',
  TRACK_BG_COLOR: '#3a5a2c',
  SKY_TOP_COLOR: '#1a1a2e',
  SKY_BOTTOM_COLOR: '#87CEEB',
  COUNTDOWN_SECONDS: 3,
  COUNTDOWN_DURATION: 3,
  FIXED_DT: 1 / 60,
  TARGET_FPS: 60,
  // Elevation / hills
  HILL_AMPLITUDE_A: 28,
  HILL_FREQ_A: 0.0012,
  HILL_AMPLITUDE_B: 14,
  HILL_FREQ_B: 0.0030,
  HILL_PHASE_B: 1.7,
  // Track generation
  TRACK_CONTROL_POINTS: 16,
  TRACK_SEGMENTS_PER_CP: 12,
  TRACK_BASE_RADIUS: 1200,
  TRACK_RADIUS_VAR1: 250,
  TRACK_RADIUS_VAR2: 180,
  TRACK_RADIUS_VAR3: 100,
  TRACK_RADIUS_JITTER: 80,
  TRACK_SEED: 42,
  LAP_CHECKPOINT_COUNT: 5,
  SCENERY_SEGMENT_STEP: 5,
};

global.window = {
  R: {
    CONFIG: Object.assign({}, _config),
  },
};

// Also expose R as a global (modules reference R directly via scope)
global.R = global.window.R;

// ── Helper utilities that modules expect ────────────────────────────────────
R.lerp = function (a, b, t) {
  return a + (b - a) * t;
};

// ── Re-export CONFIG for convenience ────────────────────────────────────────
global._TEST_CFG = _config;

// ── Canvas mock (for modules that touch canvas) ─────────────────────────────
global.document = {
  createElement: () => ({}),
  getElementById: () => null,
  addEventListener: () => {},
  body: { appendChild: () => {} },
};

// ── Audio mock ──────────────────────────────────────────────────────────────
global.AudioContext = class {
  constructor() { this.state = 'running'; }
  createGain() { return { gain: { value: 0 }, connect() {} }; }
  createOscillator() { return { type: 'sine', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; }
  createBufferSource() { return { buffer: null, connect() {}, start() {} }; }
  createBuffer(channels, length, sampleRate) { return { getChannelData() { return new Float32Array(length); } }; }
  decodeAudioData(buf, cb) { cb({}); }
  get destination() { return {}; }
};
global.OfflineAudioContext = global.AudioContext;
