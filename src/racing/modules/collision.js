// === collision.js — Racing Game ===
// Car-to-car and car-to-track collision detection and response.
// Uses AABB broad phase + SAT narrow phase for rotated-rect car bodies.
// Off-track detection with graduated friction penalties.

// ─── Constants (extend R.CONFIG) ───────────────────────────────────────────

R.CONFIG.CAR_WIDTH            = R.CONFIG.CAR_WIDTH            || 40;
R.CONFIG.CAR_HEIGHT           = R.CONFIG.CAR_HEIGHT           || 70;
R.CONFIG.COLLISION_DAMPING    = R.CONFIG.COLLISION_DAMPING    || 0.7;
R.CONFIG.COLLISION_SPEED_LOSS = R.CONFIG.COLLISION_SPEED_LOSS || 0.85;
R.CONFIG.OFFROAD_FRICTION     = R.CONFIG.OFFROAD_FRICTION     || 0.92;
R.CONFIG.OFFROAD_DEEP_PENALTY = R.CONFIG.OFFROAD_DEEP_PENALTY || 0.80;
R.CONFIG.OFFROAD_DEEP_THRESH  = R.CONFIG.OFFROAD_DEEP_THRESH  || 50;
R.CONFIG.MIN_SPEED            = R.CONFIG.MIN_SPEED            || 0.5;
R.CONFIG.MIN_COLLISION_SPEED  = R.CONFIG.MIN_COLLISION_SPEED  || 2.0;
R.CONFIG.SPARK_SPEED_THRESH   = R.CONFIG.SPARK_SPEED_THRESH   || 4.0;
R.CONFIG.MAX_SIMULTANEOUS     = R.CONFIG.MAX_SIMULTANEOUS     || 8;

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Rotate a point (px, py) around origin (ox, oy) by angle (radians).
 */
R._rotatePoint = function(px, py, ox, oy, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = px - ox;
  const dy = py - oy;
  return {
    x: ox + dx * cos - dy * sin,
    y: oy + dx * sin + dy * cos
  };
};

/**
 * Project polygon points onto an axis. Returns { min, max }.
 */
R._projectPolygon = function(points, axisX, axisY) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const dot = points[i].x * axisX + points[i].y * axisY;
    if (dot < min) min = dot;
    if (dot > max) max = dot;
  }
  return { min, max };
};

/**
 * Get the 4 corner points of a car as a rotated rectangle.
 * Car origin (x, y) is the center of the rectangle.
 */
R._getCarCorners = function(car) {
  const hw = R.CONFIG.CAR_WIDTH * 0.5;
  const hh = R.CONFIG.CAR_HEIGHT * 0.5;
  const cx = car.x;
  const cy = car.y;
  const angle = car.angle || 0;

  const local = [
    { x: -hw, y: -hh },
    { x:  hw, y: -hh },
    { x:  hw, y:  hh },
    { x: -hw, y:  hh }
  ];

  const corners = [];
  for (let i = 0; i < 4; i++) {
    corners.push(R._rotatePoint(
      cx + local[i].x, cy + local[i].y, cx, cy, angle
    ));
  }
  return corners;
};

/**
 * Get edge normals of a polygon for SAT (perpendicular to each edge, normalized).
 */
R._getNormals = function(corners) {
  const normals = [];
  for (let i = 0; i < corners.length; i++) {
    const j = (i + 1) % corners.length;
    const edgeX = corners[j].x - corners[i].x;
    const edgeY = corners[j].y - corners[i].y;
    const len = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
    if (len < 0.0001) continue;
    normals.push({ x: -edgeY / len, y: edgeX / len });
  }
  return normals;
};

/**
 * Overlap amount on an axis between two projections.
 * Positive = overlapping, negative/zero = separated.
 */
R._overlapOnAxis = function(projA, projB) {
  return Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
};

// ─── AABB ───────────────────────────────────────────────────────────────────

/**
 * Axis-aligned bounding box for a car. Uses max extent of the rotated rectangle
 * (a conservative circle-bounds approximation).
 *
 * @param {Object} car — { x, y, angle }
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
 */
R.carAABB = function(car) {
  const hw = R.CONFIG.CAR_WIDTH * 0.5;
  const hh = R.CONFIG.CAR_HEIGHT * 0.5;
  const angle = car.angle || 0;
  const absCos = Math.abs(Math.cos(angle));
  const absSin = Math.abs(Math.sin(angle));
  const radiusX = hw * absCos + hh * absSin;
  const radiusY = hw * absSin + hh * absCos;

  return {
    minX: car.x - radiusX,
    maxX: car.x + radiusX,
    minY: car.y - radiusY,
    maxY: car.y + radiusY
  };
};

/**
 * Test if two AABBs overlap.
 */
R._aabbOverlap = function(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
};

// ─── Car-to-Car Collision (SAT) ─────────────────────────────────────────────

/**
 * Detailed collision detection between two cars using Separating Axis Theorem.
 * Each car is a 40x70 rotated rectangle.
 *
 * @param {Object} carA
 * @param {Object} carB
 * @returns {{ hit: boolean, overlapX: number, overlapY: number, depth: number } | null}
 */
R.checkCarToCar = function(carA, carB) {
  // Broad phase: AABB
  if (!R._aabbOverlap(R.carAABB(carA), R.carAABB(carB))) {
    return null;
  }

  // Narrow phase: SAT
  const cornersA = R._getCarCorners(carA);
  const cornersB = R._getCarCorners(carB);
  const axes = R._getNormals(cornersA).concat(R._getNormals(cornersB));

  let minOverlap = Infinity;
  let minAxisX = 0;
  let minAxisY = 0;

  for (let i = 0; i < axes.length; i++) {
    const ax = axes[i].x;
    const ay = axes[i].y;
    const projA = R._projectPolygon(cornersA, ax, ay);
    const projB = R._projectPolygon(cornersB, ax, ay);
    const overlap = R._overlapOnAxis(projA, projB);

    if (overlap <= 0) return null; // separating axis found

    if (overlap < minOverlap) {
      minOverlap = overlap;
      minAxisX = ax;
      minAxisY = ay;
    }
  }

  return {
    hit: true,
    overlapX: minAxisX * minOverlap,
    overlapY: minAxisY * minOverlap,
    depth: minOverlap
  };
};

// ─── Collision Resolution ───────────────────────────────────────────────────

/**
 * Resolve a collision between two cars: push apart and adjust velocities.
 *
 * Push ratios:
 *   - Both moving: 50% each
 *   - One stationary (speed < MIN_SPEED): stationary car gets 70% push,
 *     moving car takes 30%
 *
 * Velocity impulse:
 *   - Relative velocity along collision normal
 *   - Equal-mass damped exchange
 *   - COLLISION_DAMPING applied to both cars' speed
 *
 * @param {Object} carA
 * @param {Object} carB
 * @param {{ overlapX: number, overlapY: number, depth: number }} overlap
 */
R.resolveCollision = function(carA, carB, overlap) {
  const depth = overlap.depth;
  if (depth <= 0) return;

  const speedA = Math.abs(carA.speed || 0);
  const speedB = Math.abs(carB.speed || 0);
  const aStationary = speedA < R.CONFIG.MIN_SPEED;
  const bStationary = speedB < R.CONFIG.MIN_SPEED;

  // Determine push ratios
  let pushRatioA, pushRatioB;
  if (aStationary && !bStationary) {
    pushRatioA = 0.7; pushRatioB = 0.3;
  } else if (bStationary && !aStationary) {
    pushRatioA = 0.3; pushRatioB = 0.7;
  } else {
    pushRatioA = 0.5; pushRatioB = 0.5;
  }

  // Push apart
  carA.x -= overlap.overlapX * pushRatioA;
  carA.y -= overlap.overlapY * pushRatioA;
  carB.x += overlap.overlapX * pushRatioB;
  carB.y += overlap.overlapY * pushRatioB;

  // Velocity exchange
  const nx = overlap.overlapX / (depth || 0.001);
  const ny = overlap.overlapY / (depth || 0.001);

  const vAx = Math.cos(carA.angle || 0) * (carA.speed || 0);
  const vAy = Math.sin(carA.angle || 0) * (carA.speed || 0);
  const vBx = Math.cos(carB.angle || 0) * (carB.speed || 0);
  const vBy = Math.sin(carB.angle || 0) * (carB.speed || 0);

  const relVelN = (vAx - vBx) * nx + (vAy - vBy) * ny;

  // Only resolve if cars are approaching
  if (relVelN > 0) {
    if (!aStationary && !bStationary) {
      // Equal-mass damped exchange: each car moves toward average speed
      const avgSpeed = (carA.speed + carB.speed) / 2;
      carA.speed = avgSpeed - (carA.speed - avgSpeed) * R.CONFIG.COLLISION_DAMPING;
      carB.speed = avgSpeed - (carB.speed - avgSpeed) * R.CONFIG.COLLISION_DAMPING;
    } else if (aStationary) {
      carB.speed *= R.CONFIG.COLLISION_SPEED_LOSS;
      carA.speed = carB.speed * (1 - R.CONFIG.COLLISION_DAMPING) * 0.3;
    } else {
      carA.speed *= R.CONFIG.COLLISION_SPEED_LOSS;
      carB.speed = carA.speed * (1 - R.CONFIG.COLLISION_DAMPING) * 0.3;
    }

    // Both lose energy
    carA.speed *= R.CONFIG.COLLISION_DAMPING;
    carB.speed *= R.CONFIG.COLLISION_DAMPING;
  }

  // Clamp tiny speeds to zero
  if (Math.abs(carA.speed) < R.CONFIG.MIN_SPEED * 0.5) carA.speed = 0;
  if (Math.abs(carB.speed) < R.CONFIG.MIN_SPEED * 0.5) carB.speed = 0;
};

// ─── Boundary Checking ──────────────────────────────────────────────────────

/**
 * Check if a car is off the track and apply penalties.
 *
 * - Uses R.isOnTrack(car.x, car.z) to determine track position
 * - Off track: applies OFFROAD_FRICTION (shallow) or OFFROAD_DEEP_PENALTY (deep)
 * - Deep off track (>50px from edge) + speed > 3: aggressive speed reduction
 * - Spawns dust particles via R.spawnDust()
 * - Sets car._offRoadSteerScale = 0.6 for reduced steering control
 *
 * @param {Object} car
 * @param {number} dt — delta time (seconds), unused but accepted for API compatibility
 */
R.checkCarToBoundary = function(car, dt) {
  if (typeof R.isOnTrack !== 'function') return;

  const carZ = (car.z !== undefined) ? car.z : 0;
  if (R.isOnTrack(car.x, carZ)) {
    car._offTrack = false;
    car._offTrackDepth = 0;
    car._offRoadSteerScale = 1;
    return;
  }

  // Off track — determine depth
  car._offTrack = true;
  const testOffset = R.CONFIG.OFFROAD_DEEP_THRESH;
  let deepOff;

  if (typeof R.isOnTrack === 'function') {
    const probeX = car.x + (car.x > 0 ? -testOffset : testOffset);
    deepOff = !R.isOnTrack(probeX, carZ);
  } else {
    deepOff = false;
  }

  car._offTrackDepth = deepOff ? R.CONFIG.OFFROAD_DEEP_THRESH + 1 : 30;

  // Apply friction
  const friction = deepOff ? R.CONFIG.OFFROAD_DEEP_PENALTY : R.CONFIG.OFFROAD_FRICTION;
  car.speed *= friction;

  // Aggressive scrubbing for fast cars deep off track
  if (deepOff && Math.abs(car.speed) > 3) {
    car.speed *= R.CONFIG.OFFROAD_DEEP_PENALTY;
  }

  if (Math.abs(car.speed) < R.CONFIG.MIN_SPEED * 0.3) {
    car.speed = 0;
  }

  // Dust particles
  if (typeof R.spawnDust === 'function' && Math.abs(car.speed) > 0.5) {
    R.spawnDust(car.x, car.y, deepOff ? 4 : 2);
  }

  // Reduced steering off-road
  car._offRoadSteerScale = 0.6;
};

// ─── Per-Frame Collision Check ──────────────────────────────────────────────

/**
 * Main entry point. Called each frame during 'racing' phase.
 *
 * Pipeline:
 *   1. Gather active cars (player + AI)
 *   2. AABB broad phase → candidate pairs
 *   3. SAT narrow phase → confirmed collisions
 *   4. Sort by overlap depth (deepest first)
 *   5. Resolve each collision (push apart + impulse + effects)
 *   6. Re-check boundaries for all cars (collisions may push cars off track)
 *
 * Edge cases handled:
 *   - Multiple simultaneous collisions: resolved in depth order, max per car = 3
 *   - Very slow collisions: no sparks/sound, just positional nudging
 *   - One car stationary: push ratio biased toward stationary car
 *   - Car pushed off track: boundary re-check after resolution
 */

// Debug/metrics (populated each frame)
R._lastCollisionInfo = null;
R._collisionCountThisFrame = 0;

R.checkCollisions = function() {
  R._collisionCountThisFrame = 0;
  R._lastCollisionInfo = null;

  if (R.state.phase !== 'racing') return;

  // 1. Gather cars
  const cars = [];
  if (R.playerCar) cars.push(R.playerCar);
  if (R.aiCars && R.aiCars.length > 0) {
    for (let i = 0; i < R.aiCars.length; i++) cars.push(R.aiCars[i]);
  }

  if (cars.length < 2) {
    for (let i = 0; i < cars.length; i++) R.checkCarToBoundary(cars[i], 0.016);
    return;
  }

  // 2. AABB broad phase
  const aabbs = [];
  for (let i = 0; i < cars.length; i++) aabbs.push(R.carAABB(cars[i]));

  const candidates = [];
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      if (R._aabbOverlap(aabbs[i], aabbs[j])) {
        candidates.push({ a: cars[i], b: cars[j] });
      }
    }
  }

  if (candidates.length === 0) {
    for (let i = 0; i < cars.length; i++) R.checkCarToBoundary(cars[i], 0.016);
    return;
  }

  // 3. SAT narrow phase
  const collisions = [];
  for (let k = 0; k < candidates.length; k++) {
    const { a, b } = candidates[k];
    const result = R.checkCarToCar(a, b);
    if (result && result.hit) {
      collisions.push({ carA: a, carB: b, overlap: result, depth: result.depth });
    }
  }

  R._collisionCountThisFrame = collisions.length;
  if (collisions.length === 0) {
    for (let i = 0; i < cars.length; i++) R.checkCarToBoundary(cars[i], 0.016);
    return;
  }

  // 4. Sort deepest first
  collisions.sort(function(c1, c2) { return c2.depth - c1.depth; });

  // 5. Resolve collisions
  const maxResolve = Math.min(collisions.length, R.CONFIG.MAX_SIMULTANEOUS);
  const resolvedCars = {};
  const involvedCarKeys = [];

  for (let k = 0; k < maxResolve; k++) {
    const col = collisions[k];

    const keyA = col.carA._id || 'player';
    const keyB = col.carB._id || 'ai_' + R.aiCars.indexOf(col.carB);

    resolvedCars[keyA] = (resolvedCars[keyA] || 0) + 1;
    resolvedCars[keyB] = (resolvedCars[keyB] || 0) + 1;

    // Limit per-car resolutions to prevent jitter
    if (resolvedCars[keyA] > 3 || resolvedCars[keyB] > 3) continue;

    const speedA = Math.abs(col.carA.speed || 0);
    const speedB = Math.abs(col.carB.speed || 0);
    const avgSpeed = (speedA + speedB) / 2;

    // Resolve
    R.resolveCollision(col.carA, col.carB, col.overlap);

    // Effects
    const midpointX = (col.carA.x + col.carB.x) / 2;
    const midpointY = (col.carA.y + col.carB.y) / 2;

    if (avgSpeed > R.CONFIG.SPARK_SPEED_THRESH) {
      const intensity = Math.min(avgSpeed / 20, 1);
      if (typeof R.spawnSparks === 'function') R.spawnSparks(midpointX, midpointY, intensity);
      if (typeof R.playSound === 'function') R.playSound('crash', intensity);
    } else if (avgSpeed > R.CONFIG.MIN_COLLISION_SPEED) {
      const intensity = avgSpeed / R.CONFIG.SPARK_SPEED_THRESH * 0.5;
      if (typeof R.spawnSparks === 'function') R.spawnSparks(midpointX, midpointY, intensity);
      if (typeof R.playSound === 'function') R.playSound('crash', intensity * 0.3);
    }
    // Below MIN_COLLISION_SPEED: no effects, just nudging

    R._lastCollisionInfo = { carA: keyA, carB: keyB, depth: col.depth, avgSpeed: avgSpeed };

    if (involvedCarKeys.indexOf(keyA) === -1) involvedCarKeys.push(keyA);
    if (involvedCarKeys.indexOf(keyB) === -1) involvedCarKeys.push(keyB);
  }

  // 6. Boundary re-check for all cars (collisions may have pushed cars off track)
  const boundaryChecked = {};

  // Check involved cars first
  for (let k = 0; k < maxResolve; k++) {
    const col = collisions[k];
    const keyA = col.carA._id || 'player';
    const keyB = col.carB._id || 'ai_' + R.aiCars.indexOf(col.carB);

    if (!boundaryChecked[keyA]) {
      R.checkCarToBoundary(col.carA, 0.016);
      boundaryChecked[keyA] = true;
    }
    if (!boundaryChecked[keyB]) {
      R.checkCarToBoundary(col.carB, 0.016);
      boundaryChecked[keyB] = true;
    }
  }

  // Then check remaining cars
  for (let i = 0; i < cars.length; i++) {
    const carKey = cars[i]._id || (cars[i] === R.playerCar ? 'player' : 'ai_' + R.aiCars.indexOf(cars[i]));
    if (!boundaryChecked[carKey]) {
      R.checkCarToBoundary(cars[i], 0.016);
      boundaryChecked[carKey] = true;
    }
  }
};

// ─── Exports ────────────────────────────────────────────────────────────────
// Public API (attached to window.R):
//   R.checkCollisions()                        — per-frame entry point
//   R.checkCarToCar(carA, carB)                — SAT collision test
//   R.checkCarToBoundary(car, dt)              — off-track penalty check
//   R.resolveCollision(carA, carB, overlap)    — push apart + impulse
//   R.carAABB(car)                             — AABB bounding box
//
// Internal helpers (on R for testability):
//   R._rotatePoint(px, py, ox, oy, angle)
//   R._projectPolygon(points, axisX, axisY)
//   R._getCarCorners(car)
//   R._getNormals(corners)
//   R._overlapOnAxis(projA, projB)
//   R._aabbOverlap(a, b)
//
// Debug/metrics:
//   R._lastCollisionInfo       — last resolved collision { carA, carB, depth, avgSpeed }
//   R._collisionCountThisFrame — number of active collisions this frame
