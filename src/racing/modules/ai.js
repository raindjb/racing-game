// === ai.js — Racing Game ===
// AI opponent cars with path-following behavior, personality, and rendering.
// Attaches to window.R. Assumes R.canvas, R.ctx, R.CONFIG, R.track, R.camera,
// R.state, R.input already exist.

(function() {
  'use strict';
  var R = window.R;

  /* ==========================================================================
     Constants — all tunable AI values
     ========================================================================== */

  /** Default AI config values (merged into R.CONFIG if not already set) */
  const AI_DEFAULTS = {
    AI_COUNT: 7,
    AI_DRIVER_NAMES: [
      'T.Kobayashi', 'M.Sato', 'H.Tanaka', 'R.Yamamoto',
      'S.Nakamura', 'K.Takahashi', 'A.Watanabe', 'J.Ito',
      'Y.Suzuki', 'D.Fujita', 'B.Shimizu', 'C.Mori',
      'E.Kimura', 'F.Inoue', 'G.Aoki', 'I.Yoshida'
    ],
    AI_COLORS: [
      '#e63946', '#457b9d', '#2a9d8f', '#e9c46a',
      '#f4a261', '#264653', '#d4a373', '#bc6c25',
      '#7209b7', '#f72585', '#4cc9f0', '#4361ee'
    ],
    AI_AGGRESSION_RANGE: [0.2, 0.9],
    AI_SKILL_MIN: 0.4,
    AI_SKILL_MAX: 0.95,
    AI_LOOKAHEAD_BASE: 280,
    AI_LOOKAHEAD_SPEED_FACTOR: 2.5,
    AI_STEER_SMOOTH: 0.08,
    AI_STEER_SMOOTH_HIGH_SKILL: 0.14,
    AI_BRAKE_CURVATURE_THRESHOLD: 0.008,
    AI_BRAKE_HARD_CURVATURE: 0.025,
    AI_OVERTAKE_RANGE: 220,
    AI_DEFEND_RANGE: 200,
    AI_OFFTRACK_THRESHOLD: 60,
    AI_RUBBERBAND_FACTOR: 0.05,
    AI_RUBBERBAND_RANGE: 600,
    AI_STAGGER_DISTANCE: 120,
    AI_NAME_TAG_OFFSET_Y: -42,
    AI_BADGE_RADIUS: 8,
    AI_MAX_SPEED_VARIANCE: 0.92,
    AI_ACCELERATION_VARIANCE: 0.88
  };

  /* Merge defaults into R.CONFIG */
  for (const key in AI_DEFAULTS) {
    if (R.CONFIG[key] === undefined) {
      R.CONFIG[key] = AI_DEFAULTS[key];
    }
  }

  /* ==========================================================================
     AI Car Array
     ========================================================================== */

  R.aiCars = [];

  /* ==========================================================================
     Internal utility helpers
     ========================================================================== */

  /**
   * Clamp value between min and max.
   * @param {number} v
   * @param {number} lo
   * @param {number} hi
   * @returns {number}
   */
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  /**
   * Linear interpolation.
   * @param {number} a
   * @param {number} b
   * @param {number} t
   * @returns {number}
   */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Random float in [min, max).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  /**
   * Random element from an array.
   * @param {any[]} arr
   * @returns {any}
   */
  function randChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Normalize an angle to [-PI, PI].
   * @param {number} a
   * @returns {number}
   */
  function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  /**
   * Calculate shortest signed angle difference from current to target.
   * @param {number} current
   * @param {number} target
   * @returns {number} delta in [-PI, PI]
   */
  function angleDelta(current, target) {
    return normalizeAngle(target - current);
  }

  /**
   * Distance between two world points (xz plane — racing plane).
   * @param {number} x1
   * @param {number} z1
   * @param {number} x2
   * @param {number} z2
   * @returns {number}
   */
  function dist2D(x1, z1, x2, z2) {
    const dx = x1 - x2;
    const dz = z1 - z2;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /* ==========================================================================
     Track navigation helpers
     ========================================================================== */

  /**
   * Get the track segment at a given worldZ position.
   * Segments are assumed to be ordered by worldZ (increasing).
   * @param {number} worldZ
   * @returns {{ segment: object, index: number }|null}
   */
  function getSegmentAtZ(worldZ) {
    const segs = R.track.segments;
    if (!segs || segs.length === 0) return null;
    /* Binary-ish search for the segment containing this z */
    /**
     * Track segments define the road ahead. We find the segment whose
     * cumulative z range contains worldZ. Assumes segments are sequential.
     */
    let cumulativeZ = 0;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const segLength = seg.length || 200; // default segment length
      if (worldZ >= cumulativeZ && worldZ < cumulativeZ + segLength) {
        return { segment: seg, index: i, localZ: worldZ - cumulativeZ, segStartZ: cumulativeZ };
      }
      cumulativeZ += segLength;
    }
    /* Wrap around for looping track */
    if (segs.length > 0) {
      cumulativeZ = 0;
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        const segLength = seg.length || 200;
        cumulativeZ += segLength;
      }
      const wrappedZ = ((worldZ % cumulativeZ) + cumulativeZ) % cumulativeZ;
      let cz = 0;
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        const segLength = seg.length || 200;
        if (wrappedZ >= cz && wrappedZ < cz + segLength) {
          return { segment: seg, index: i, localZ: wrappedZ - cz, segStartZ: cz };
        }
        cz += segLength;
      }
    }
    return null;
  }

  /**
   * Calculate the cumulative distance traveled (z) by following the track.
   * For AI position sorting, we use worldZ as the primary sort key.
   * Accounts for lap count.
   * @param {object} car
   * @returns {number} total distance traveled
   */
  function getTotalDistance(car) {
    const segs = R.track.segments;
    if (!segs || segs.length === 0) return car.z || car.y || 0;
    let trackLength = 0;
    for (let i = 0; i < segs.length; i++) {
      trackLength += segs[i].length || 200;
    }
    return (car.lap || 0) * trackLength + (car.z || car.y || 0);
  }

  /**
   * Get the worldX center of the track at a given position.
   * Accounts for curvature to offset the center line.
   * @param {number} worldZ
   * @param {number} lookaheadZ — how far ahead to look
   * @returns {{ x: number, curvature: number }}
   */
  function getTrackCenterAt(worldZ, lookaheadZ) {
    const zTarget = worldZ + lookaheadZ;
    const segInfo = getSegmentAtZ(zTarget);
    if (!segInfo) {
      return { x: 400, curvature: 0 }; // default center
    }
    const seg = segInfo.segment;
    /* Accumulate lateral offset from curvature of preceding segments */
    let totalCurveOffset = 0;
    let totalCurvature = 0;
    const segs = R.track.segments;
    let cz = 0;
    for (let i = 0; i < segs.length && cz < zTarget; i++) {
      const s = segs[i];
      const sLen = s.length || 200;
      if (cz < worldZ) {
        cz += sLen;
        continue;
      }
      const endZ = cz + sLen;
      const overlapStart = Math.max(cz, worldZ);
      const overlapEnd = Math.min(endZ, zTarget);
      if (overlapEnd > overlapStart) {
        const frac = (overlapEnd - overlapStart) / (zTarget - worldZ);
        totalCurveOffset += (s.curvature || 0) * frac * sLen;
        totalCurvature += (s.curvature || 0) * frac;
      }
      cz += sLen;
      if (cz >= zTarget) break;
    }
    /* Segments have worldX — use the current segment's worldX plus curvature offset */
    const segX = seg.worldX !== undefined ? seg.worldX : 400;
    return { x: segX + totalCurveOffset * 0.5, curvature: totalCurvature };
  }

  /**
   * Get the weighted average curvature of upcoming segments.
   * Used for pre-braking decisions.
   * @param {number} worldZ — current z position
   * @param {number} lookDistance — how far ahead to scan
   * @returns {number} average absolute curvature (0 = straight, >0 = curve)
   */
  function getUpcomingCurvature(worldZ, lookDistance) {
    const segs = R.track.segments;
    if (!segs || segs.length === 0) return 0;
    let totalWeight = 0;
    let weightedCurv = 0;
    let cz = 0;
    const endZ = worldZ + lookDistance;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const sLen = s.length || 200;
      const segEnd = cz + sLen;
      if (segEnd > worldZ && cz < endZ) {
        const overlapStart = Math.max(cz, worldZ);
        const overlapEnd = Math.min(segEnd, endZ);
        if (overlapEnd > overlapStart) {
          /* Closer segments weighted more heavily */
          const dist = overlapStart - worldZ;
          const weight = (lookDistance - dist) / lookDistance * (overlapEnd - overlapStart);
          weightedCurv += Math.abs(s.curvature || 0) * weight;
          totalWeight += weight;
        }
      }
      cz += sLen;
      if (cz >= endZ) break;
    }
    return totalWeight > 0 ? weightedCurv / totalWeight : 0;
  }

  /**
   * Calculate total track length (one lap).
   * @returns {number}
   */
  function trackLength() {
    const segs = R.track.segments;
    if (!segs || segs.length === 0) return 10000;
    let len = 0;
    for (let i = 0; i < segs.length; i++) {
      len += segs[i].length || 200;
    }
    return len;
  }

  /* ==========================================================================
     R.initAI() — Create AI opponent cars
     ========================================================================== */

  /**
   * Initialize all AI cars. Creates R.CONFIG.AI_COUNT cars with random
   * driver names, colors, aggression, and skill levels.
   * Positions AI cars at staggered z-distances behind the player.
   */
  R.initAI = function() {
    R.aiCars = [];
    const count = R.CONFIG.AI_COUNT || 7;
    const names = R.CONFIG.AI_DRIVER_NAMES;
    const colors = R.CONFIG.AI_COLORS;
    /* Shuffle names and colors for variety */
    const shuffledNames = [...names].sort(function() { return Math.random() - 0.5; });
    const shuffledColors = [...colors].sort(function() { return Math.random() - 0.5; });
    const tLen = trackLength();
    const aggRange = R.CONFIG.AI_AGGRESSION_RANGE || [0.2, 0.9];
    const skillMin = R.CONFIG.AI_SKILL_MIN || 0.4;
    const skillMax = R.CONFIG.AI_SKILL_MAX || 0.95;

    for (let i = 0; i < count; i++) {
      const skill = randRange(skillMin, skillMax);
      /* Base car properties (same shape as player car) */
      const car = {
        /* World position */
        x: R.CONFIG.TRACK_CENTER_X || 400,
        y: 0,
        z: -R.CONFIG.AI_STAGGER_DISTANCE * (i + 1),
        angle: 0,
        speed: 0,
        steerAngle: 0,
        driftFactor: 0,
        /* Race state */
        lap: 0,
        checkpointIdx: 0,
        finished: false,
        /* Visual */
        color: shuffledColors[i % shuffledColors.length],
        /* Performance (tuned per-car) */
        maxSpeed: (R.CONFIG.CAR_MAX_SPEED || 12) * lerp(R.CONFIG.AI_MAX_SPEED_VARIANCE, 1.0, skill),
        acceleration: (R.CONFIG.CAR_ACCELERATION || 0.15) * lerp(R.CONFIG.AI_ACCELERATION_VARIANCE, 1.0, skill),
        braking: (R.CONFIG.CAR_BRAKING || 0.3),
        handling: (R.CONFIG.CAR_HANDLING || 0.04) * skill,
        /* AI-specific fields */
        driverName: shuffledNames[i % shuffledNames.length],
        aggression: randRange(aggRange[0], aggRange[1]),
        skillLevel: skill,
        targetSpeed: 0,
        state: 'racing',        // 'racing' | 'overtaking' | 'defending' | 'recovering'
        stateTimer: 0,
        prevSteer: 0,
        brakeLevel: 0,
        prevWorldZ: -R.CONFIG.AI_STAGGER_DISTANCE * (i + 1),
        totalDistance: 0,
        overtakeTarget: null,   // reference to car being overtaken
        defendAgainst: null,    // reference to car defending against
        recoveryTimer: 0,
        /* Visual animation */
        wheelRotation: 0,
        bodyBob: 0,
        bobPhase: Math.random() * Math.PI * 2
      };

      /* Car-specific tuning: slightly randomize handling feel */
      car.maxSpeed += randRange(-0.3, 0.3);
      car.acceleration += randRange(-0.02, 0.02);
      car.handling = clamp(car.handling, 0.02, 0.1);

      R.aiCars.push(car);
    }

    /* Position AI cars ahead or behind based on skill (faster in front) */
    /* Sort by skill so faster cars start nearer the front */
    R.aiCars.sort(function(a, b) { return b.skillLevel - a.skillLevel; });
    const stagger = R.CONFIG.AI_STAGGER_DISTANCE;
    for (let i = 0; i < R.aiCars.length; i++) {
      R.aiCars[i].z = -(stagger * (i + 1));
      R.aiCars[i].prevWorldZ = R.aiCars[i].z;
    }
  };

  /* ==========================================================================
     R.updateAI(dt) — Main AI update per frame
     ========================================================================== */

  /**
   * Update all AI cars each frame.
   * @param {number} dt — delta time in seconds
   */
  R.updateAI = function(dt) {
    if (R.state.phase !== 'racing') { return; }
    if (!R.aiCars || R.aiCars.length === 0) { return; }

    const dtClamped = Math.min(dt, 0.05); // cap to prevent physics explosion
    const allCars = getAllCars(); // player + AI for interaction

    for (let i = 0; i < R.aiCars.length; i++) {
      const ai = R.aiCars[i];
      if (ai.finished) { continue; }

      updateAISingle(ai, i, dtClamped, allCars);
    }
  };

  /**
   * Update a single AI car for one frame.
   * @param {object} ai
   * @param {number} index
   * @param {number} dt
   * @param {object[]} allCars
   */
  function updateAISingle(ai, index, dt, allCars) {
    /* ---- Step 1: Find target position ahead on track ---- */
    const lookaheadDist = R.CONFIG.AI_LOOKAHEAD_BASE
      + ai.speed * R.CONFIG.AI_LOOKAHEAD_SPEED_FACTOR * ai.skillLevel;
    const trackInfo = getTrackCenterAt(ai.z, lookaheadDist);
    const upcomingCurv = getUpcomingCurvature(ai.z, lookaheadDist);

    /* ---- Step 2: Calculate desired angle to target ---- */
    const targetX = trackInfo.x;
    const targetZ = ai.z + lookaheadDist;
    const currentX = ai.x;
    const dx = targetX - currentX;
    const dz = targetZ - ai.z;

    let desiredAngle = Math.atan2(dx, dz);

    /* Racing line optimization: skilled drivers hug the inside of curves */
    if (trackInfo.curvature !== 0 && ai.skillLevel > 0.55) {
      const curveSign = trackInfo.curvature > 0 ? 1 : -1;
      const lineOffset = curveSign * R.track.segments[0].width * 0.15 * ai.skillLevel;
      desiredAngle = Math.atan2(dx + lineOffset, dz);
    }

    /* ---- Step 3: Steer toward desired angle ---- */
    const angleErr = angleDelta(ai.angle, desiredAngle);
    const steerSmooth = lerp(
      R.CONFIG.AI_STEER_SMOOTH,
      R.CONFIG.AI_STEER_SMOOTH_HIGH_SKILL,
      ai.skillLevel
    );

    /* Aggressive AIs turn faster */
    const aggressionSteerMul = 0.7 + ai.aggression * 0.6;
    let targetSteer = clamp(angleErr * steerSmooth * 15 * aggressionSteerMul, -1, 1);

    /* Smoother transition for high-skill drivers */
    ai.steerAngle = lerp(ai.prevSteer, targetSteer, steerSmooth * 3);
    ai.prevSteer = ai.steerAngle;

    /* ---- Step 4: AI state transitions ---- */
    updateAIState(ai, allCars, upcomingCurv);

    /* ---- Step 5: Speed control based on state and upcoming road ---- */
    updateAISpeed(ai, dt, upcomingCurv, trackInfo);

    /* ---- Step 6: Apply physics (same as player car physics) ---- */
    applyCarPhysics(ai, dt);

    /* ---- Step 7: Lap and checkpoint detection ---- */
    updateAILapProgress(ai);

    /* ---- Step 8: Off-track recovery ---- */
    handleOffTrack(ai, dt);
  }

  /* ==========================================================================
     AI State Machine
     ========================================================================== */

  /**
   * Determine and transition AI state.
   * @param {object} ai
   * @param {object[]} allCars
   * @param {number} upcomingCurv
   */
  function updateAIState(ai, allCars, upcomingCurv) {
    /* Check for car ahead within overtaking range */
    const carAhead = findCarAhead(ai, allCars, R.CONFIG.AI_OVERTAKE_RANGE);

    /* Check for car behind within defending range */
    const carBehind = findCarBehind(ai, allCars, R.CONFIG.AI_DEFEND_RANGE);

    /* Check if off track */
    const segInfo = getSegmentAtZ(ai.z);
    const offTrack = isOffTrack(ai, segInfo);

    /* State transitions */
    if (offTrack && ai.state !== 'recovering') {
      ai.state = 'recovering';
      ai.recoveryTimer = 60;
    } else if (ai.state === 'recovering') {
      ai.recoveryTimer--;
      if (!offTrack && ai.recoveryTimer <= 0) {
        ai.state = 'racing';
      }
    } else if (carAhead && ai.aggression > 0.35 && !offTrack) {
      /* Only attempt overtaking if car ahead is slower */
      if (carAhead.speed < ai.speed * 1.05 || ai.aggression > 0.65) {
        ai.state = 'overtaking';
        ai.overtakeTarget = carAhead;
      } else {
        ai.state = 'racing';
        ai.overtakeTarget = null;
      }
    } else if (carBehind && carBehind.aggression > 0.5 && ai.aggression > 0.3 && !offTrack) {
      /* Defensive driving: block if someone aggressive is behind */
      ai.state = 'defending';
      ai.defendAgainst = carBehind;
    } else {
      ai.state = 'racing';
      ai.overtakeTarget = null;
      ai.defendAgainst = null;
    }

    /* State timer tracking */
    if (ai.state === 'overtaking') {
      ai.stateTimer++;
    } else if (ai.state === 'defending') {
      ai.stateTimer++;
    } else {
      ai.stateTimer = 0;
    }
  }

  /**
   * Find the nearest car ahead of this AI within range.
   * @param {object} ai
   * @param {object[]} allCars
   * @param {number} range
   * @returns {object|null}
   */
  function findCarAhead(ai, allCars, range) {
    let closest = null;
    let closestDist = range;
    for (let i = 0; i < allCars.length; i++) {
      const other = allCars[i];
      if (other === ai) { continue; }
      if (other.finished) { continue; }
      const dz = other.z - ai.z;
      if (dz > 0 && dz < range) {
        const dx = Math.abs(other.x - ai.x);
        if (dx < 50 && dz < closestDist) {
          closestDist = dz;
          closest = other;
        }
      }
    }
    return closest;
  }

  /**
   * Find the nearest car behind this AI within range.
   * @param {object} ai
   * @param {object[]} allCars
   * @param {number} range
   * @returns {object|null}
   */
  function findCarBehind(ai, allCars, range) {
    let closest = null;
    let closestDist = range;
    for (let i = 0; i < allCars.length; i++) {
      const other = allCars[i];
      if (other === ai) { continue; }
      if (other.finished) { continue; }
      const dz = ai.z - other.z;
      if (dz > 0 && dz < range) {
        const dx = Math.abs(other.x - ai.x);
        if (dx < 50 && dz < closestDist) {
          closestDist = dz;
          closest = other;
        }
      }
    }
    return closest;
  }

  /**
   * Check if an AI car is off the track.
   * @param {object} ai
   * @param {object|null} segInfo
   * @returns {boolean}
   */
  function isOffTrack(ai, segInfo) {
    if (!segInfo) { return false; }
    const seg = segInfo.segment;
    const halfWidth = (seg.width || 120) / 2;
    const centerX = seg.worldX !== undefined ? seg.worldX : 400;
    const distFromCenter = Math.abs(ai.x - centerX);
    return distFromCenter > halfWidth + R.CONFIG.AI_OFFTRACK_THRESHOLD;
  }

  /* ==========================================================================
     AI Speed Control
     ========================================================================== */

  /**
   * Control AI speed based on road conditions and state.
   * @param {object} ai
   * @param {number} dt
   * @param {number} upcomingCurv
   * @param {{ x: number, curvature: number }} trackInfo
   */
  function updateAISpeed(ai, dt, upcomingCurv, trackInfo) {
    const brakeCurvThresh = R.CONFIG.AI_BRAKE_CURVATURE_THRESHOLD;
    const brakeHardCurv = R.CONFIG.AI_BRAKE_HARD_CURVATURE;

    /* Target speed based on upcoming curvature */
    let idealSpeed = ai.maxSpeed;

    /* Pre-brake for upcoming corners */
    if (upcomingCurv > brakeCurvThresh) {
      /* Skilled drivers brake less before corners */
      const brakeFactor = 1 - (ai.skillLevel * 0.5);
      const curvRatio = clamp(
        (upcomingCurv - brakeCurvThresh) / (brakeHardCurv - brakeCurvThresh),
        0, 1
      );
      const speedReduction = curvRatio * ai.maxSpeed * 0.6 * brakeFactor;
      idealSpeed = ai.maxSpeed - speedReduction;
      /* Hard brake for tight corners */
      if (upcomingCurv > brakeHardCurv * 0.7) {
        idealSpeed = ai.maxSpeed * 0.35 * (1 + ai.skillLevel * 0.5);
      }
    }

    /* Curve negotiation: skilled drivers can corner faster */
    const currentCurv = Math.abs(trackInfo.curvature);
    if (currentCurv > brakeCurvThresh * 0.3) {
      const cornerSpeedPenalty = currentCurv * 400 * (1 - ai.skillLevel * 0.6);
      idealSpeed = Math.min(idealSpeed, ai.maxSpeed - cornerSpeedPenalty);
    }

    /* State-specific speed adjustments */
    if (ai.state === 'overtaking') {
      /* Push harder when overtaking */
      idealSpeed = Math.min(idealSpeed * 1.08, ai.maxSpeed * 1.02);
      /* High aggression: more speed, less caution */
      if (ai.aggression > 0.7) {
        idealSpeed *= 1.05;
      }
    } else if (ai.state === 'defending') {
      /* Slightly faster to maintain position */
      idealSpeed = Math.min(idealSpeed * 1.03, ai.maxSpeed * 0.98);
    } else if (ai.state === 'recovering') {
      /* Slow down to regain control */
      idealSpeed = ai.maxSpeed * 0.45;
    }

    /* Overtaking: steer to inside of approaching curve if car ahead is slower */
    if (ai.state === 'overtaking' && ai.overtakeTarget && trackInfo.curvature !== 0) {
      const curveSign = trackInfo.curvature > 0 ? 1 : -1;
      /* Inside line on curves */
      const insideOffset = -curveSign * 25;
      ai.steerAngle += insideOffset * 0.015 * ai.aggression;
      ai.steerAngle = clamp(ai.steerAngle, -1, 1);
    }

    /* Defending: block the racing line */
    if (ai.state === 'defending') {
      /* Position car in the middle to block overtaking attempts */
      const segInfo = getSegmentAtZ(ai.z);
      if (segInfo) {
        const centerX = segInfo.segment.worldX || 400;
        if (Math.abs(ai.x - centerX) < 20) {
          /* Stay near center to block the racing line */
          ai.steerAngle *= 0.8;
        }
      }
    }

    /* ---- Rubber-banding: subtle speed adjustment ---- */
    idealSpeed = applyRubberBanding(ai, idealSpeed);

    /* ---- Apply acceleration or braking to reach ideal speed ---- */
    ai.targetSpeed = idealSpeed;
    const speedDiff = idealSpeed - ai.speed;

    if (speedDiff > 0) {
      /* Accelerate */
      ai.speed += ai.acceleration * dt * 60;
      ai.brakeLevel = 0;
    } else {
      /* Brake */
      const brakeForce = ai.braking * (1 + (1 - ai.skillLevel) * 0.5);
      ai.speed += Math.max(speedDiff, -brakeForce * dt * 60);
      ai.brakeLevel = Math.min(1, Math.abs(speedDiff) / ai.maxSpeed * 2);
    }

    /* Ensure minimum speed */
    if (ai.speed < 0.5 && ai.state !== 'recovering') {
      ai.speed = 0.5;
    }
    ai.speed = clamp(ai.speed, 0, ai.maxSpeed * 1.1);
  }

  /**
   * Subtle rubber-banding: AI speeds up slightly if player is far ahead,
   * slows down slightly if player is far behind.
   * @param {object} ai
   * @param {number} idealSpeed
   * @returns {number} adjusted speed
   */
  function applyRubberBanding(ai, idealSpeed) {
    const playerCar = R.playerCar;
    if (!playerCar || playerCar.finished) { return idealSpeed; }

    const aiDist = getTotalDistance(ai);
    const playerDist = getTotalDistance(playerCar);
    const gap = playerDist - aiDist; // positive = player ahead
    const bandRange = R.CONFIG.AI_RUBBERBAND_RANGE;
    const bandFactor = R.CONFIG.AI_RUBBERBAND_FACTOR;

    if (Math.abs(gap) > bandRange) {
      if (gap > 0) {
        /* Player is far ahead — AI gets a slight boost */
        return idealSpeed * (1 + bandFactor);
      } else {
        /* Player is far behind — AI slows a tiny bit */
        return idealSpeed * (1 - bandFactor * 0.5);
      }
    }
    return idealSpeed;
  }

  /**
   * Get all cars (player + AI) in a unified array for interaction.
   * @returns {object[]}
   */
  function getAllCars() {
    const cars = [];
    if (R.playerCar) { cars.push(R.playerCar); }
    for (let i = 0; i < R.aiCars.length; i++) {
      cars.push(R.aiCars[i]);
    }
    return cars;
  }

  /* ==========================================================================
     Car Physics (mirrors player physics)
     ========================================================================== */

  /**
   * Apply the same car physics as the player to an AI car.
   * Updates ai.x, ai.z, ai.angle, ai.speed, ai.driftFactor.
   * @param {object} car — AI car (or player car shape)
   * @param {number} dt
   */
  function applyCarPhysics(car, dt) {
    const speed = car.speed || 0;
    const steer = car.steerAngle || 0;
    const handling = car.handling || 0.04;

    if (speed < 0.01 && (R.input && R.input.throttle === 0)) {
      car.driftFactor = 0;
      return;
    }

    /* Friction */
    const friction = 0.98;
    car.speed *= friction;

    /* Drift physics */
    const steerStrength = steer * handling * speed * 0.5;
    car.driftFactor += steerStrength;
    car.driftFactor *= 0.96; // drift recovery
    car.driftFactor = clamp(car.driftFactor, -speed * 0.35, speed * 0.35);

    /* Update angle */
    car.angle += car.driftFactor * dt * 3;

    /* Update position */
    const forwardX = Math.sin(car.angle) * car.speed * dt * 60;
    const forwardZ = Math.cos(car.angle) * car.speed * dt * 60;

    car.x += forwardX;
    car.z += forwardZ;

    /* Update distance tracking */
    car.totalDistance = getTotalDistance(car);

    /* Clamp speed */
    car.speed = clamp(car.speed, 0, car.maxSpeed * 1.15);
  }

  /* ==========================================================================
     Lap / Checkpoint tracking
     ========================================================================== */

  /**
   * Track lap progress and checkpoint crossing.
   * @param {object} ai
   */
  function updateAILapProgress(ai) {
    const tLen = trackLength();
    if (tLen <= 0) { return; }

    /* Detect lap crossing */
    const prevZ = ai.prevWorldZ || ai.z;
    if (prevZ < tLen * 0.5 && ai.z >= tLen * 0.9) {
      /* Wrapped around? Check if close to track length */
    }
    if (ai.z >= tLen) {
      ai.lap = (ai.lap || 0) + 1;
      ai.z -= tLen;
      const total = R.track.totalLaps || 3;
      const segs = R.track.segments;
      if (!segs) return;
      if (ai.lap >= total) {
        ai.finished = true;
        ai.speed = 0;
      }
    } else if (ai.z < 0 && (ai.lap || 0) > 0) {
      /* Crossed finish line going forward */
      const total = R.track.totalLaps || 3;
      if (ai.lap >= total) {
        ai.finished = true;
        ai.speed = 0;
        ai.z = tLen;
      }
    }
    ai.prevWorldZ = ai.z;
  }

  /* ==========================================================================
     Off-track recovery
     ========================================================================== */

  /**
   * Steer back toward the track when off-road.
   * @param {object} ai
   * @param {number} dt
   */
  function handleOffTrack(ai, dt) {
    const segInfo = getSegmentAtZ(ai.z);
    if (!segInfo) { return; }

    const centerX = segInfo.segment.worldX !== undefined ? segInfo.segment.worldX : 400;
    const halfWidth = (segInfo.segment.width || 120) / 2;
    const distFromCenter = Math.abs(ai.x - centerX);

    if (distFromCenter > halfWidth + 15) {
      ai.state = 'recovering';
      ai.recoveryTimer = Math.max(ai.recoveryTimer, 30);
      /* Reduce speed on rough ground */
      const offTrackPenalty = 1 - Math.min((distFromCenter - halfWidth) / 100, 0.6);
      ai.speed *= lerp(offTrackPenalty, 1, 0.1);
      /* Steer toward track center */
      const toCenter = centerX - ai.x;
      const steerCorrection = clamp(toCenter * 0.02, -0.5, 0.5);
      ai.steerAngle = lerp(ai.steerAngle, steerCorrection, 0.15);
    }
  }

  /* ==========================================================================
     R.renderAICars() — Render all AI cars
     ========================================================================== */

  /**
   * Render all AI cars using the game's coordinate system.
   * Each car shows body in team color, driver name tag, and position badge.
   */
  R.renderAICars = function() {
    if (!R.aiCars || R.aiCars.length === 0) { return; }
    const ctx = R.ctx;

    for (let i = 0; i < R.aiCars.length; i++) {
      const ai = R.aiCars[i];
      if (ai.finished && ai.speed <= 0.05) {
        /* Finished cars still rendered (ghosted slightly) */
        renderSingleAICar(ctx, ai, i, true);
      } else {
        renderSingleAICar(ctx, ai, i, false);
      }
    }
  };

  /**
   * Render a single AI car on the canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} ai
   * @param {number} index — AI index in the array
   * @param {boolean} finished — whether this car has finished
   */
  function renderSingleAICar(ctx, ai, index, finished) {
    /* Convert world position to screen position */
    const screen = R.worldToScreen(ai.x, ai.z, ai.y || 0);
    if (!screen) { return; }
    const sx = screen.x;
    const sy = screen.y;
    const scale = screen.scale;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ai.angle || 0);
    ctx.scale(scale, scale);

    /* Car body dimensions */
    const carW = 48;
    const carH = 24;
    const alpha = finished ? 0.55 : 1;

    ctx.globalAlpha = alpha;

    /* ---- Shadow ---- */
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-carW / 2 + 3, -carH / 2 + 3, carW, carH);

    /* ---- Car body ---- */
    const bodyColor = ai.color || '#e63946';
    drawCarBody(ctx, -carW / 2, -carH / 2, carW, carH, bodyColor);

    /* ---- Windshield ---- */
    ctx.fillStyle = 'rgba(30,40,60,0.85)';
    ctx.beginPath();
    ctx.moveTo(carW / 2 - 8, -carH / 2 + 2);
    ctx.lineTo(carW / 2 - 2, -carH / 2 + 10);
    ctx.lineTo(carW / 2 - 2, carH / 2 - 6);
    ctx.lineTo(carW / 2 - 8, carH / 2 - 2);
    ctx.closePath();
    ctx.fill();

    /* Windshield reflection */
    ctx.fillStyle = 'rgba(150,180,220,0.25)';
    ctx.beginPath();
    ctx.moveTo(carW / 2 - 6, -carH / 2 + 3);
    ctx.lineTo(carW / 2 - 3, -carH / 2 + 9);
    ctx.lineTo(carW / 2 - 3, -carH / 2 + 15);
    ctx.lineTo(carW / 2 - 6, -carH / 2 + 8);
    ctx.closePath();
    ctx.fill();

    /* ---- Rear window ---- */
    ctx.fillStyle = 'rgba(25,30,45,0.75)';
    ctx.fillRect(-carW / 2 + 3, -carH / 2 + 3, 8, carH - 6);

    /* ---- Racing stripe ---- */
    ctx.fillStyle = isLightColor(bodyColor)
      ? 'rgba(0,0,0,0.15)'
      : 'rgba(255,255,255,0.2)';
    ctx.fillRect(-3, -carH / 2 + 1, 6, carH - 2);
    ctx.fillRect(-6, -carH / 2 + 1, 2, carH - 2);
    ctx.fillRect(4, -carH / 2 + 1, 2, carH - 2);

    /* ---- Wheels ---- */
    drawCarWheel(ctx, -carW / 2 - 2, -carH / 2 + 5, 5, 8, ai.wheelRotation);
    drawCarWheel(ctx, -carW / 2 - 2,  carH / 2 - 5, 5, 8, ai.wheelRotation);
    drawCarWheel(ctx,  carW / 2 + 2, -carH / 2 + 5, 5, 8, ai.wheelRotation);
    drawCarWheel(ctx,  carW / 2 + 2,  carH / 2 - 5, 5, 8, ai.wheelRotation);

    /* ---- Exhaust flame (when accelerating) ---- */
    if (ai.brakeLevel <= 0.1 && ai.speed > 1) {
      const flameAlpha = (ai.speed / ai.maxSpeed) * 0.6;
      const flameSize = 4 + (ai.speed / ai.maxSpeed) * 6;
      ctx.fillStyle = 'rgba(255,120,30,' + flameAlpha.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(-carW / 2 - 3, -carH / 2 + 13, flameSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,220,80,' + (flameAlpha * 0.7).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(-carW / 2 - 2 + Math.random(), -carH / 2 + 13 + Math.random(), flameSize * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ---- Brake lights (when braking) ---- */
    if (ai.brakeLevel > 0.15) {
      const brakeAlpha = ai.brakeLevel * 0.9;
      ctx.fillStyle = 'rgba(255,30,20,' + brakeAlpha.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(carW / 2 + 1, -carH / 2 + 5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(carW / 2 + 1, carH / 2 - 5, 3, 0, Math.PI * 2);
      ctx.fill();
      /* Glow */
      ctx.fillStyle = 'rgba(255,40,30,' + (brakeAlpha * 0.4).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(carW / 2 + 1, -carH / 2 + 5, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(carW / 2 + 1, carH / 2 - 5, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ---- Headlights ---- */
    ctx.fillStyle = 'rgba(255,255,200,0.7)';
    ctx.beginPath();
    ctx.arc(-carW / 2 - 1, -carH / 2 + 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-carW / 2 - 1, carH / 2 - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    /* ---- Position badge on roof (drawn in screen space, no rotation) ---- */
    const badgeSize = R.CONFIG.AI_BADGE_RADIUS;
    const badgeX = sx;
    const badgeY = sy - scale * 6;
    /* Badge circle */
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeSize + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeSize, 0, Math.PI * 2);
    ctx.fill();
    /* Position number */
    const position = R.getAIPosition(index);
    ctx.fillStyle = '#111';
    ctx.font = 'bold ' + Math.max(8, badgeSize * 1.2) + 'px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(position.toString(), badgeX, badgeY + 0.5);

    /* ---- Driver name tag above car ---- */
    const nameY = sy + R.CONFIG.AI_NAME_TAG_OFFSET_Y * scale;
    const fontSize = Math.max(9, Math.round(11 * Math.min(scale, 1.2)));
    ctx.font = 'bold ' + fontSize + 'px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const name = ai.driverName || 'Driver';
    const textWidth = ctx.measureText(name).width;

    /* Name tag background */
    const tagPadX = 4;
    const tagPadY = 2;
    const tagY = nameY - fontSize * 0.2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx,
      sx - textWidth / 2 - tagPadX,
      tagY - fontSize - tagPadY,
      textWidth + tagPadX * 2,
      fontSize + tagPadY * 2,
      3
    );
    ctx.fill();

    /* Name text with outline */
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText(name, sx, nameY);
    ctx.fillStyle = '#fff';
    ctx.fillText(name, sx, nameY);

    /* ---- State indicator (small dot for overtaking/defending) ---- */
    if (ai.state === 'overtaking' || ai.state === 'defending') {
      const dotY = tagY - fontSize - 8;
      const dotColor = ai.state === 'overtaking' ? '#ff6644' : '#44aaff';
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(sx, dotY, 3, 0, Math.PI * 2);
      ctx.fill();
      /* Pulsing ring */
      const pulsePhase = (Date.now() * 0.004) % (Math.PI * 2);
      const pulseAlpha = 0.3 + Math.sin(pulsePhase) * 0.3;
      ctx.strokeStyle = dotColor.replace(')', ', ' + pulseAlpha.toFixed(2) + ')')
        .replace('rgb', 'rgba');
      if (dotColor.startsWith('#')) {
        ctx.strokeStyle = dotColor + Math.round(pulseAlpha * 255).toString(16).padStart(2, '0');
      }
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, dotY, 5 + Math.sin(pulsePhase + 0.5), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  /**
   * Draw the main car body shape.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x — top-left x
   * @param {number} y — top-left y
   * @param {number} w — width
   * @param {number} h — height
   * @param {string} color — body color
   */
  function drawCarBody(ctx, x, y, w, h, color) {
    /* Main body with slightly rounded front/back */
    ctx.fillStyle = color;
    ctx.beginPath();
    const r = 4;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();

    /* Body highlight (top edge) */
    const lighter = lightenColor(color, 0.25);
    ctx.fillStyle = lighter;
    ctx.fillRect(x + 8, y + 1, w - 16, 3);

    /* Body shadow (bottom edge) */
    const darker = darkenColor(color, 0.2);
    ctx.fillStyle = darker;
    ctx.fillRect(x + 5, y + h - 3, w - 10, 2);

    /* Body outline */
    ctx.strokeStyle = darker;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.stroke();
  }

  /**
   * Draw a single car wheel.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx — center x
   * @param {number} cy — center y
   * @param {number} w — wheel width
   * @param {number} h — wheel height
   * @param {number} rotation — wheel rotation offset
   */
  function drawCarWheel(ctx, cx, cy, w, h, rotation) {
    /* Tire */
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    /* Tread detail */
    ctx.fillStyle = '#2a2a2a';
    const treadCount = 3;
    for (let t = 0; t < treadCount; t++) {
      const ty = cy - h / 2 + 2 + t * (h - 4) / (treadCount - 1);
      ctx.fillRect(cx - w / 2 + 1, ty, w - 2, 1.5);
    }
    /* Rim highlight */
    ctx.fillStyle = '#444';
    ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
  }

  /* ==========================================================================
     Screen coordinate transform
     ========================================================================== */

  /**
   * Convert world (x, z, y) to screen (x, y) with perspective scale.
   * Uses the camera position to offset.
   * @param {number} wx
   * @param {number} wz
   * @param {number} wy — elevation
   * @returns {{ x: number, y: number, scale: number }}
   */
  function worldToScreenPos(wx,wz,wy){return R.worldToScreen(wx,wy,wz);}

  /* ==========================================================================
     R.sortCarsByPosition() — Sort all cars by total distance traveled
     ========================================================================== */

  /**
   * Sort all cars (player + AI) by total distance traveled (descending).
   * Accounts for lap count and z position.
   * @returns {object[]} sorted array of car objects with position metadata
   */
  R.sortCarsByPosition = function() {
    const cars = [];
    if (R.playerCar) {
      cars.push(R.playerCar);
    }
    for (let i = 0; i < R.aiCars.length; i++) {
      cars.push(R.aiCars[i]);
    }

    /* Sort by total distance (descending — farther = higher position) */
    cars.sort(function(a, b) {
      const distA = getTotalDistance(a);
      const distB = getTotalDistance(b);
      if (distB !== distA) { return distB - distA; }
      /* Tie-break: closer to center of track is slightly ahead */
      const centerXA = a.segmentCenterX || 400;
      const centerXB = b.segmentCenterX || 400;
      const offA = Math.abs(a.x - centerXA);
      const offB = Math.abs(b.x - centerXB);
      return offA - offB;
    });

    return cars;
  };

  /* ==========================================================================
     R.getAIPosition(carIndex) — Get 1-based race position of a specific AI
     ========================================================================== */

  /**
   * Return the 1-based race position of the AI car at the given index.
   * @param {number} carIndex — index into R.aiCars array
   * @returns {number} position (1-based), or -1 if not found
   */
  R.getAIPosition = function(carIndex) {
    if (carIndex < 0 || carIndex >= R.aiCars.length) { return -1; }
    const sorted = R.sortCarsByPosition();
    const target = R.aiCars[carIndex];
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] === target) {
        return i + 1;
      }
    }
    return sorted.length; // fallback: last place
  };

  /* ==========================================================================
     Color utility helpers
     ========================================================================== */

  /**
   * Check if a hex color is "light" (for deciding stripe color).
   * @param {string} hex
   * @returns {boolean}
   */
  function isLightColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 160;
  }

  /**
   * Lighten a hex color by a factor.
   * @param {string} hex
   * @param {number} factor — 0 to 1
   * @returns {string}
   */
  function lightenColor(hex, factor) {
    const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) + (255 - parseInt(hex.slice(1, 3), 16)) * factor));
    const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) + (255 - parseInt(hex.slice(3, 5), 16)) * factor));
    const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) + (255 - parseInt(hex.slice(5, 7), 16)) * factor));
    return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
  }

  /**
   * Darken a hex color by a factor.
   * @param {string} hex
   * @param {number} factor — 0 to 1
   * @returns {string}
   */
  function darkenColor(hex, factor) {
    const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (1 - factor)));
    const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (1 - factor)));
    const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (1 - factor)));
    return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
  }

  /**
   * Draw a rounded rectangle path.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} r
   */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

})();

/* ==========================================================================
   Exported functions/objects:
   - R.aiCars[]            — Array of AI car objects
   - R.initAI()            — Create and initialize all AI opponent cars
   - R.updateAI(dt)        — Update all AI cars each frame
   - R.renderAICars()      — Render all AI cars to the canvas
   - R.sortCarsByPosition()— Return all cars sorted by distance traveled
   - R.getAIPosition(idx)  — Get 1-based race position for AI car at index
   ========================================================================== */
