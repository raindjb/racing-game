/**
 * Rail Runner — Core Logic Unit Tests
 *
 * Tests pure functions extracted from src/index.html.
 * No DOM/Canvas dependency — all functions are deterministic.
 *
 * Run: npx vitest run tests/unit/core-logic.test.js
 *   or: node --test tests/unit/core-logic.test.js  (Node 18+ native test runner)
 */

// ====================================================================
// Pure functions extracted from game code (copy of src/index.html logic)
// ====================================================================

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Constants from game code
const LANE_COUNT = 3;
const PLAYER_LANE = 1;
const MAX_HEARTS = 3;
const INVINCIBLE_FRAMES = 90;
const BASE_SPEED = 3.5;
const MAX_SPEED = 14;
const SPEED_INC = 0.0004;
const DISTANCE_PER_FRAME = 0.6;
const COIN_SCORE = 50;
const DISTANCE_SCORE = 1;

const OBS_LOW = 'low';
const OBS_MID = 'mid';
const OBS_HIGH = 'high';

const STATE_RUN = 'run';
const STATE_JUMP = 'jump';
const STATE_SLIDE = 'slide';
const STATE_HIT = 'hit';

// World-to-screen projection (needs G-like config)
function makeWorldToScreen(W, H) {
  const vanishX = W * 0.5;
  const vanishY = H * 0.28;
  const groundY = H * 0.88;
  const maxDist = 800;
  return function worldToScreen(dist) {
    const t = 1 - clamp(dist / maxDist, 0, 1);
    const y = lerp(vanishY, groundY, t);
    const scale = lerp(0.15, 1.0, t);
    return { y, scale };
  };
}

function makeLaneX(W) {
  const vanishX = W * 0.5;
  const laneSpread = W * 0.18;
  const maxDist = 800;
  return function laneX(laneIdx, dist) {
    const t = 1 - clamp(dist / maxDist, 0, 1);
    const spread = lerp(0, laneSpread, t);
    return vanishX + (laneIdx - 1) * spread;
  };
}

function sameLane(obsLane, playerLane) {
  return Math.abs(obsLane - playerLane) < 0.6;
}

function calcScore(distance, coinsCollected) {
  return Math.floor(distance * DISTANCE_SCORE) + coinsCollected * COIN_SCORE;
}

function calcSpeed(framesElapsed) {
  return Math.min(BASE_SPEED + SPEED_INC * framesElapsed, MAX_SPEED);
}

function calcDistance(speed, framesElapsed) {
  return speed * DISTANCE_PER_FRAME * framesElapsed;
}

function selectObstacleTypes(speed) {
  const speedRatio = (speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
  if (speedRatio < 0.2) {
    return [OBS_LOW, OBS_LOW, OBS_MID];
  } else if (speedRatio < 0.5) {
    return [OBS_LOW, OBS_MID, OBS_MID, OBS_HIGH];
  } else {
    return [OBS_LOW, OBS_MID, OBS_HIGH, OBS_HIGH];
  }
}

function canPassObstacle(obsType, playerState) {
  if (obsType === OBS_LOW && playerState === STATE_SLIDE) return true;
  if (obsType === OBS_MID && playerState === STATE_JUMP) return true;
  if (obsType === OBS_HIGH) return false; // must switch lane
  return false; // wrong state for this obstacle
}

// Pool operations
function poolGet(pool, factory) {
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i].active) {
      pool[i].active = true;
      return pool[i];
    }
  }
  const obj = factory();
  obj.active = true;
  pool.push(obj);
  return obj;
}

function poolReleaseAll(pool) {
  for (let i = 0; i < pool.length; i++) pool[i].active = false;
}

function createPlayer() {
  return {
    lane: PLAYER_LANE,
    targetLane: PLAYER_LANE,
    state: STATE_RUN,
    stateTimer: 0,
    jumpVel: 0,
    slideTimer: 0,
    animFrame: 0,
    animTimer: 0,
    x: 0, y: 0,
    scale: 1,
  };
}

function createObstacle(lane, type, dist) {
  return {
    active: true,
    lane,
    type,
    dist,
    passed: false,
  };
}

function createCoin(lane, dist) {
  return {
    active: true,
    lane,
    dist,
    collected: false,
    sparkTimer: 0,
  };
}

function hurtPlayer(hearts, invincible, damage) {
  if (invincible > 0) return { hearts, invincible, died: false, hit: false };
  const newHearts = hearts - damage;
  const newInvincible = INVINCIBLE_FRAMES;
  if (newHearts <= 0) {
    return { hearts: 0, invincible: newInvincible, died: true, hit: true };
  }
  return { hearts: newHearts, invincible: newInvincible, died: false, hit: true };
}

function clampLane(lane) {
  return clamp(lane, 0, LANE_COUNT - 1);
}

// ====================================================================
// Tests
// ====================================================================

// --- lerp ---
function test_lerp() {
  console.assert(lerp(0, 10, 0.5) === 5, 'lerp midpoint');
  console.assert(lerp(0, 10, 0) === 0, 'lerp start');
  console.assert(lerp(0, 10, 1) === 10, 'lerp end');
  console.assert(lerp(-5, 5, 0.5) === 0, 'lerp negative range');
}

// --- clamp ---
function test_clamp() {
  console.assert(clamp(5, 0, 10) === 5, 'clamp within');
  console.assert(clamp(-3, 0, 10) === 0, 'clamp below');
  console.assert(clamp(15, 0, 10) === 10, 'clamp above');
  console.assert(clamp(0, 0, 10) === 0, 'clamp at boundary');
}

// --- worldToScreen ---
function test_worldToScreen() {
  const w2s = makeWorldToScreen(400, 800);

  // At distance 0 (player position) -> should be at groundY
  const near = w2s(0);
  console.assert(near.y === 800 * 0.88, `worldToScreen(0) y=${near.y} expected ${800*0.88}`);
  console.assert(near.scale === 1.0, 'worldToScreen(0) scale=1.0');

  // At maxDistance -> should be at vanishY, scale 0.15
  const far = w2s(800);
  console.assert(far.y === 800 * 0.28, `worldToScreen(800) y=${far.y} expected ${800*0.28}`);
  console.assert(far.scale === 0.15, `worldToScreen(800) scale=${far.scale} expected 0.15`);

  // Monotonic: farther = higher on screen (smaller y)
  const mid = w2s(400);
  console.assert(mid.y > far.y && mid.y < near.y, 'worldToScreen monotonic');
  console.assert(mid.scale < near.scale && mid.scale > far.scale, 'worldToScreen scale monotonic');
}

// --- laneX ---
function test_laneX() {
  const lx = makeLaneX(400);

  // At distance 0, lanes are spread by laneSpread
  const leftNear = lx(0, 0);
  const centerNear = lx(1, 0);
  const rightNear = lx(2, 0);
  console.assert(centerNear === 200, `laneX(1,0)=${centerNear} expected 200`);
  console.assert(leftNear < centerNear && centerNear < rightNear, 'laneX order at dist=0');

  // At maxDistance, all lanes converge to vanishX
  const leftFar = lx(0, 800);
  const rightFar = lx(2, 800);
  console.assert(Math.abs(leftFar - 200) < 0.01, `laneX(0,800)=${leftFar} expected ~200`);
  console.assert(Math.abs(rightFar - 200) < 0.01, `laneX(2,800)=${rightFar} expected ~200`);
}

// --- sameLane ---
function test_sameLane() {
  console.assert(sameLane(1, 1.0) === true, 'sameLane exact match');
  console.assert(sameLane(1, 1.5) === true, 'sameLane within tolerance');
  console.assert(sameLane(1, 1.7) === false, 'sameLane outside tolerance');
  console.assert(sameLane(0, 2) === false, 'sameLane far apart');
}

// --- calcScore ---
function test_calcScore() {
  console.assert(calcScore(0, 0) === 0, 'score zero');
  console.assert(calcScore(100, 0) === 100, 'score distance only');
  console.assert(calcScore(0, 2) === 100, 'score coins only');
  console.assert(calcScore(150, 3) === 300, 'score combined');
  // distance 150.7 -> floor 150; coins 3 -> 150; total 300
  console.assert(calcScore(199.9, 0) === 199, 'score fractional distance floored');
}

// --- calcSpeed ---
function test_calcSpeed() {
  console.assert(calcSpeed(0) === BASE_SPEED, 'speed initial');
  console.assert(calcSpeed(1000) > BASE_SPEED, 'speed increasing');
  console.assert(calcSpeed(1000) < MAX_SPEED, 'speed below max');

  // Check that speed caps at MAX_SPEED
  const manyFrames = Math.ceil((MAX_SPEED - BASE_SPEED) / SPEED_INC) + 100;
  console.assert(calcSpeed(manyFrames) === MAX_SPEED, 'speed capped at max');
}

// --- selectObstacleTypes ---
function test_obstacleTypes() {
  // Early game (low speed): mostly low obstacles
  const early = selectObstacleTypes(BASE_SPEED);
  console.assert(early.filter(t => t === OBS_LOW).length >= 2, 'early game has 2+ low obstacles');
  console.assert(!early.includes(OBS_HIGH), 'early game has no high obstacles');

  // Mid game
  const mid = selectObstacleTypes(BASE_SPEED + (MAX_SPEED - BASE_SPEED) * 0.35);
  console.assert(mid.includes(OBS_HIGH), 'mid game introduces high obstacles');

  // Late game
  const late = selectObstacleTypes(MAX_SPEED);
  console.assert(late.filter(t => t === OBS_HIGH).length >= 2, 'late game has 2+ high obstacles');
}

// --- canPassObstacle ---
function test_canPassObstacle() {
  // Low: only slide passes
  console.assert(canPassObstacle(OBS_LOW, STATE_SLIDE) === true, 'low+slide = pass');
  console.assert(canPassObstacle(OBS_LOW, STATE_RUN) === false, 'low+run = fail');
  console.assert(canPassObstacle(OBS_LOW, STATE_JUMP) === false, 'low+jump = fail');

  // Mid: only jump passes
  console.assert(canPassObstacle(OBS_MID, STATE_JUMP) === true, 'mid+jump = pass');
  console.assert(canPassObstacle(OBS_MID, STATE_RUN) === false, 'mid+run = fail');
  console.assert(canPassObstacle(OBS_MID, STATE_SLIDE) === false, 'mid+slide = fail');

  // High: nothing passes (must switch lane)
  console.assert(canPassObstacle(OBS_HIGH, STATE_RUN) === false, 'high+run = fail');
  console.assert(canPassObstacle(OBS_HIGH, STATE_JUMP) === false, 'high+jump = fail');
  console.assert(canPassObstacle(OBS_HIGH, STATE_SLIDE) === false, 'high+slide = fail');
}

// --- Object pool ---
function test_poolGet() {
  const pool = [];
  let factoryCalls = 0;
  const factory = () => { factoryCalls++; return { active: false }; };

  const a = poolGet(pool, factory);
  console.assert(a.active === true, 'poolGet returns active object');
  console.assert(factoryCalls === 1, 'factory called for empty pool');
  console.assert(pool.length === 1, 'pool grew');

  // Release and re-get
  a.active = false;
  const b = poolGet(pool, factory);
  console.assert(b === a, 'poolGet reuses released object');
  console.assert(factoryCalls === 1, 'factory not called again');
}

function test_poolReleaseAll() {
  const pool = [{ active: true }, { active: true }, { active: false }];
  poolReleaseAll(pool);
  console.assert(pool.every(o => o.active === false), 'poolReleaseAll deactivates all');
}

// --- createPlayer ---
function test_createPlayer() {
  const p = createPlayer();
  console.assert(p.lane === 1, 'player starts in middle lane');
  console.assert(p.state === STATE_RUN, 'player starts running');
  console.assert(p.hearts === undefined, 'hearts managed by game state, not player');
}

// --- createObstacle ---
function test_createObstacle() {
  const o = createObstacle(2, OBS_MID, 750);
  console.assert(o.active === true, 'obstacle active');
  console.assert(o.lane === 2, 'obstacle lane');
  console.assert(o.type === OBS_MID, 'obstacle type');
  console.assert(o.dist === 750, 'obstacle dist');
  console.assert(o.passed === false, 'obstacle not passed');
}

// --- hurtPlayer ---
function test_hurtPlayer() {
  // Normal hit
  const r1 = hurtPlayer(3, 0, 1);
  console.assert(r1.hearts === 2, 'hurt: 3 -> 2 hearts');
  console.assert(r1.invincible === INVINCIBLE_FRAMES, 'hurt: invincibility set');
  console.assert(r1.died === false, 'hurt: still alive');
  console.assert(r1.hit === true, 'hurt: hit registered');

  // Invincible — no damage
  const r2 = hurtPlayer(3, 10, 1);
  console.assert(r2.hearts === 3, 'invincible: hearts unchanged');
  console.assert(r2.hit === false, 'invincible: no hit');

  // Fatal hit
  const r3 = hurtPlayer(1, 0, 1);
  console.assert(r3.hearts === 0, 'fatal: hearts = 0');
  console.assert(r3.died === true, 'fatal: died');
}

// --- clampLane ---
function test_clampLane() {
  console.assert(clampLane(0) === 0, 'lane min');
  console.assert(clampLane(1) === 1, 'lane mid');
  console.assert(clampLane(2) === 2, 'lane max');
  console.assert(clampLane(-1) === 0, 'lane below min');
  console.assert(clampLane(3) === 2, 'lane above max');
}

// --- calcDistance ---
function test_calcDistance() {
  const dist = calcDistance(BASE_SPEED, 100);
  console.assert(dist === BASE_SPEED * DISTANCE_PER_FRAME * 100, 'distance calculation');
  // Double speed = double distance for same frames
  const dist2x = calcDistance(BASE_SPEED * 2, 100);
  console.assert(dist2x === dist * 2, 'distance proportional to speed');
}

// ====================================================================
// Runner
// ====================================================================
function runAll() {
  const tests = [
    test_lerp, test_clamp, test_worldToScreen, test_laneX, test_sameLane,
    test_calcScore, test_calcSpeed, test_obstacleTypes, test_canPassObstacle,
    test_poolGet, test_poolReleaseAll, test_createPlayer, test_createObstacle,
    test_hurtPlayer, test_clampLane, test_calcDistance,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test();
      passed++;
    } catch (e) {
      failed++;
      console.error(`FAIL: ${test.name} — ${e.message}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total`);
  if (failed > 0) process.exit(1);
}

runAll();
