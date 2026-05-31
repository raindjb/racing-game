// === effects.js — Racing Game ===
// Visual effects system: particles, sparks, smoke, dust, screen effects.
// All functions attach to window.R.
// Expects: R.CONFIG, R.canvas, R.ctx, R.input, R.camera, R.state already exist.

(function() {
  'use strict';

  var R = window.R;

  // ──────────────────────────────────────────────
  // Constants (extend R.CONFIG if not already set)
  // ──────────────────────────────────────────────

  R.CONFIG = R.CONFIG || {};

  /** Max number of particles in the pool. */
  R.CONFIG.MAX_PARTICLES = R.CONFIG.MAX_PARTICLES || 3072;

  /** Default gravity applied to smoke-type particles per frame-equivalent tick. */
  R.CONFIG.PARTICLE_GRAVITY = R.CONFIG.PARTICLE_GRAVITY || 0.05;

  /** Speed-line activation threshold: fraction of maxSpeed. */
  R.CONFIG.SPEED_LINES_THRESHOLD = R.CONFIG.SPEED_LINES_THRESHOLD || 0.80;

  /** Max screen-shake pixel offset. */
  R.CONFIG.SHAKE_MAX_OFFSET = R.CONFIG.SHAKE_MAX_OFFSET || 8;

  // ──────────────────────────────────────────────
  // Color palettes (pre-built arrays, no allocation in hot path)
  // ──────────────────────────────────────────────

  const SPARK_COLORS = [
    '#FFFDE0', '#FFF9C4', '#FFF176', '#FFEE58',   // bright yellow
    '#FFE082', '#FFD54F', '#FFCA28',              // yellow-amber
    '#FFB300', '#FFA000', '#FF8F00',              // amber
    '#FF6D00', '#FF5722', '#E64A19',              // orange-deep orange
    '#BF360C', '#870000'                           // dark red / dark
  ];

  const SMOKE_COLORS = [
    '#E0E0E0', '#D6D6D6', '#CCCCCC', '#C0C0C0',
    '#B0B0B0', '#A0A0A0', '#909090', '#808080',
    '#707070', '#606060', '#505050'
  ];

  const DUST_COLORS = [
    '#D2B48C', '#C4A882', '#B89A6A', '#AA8C56',
    '#9B7E4A', '#8B7355', '#7D6B4E', '#6B5B3E',
    '#A0522D', '#CD853F', '#DEB887', '#F5DEB3'
  ];

  const DRIFT_SMOKE_COLORS = [
    '#F5F5F5', '#EEEEEE', '#E0E0E0', '#D0D0D0',
    '#BDBDBD', '#AAAAAA', '#969696', '#848484'
  ];

  // ──────────────────────────────────────────────
  // Helper utilities (pure functions, no allocations)
  // ──────────────────────────────────────────────

  /**
   * Return a random float in [min, max).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  /**
   * Return a random integer in [min, max] inclusive.
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function randInt(min, max) {
    return Math.floor(randRange(min, max + 1));
  }

  /**
   * Pick a random element from an array (used only at spawn time, not in hot render path).
   * @param {Array} arr
   * @returns {*}
   */
  function randPick(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  /**
   * Clamp a value between min and max.
   * @param {number} val
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function clamp(val, min, max) {
    return val < min ? min : (val > max ? max : val);
  }

  /**
   * Linear interpolation between two hex-like colors by decomposing RGB channels.
   * Returns a CSS rgb() string for simplicity.
   * @param {string} c1 - hex color like '#FF8800'
   * @param {string} c2 - hex color like '#FF0000'
   * @param {number} t - blend factor 0..1
   * @returns {string} rgb() string
   */
  function lerpColor(c1, c2, t) {
    const r1 = parseInt(c1.slice(1, 3), 16);
    const g1 = parseInt(c1.slice(3, 5), 16);
    const b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16);
    const g2 = parseInt(c2.slice(3, 5), 16);
    const b2 = parseInt(c2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /**
   * Return a spark color based on life ratio (1.0 = newborn → 0.0 = dying).
   * Early life: bright yellow-white; mid: orange; late: red; end: dark red.
   * @param {number} t - life ratio 0..1
   * @returns {string} hex color
   */
  function sparkColorByLife(t) {
    const idx = Math.floor((1 - t) * (SPARK_COLORS.length - 1));
    return SPARK_COLORS[clamp(idx, 0, SPARK_COLORS.length - 1)];
  }

  /**
   * Return a smoke color based on life ratio (newborn light gray → dying darker).
   * @param {number} t - life ratio 0..1
   * @returns {string} hex color
   */
  function smokeColorByLife(t) {
    const idx = Math.floor(t * (SMOKE_COLORS.length - 1));
    return SMOKE_COLORS[clamp(idx, 0, SMOKE_COLORS.length - 1)];
  }

  // ──────────────────────────────────────────────
  // Particle pool
  // ──────────────────────────────────────────────

  /** @type {number} Next spawn slot in the pool (cyclic). */
  let _nextSpawnIndex = 0;

  /**
   * Create a dead particle template.
   * @returns {Object}
   */
  function createDeadParticle() {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0,
      size: 0,
      color: '#000',
      alpha: 0,
      type: 'spark'   // 'spark' | 'smoke' | 'dust' | 'debris'
    };
  }

  /**
   * Initialize the particle pool.
   * Pre-allocate R.particles with MAX_PARTICLES dead particles.
   * Safe to call multiple times — clears and rebuilds the pool.
   */
  R.initEffects = function() {
    const max = R.CONFIG.MAX_PARTICLES;
    R.particles = new Array(max);
    for (let i = 0; i < max; i++) {
      R.particles[i] = createDeadParticle();
    }
    _nextSpawnIndex = 0;
    R._shakeIntensity = 0;
    R._shakeDuration = 0;
    R._shakeTimer = 0;
  };

  /**
   * Activate a dead particle from the pool and configure it.
   * If no dead particle is available, recycle the oldest one (cyclic overwrite).
   *
   * @param {number} x - world/screen X position
   * @param {number} y - world/screen Y position
   * @param {Object} config
   * @param {number} [config.vx] - horizontal velocity; random if omitted
   * @param {number} [config.vy] - vertical velocity; random if omitted
   * @param {number} [config.vxRange] - if vx omitted, random range [-vxRange, vxRange]
   * @param {number} [config.vyRange] - if vy omitted, random range [-vyRange, vyRange]
   * @param {number} config.life - particle lifetime in frames
   * @param {number} config.size - particle size in px
   * @param {string} config.color - fill color (hex or rgb)
   * @param {string} [config.type='spark'] - particle type
   * @param {number} [config.alpha=1] - starting alpha
   * @returns {Object|null} the activated particle, or null if pool is empty (should not happen)
   */
  R.spawnParticle = function(x, y, config) {
    if (!R.particles || R.particles.length === 0) return null;

    const max = R.particles.length;
    let p = null;

    // Strategy 1: find the first dead particle starting from the current
    // write-pointer position (avoids always scanning from index 0).
    for (let attempt = 0; attempt < max; attempt++) {
      const idx = (_nextSpawnIndex + attempt) % max;
      if (R.particles[idx].life <= 0) {
        p = R.particles[idx];
        _nextSpawnIndex = (idx + 1) % max;
        break;
      }
    }

    // Strategy 2: all particles are alive — recycle the oldest (cyclic write pointer).
    if (!p) {
      p = R.particles[_nextSpawnIndex];
      _nextSpawnIndex = (_nextSpawnIndex + 1) % max;
    }

    // Configure particle
    p.x = x;
    p.y = y;
    p.vx = config.vx !== undefined ? config.vx : randRange(-(config.vxRange || 3), config.vxRange || 3);
    p.vy = config.vy !== undefined ? config.vy : randRange(-(config.vyRange || 3), config.vyRange || 3);
    p.life = config.life || 30;
    p.maxLife = config.life || 30;
    p.size = config.size || 3;
    p.color = config.color || '#FFFFFF';
    p.alpha = config.alpha !== undefined ? config.alpha : 1.0;
    p.type = config.type || 'spark';

    return p;
  };

  /**
   * Spawn a burst of spark particles.
   * Each spark: small (2-4px), bright yellow/orange, high velocity in a random direction,
   * short life (20-40 frames), colors cycle from yellow → orange → red → dark.
   *
   * @param {number} x - origin X
   * @param {number} y - origin Y
   * @param {number} count - number of spark particles to spawn
   */
  R.spawnSparks = function(x, y, count) {
    for (let i = 0; i < count; i++) {
      const angle = randRange(0, Math.PI * 2);
      const speed = randRange(2, 8);
      const life = randInt(20, 40);
      const size = randRange(2, 4);

      R.spawnParticle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: life,
        size: size,
        color: SPARK_COLORS[0],   // initial color — cycling handled per-type in render
        type: 'spark',
        alpha: 1.0
      });
    }
  };

  /**
   * Spawn smoke particles (for exhaust plumes, tire smoke).
   * Each: larger (6-12px), gray, slow upward drift, medium life (40-80 frames),
   * alpha fades from 0.6 → 0.
   *
   * @param {number} x - origin X
   * @param {number} y - origin Y
   * @param {number} count - number of smoke particles to spawn
   */
  R.spawnSmoke = function(x, y, count) {
    for (let i = 0; i < count; i++) {
      const life = randInt(40, 80);
      const size = randRange(6, 12);

      R.spawnParticle(x, y, {
        vx: randRange(-0.8, 0.8),
        vy: randRange(-1.5, -0.3),   // upward drift
        life: life,
        size: size,
        color: randPick(SMOKE_COLORS.slice(0, 4)),   // lighter grays initially
        type: 'smoke',
        alpha: randRange(0.35, 0.6)
      });
    }
  };

  /**
   * Spawn dust particles (off-road / grass kick-up).
   * Each: brown/tan, medium size (3-6px), low velocity, medium-short life (20-50 frames).
   *
   * @param {number} x - origin X
   * @param {number} y - origin Y
   * @param {number} count - number of dust particles to spawn
   */
  R.spawnDust = function(x, y, count) {
    for (let i = 0; i < count; i++) {
      const life = randInt(20, 50);
      const size = randRange(3, 6);

      R.spawnParticle(x, y, {
        vx: randRange(-1.5, 1.5),
        vy: randRange(-2.0, 0.2),    // slight upward bias
        life: life,
        size: size,
        color: randPick(DUST_COLORS),
        type: 'dust',
        alpha: randRange(0.4, 0.75)
      });
    }
  };

  /**
   * Spawn tire smoke during drifting from both rear wheel positions.
   * Two plumes from rear wheel positions offset from car center.
   * intensity affects spawn rate and particle count (~1-6 particles per plume per call).
   *
   * @param {number} carX - car center X (world)
   * @param {number} carY - car center Y (world)
   * @param {number} carAngle - car heading angle in radians
   * @param {number} intensity - 0..1 drift intensity (0 = no drift, 1 = full lock)
   */
  R.spawnDriftSmoke = function(carX, carY, carAngle, intensity) {
    if (intensity <= 0.02) return;   // negligible — skip

    // Rear wheel positions relative to car center
    const rearOffset = 35;   // px behind center
    const wheelSpan = 22;    // px left/right of center

    const cosA = Math.cos(carAngle);
    const sinA = Math.sin(carAngle);

    // Rear-left wheel world position
    const rlX = carX - rearOffset * cosA - wheelSpan * sinA;
    const rlY = carY - rearOffset * sinA + wheelSpan * cosA;

    // Rear-right wheel world position
    const rrX = carX - rearOffset * cosA + wheelSpan * sinA;
    const rrY = carY - rearOffset * sinA - wheelSpan * cosA;

    // Particle count per plume scales with intensity
    const baseCount = Math.floor(intensity * 6) + 1;

    for (let plume = 0; plume < 2; plume++) {
      const px = plume === 0 ? rlX : rrX;
      const py = plume === 0 ? rlY : rrY;
      const count = baseCount + randInt(0, 2);

      for (let i = 0; i < count; i++) {
        const life = randInt(30, 60);
        const size = randRange(4, 10);

        // Drift smoke billows outward from the drift direction
        const spreadAngle = carAngle + Math.PI / 2 + randRange(-0.6, 0.6);
        const spreadSpeed = randRange(0.5, 2.0) * intensity;

        R.spawnParticle(px + randRange(-4, 4), py + randRange(-4, 4), {
          vx: Math.cos(spreadAngle) * spreadSpeed,
          vy: Math.sin(spreadAngle) * spreadSpeed - randRange(0.3, 1.0),   // slight upward
          life: life,
          size: size,
          color: randPick(DRIFT_SMOKE_COLORS),
          type: 'smoke',
          alpha: randRange(0.3, 0.55) * intensity
        });
      }
    }
  };

  /**
   * Spawn a burst of debris particles (for collisions, crashes).
   * Debris: varied sizes, darker colors, affected by gravity, medium-long life.
   *
   * @param {number} x - origin X
   * @param {number} y - origin Y
   * @param {number} count - number of debris particles
   */
  R.spawnDebris = function(x, y, count) {
    const debrisColors = ['#555555', '#444444', '#666666', '#333333', '#777777',
                          '#884444', '#885522', '#556633'];
    for (let i = 0; i < count; i++) {
      const angle = randRange(0, Math.PI * 2);
      const speed = randRange(1, 5);
      const life = randInt(30, 70);
      const size = randRange(1.5, 5);

      R.spawnParticle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - randRange(1, 3),   // slight upward toss
        life: life,
        size: size,
        color: randPick(debrisColors),
        type: 'debris',
        alpha: 0.9
      });
    }
  };

  // ──────────────────────────────────────────────
  // Particle update
  // ──────────────────────────────────────────────

  /**
   * Update all alive particles.
   * Called each frame from the game loop.
   *
   * Steps:
   *  1. Decrement life by dt * 60 (normalize to ~60fps frame ticks)
   *  2. Update position: x += vx * dt * 60, y += vy * dt * 60
   *  3. Apply gravity to smoke / debris types: vy -= gravity
   *  4. Fade alpha based on life/maxLife ratio
   *  5. Mark dead if life <= 0
   *
   * @param {number} dt - delta time in seconds
   */
  R.updateEffects = function(dt) {
    if (!R.particles || R.particles.length === 0) return;

    const frameScale = dt * 60;   // normalize to 60fps equivalent
    const gravity = R.CONFIG.PARTICLE_GRAVITY;
    const particles = R.particles;
    const len = particles.length;

    for (let i = 0; i < len; i++) {
      const p = particles[i];
      if (p.life <= 0) continue;   // dead particle, skip

      // 1. Decrement life
      p.life -= frameScale * 1;    // life measured in frame-ticks

      // 2. Update position
      p.x += p.vx * frameScale;
      p.y += p.vy * frameScale;

      // 3. Apply gravity for affected types
      if (p.type === 'smoke' || p.type === 'debris') {
        p.vy += gravity * frameScale;
      }

      // 4. Fade alpha
      const lifeRatio = p.life / p.maxLife;
      if (p.type === 'smoke') {
        // Smoke fades out in the last 40% of its life
        p.alpha = lifeRatio > 0.4 ? p.alpha : (p.alpha * (lifeRatio / 0.4));
      } else if (p.type === 'dust') {
        // Dust fades smoothly
        p.alpha = lifeRatio * 0.7;
      } else {
        // Sparks / debris: hold alpha then fade sharply at end
        p.alpha = lifeRatio > 0.3 ? 1.0 : lifeRatio / 0.3;
      }

      // 5. Mark dead
      if (p.life <= 0) {
        p.life = 0;
        p.alpha = 0;
      }
    }

    // Update screen shake
    R.updateScreenShake(dt);
  };

  // ──────────────────────────────────────────────
  // Particle rendering
  // ──────────────────────────────────────────────

  /**
   * Render all alive particles.
   * Called each frame from the game loop.
   * For each alive particle:
   *   - Set ctx.globalAlpha = particle.alpha
   *   - Set ctx.fillStyle based on particle type and life ratio
   *   - Draw as small circle (spark, smoke, dust) or square (debris)
   *   - Reset globalAlpha to 1.0
   */
  R.renderEffects = function() {
    if (!R.particles || R.particles.length === 0) return;

    const ctx = R.ctx;
    const particles = R.particles;
    const len = particles.length;
    let aliveCount = 0;

    ctx.save();

    for (let i = 0; i < len; i++) {
      const p = particles[i];
      if (p.life <= 0 || p.alpha <= 0.005) continue;   // skip dead or invisible

      aliveCount++;

      const lifeRatio = clamp(p.life / p.maxLife, 0, 1);

      // Determine color based on particle type
      let color;
      switch (p.type) {
        case 'spark':
          color = sparkColorByLife(lifeRatio);
          break;
        case 'smoke':
          color = smokeColorByLife(lifeRatio);
          break;
        case 'dust':
          color = p.color;    // dust uses its assigned color, just fades alpha
          break;
        case 'debris':
          color = p.color;
          break;
        default:
          color = p.color;
      }

      ctx.globalAlpha = clamp(p.alpha, 0, 1);
      ctx.fillStyle = color;

      const halfSize = p.size / 2;

      switch (p.type) {
        case 'spark':
          // Small bright circle, sometimes with a glow
          ctx.beginPath();
          ctx.arc(p.x, p.y, halfSize, 0, Math.PI * 2);
          ctx.fill();
          // Tiny glow for bright sparks
          if (lifeRatio > 0.5 && p.size >= 3) {
            ctx.globalAlpha = clamp(p.alpha * 0.35, 0, 1);
            ctx.beginPath();
            ctx.arc(p.x, p.y, halfSize * 2, 0, Math.PI * 2);
            ctx.fill();
          }
          break;

        case 'smoke':
          // Soft round puff
          ctx.beginPath();
          ctx.arc(p.x, p.y, halfSize, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'dust':
          // Small irregular — use a filled circle, optionally a little scatter
          ctx.beginPath();
          ctx.arc(p.x, p.y, halfSize, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'debris':
          // Small square / rectangle oriented randomly
          ctx.fillRect(p.x - halfSize, p.y - halfSize * 0.6, p.size, p.size * 0.6);
          break;

        default:
          ctx.beginPath();
          ctx.arc(p.x, p.y, halfSize, 0, Math.PI * 2);
          ctx.fill();
      }
    }

    ctx.restore();
    // Always reset globalAlpha
    ctx.globalAlpha = 1.0;

    return aliveCount;
  };

  // ──────────────────────────────────────────────
  // Screen shake
  // ──────────────────────────────────────────────

  /**
   * Trigger a screen shake effect.
   *
   * @param {number} intensity - max pixel offset (e.g. 4 = up to 4px shake)
   * @param {number} [duration=15] - shake duration in frames (~0.25s at 60fps)
   */
  R.triggerScreenShake = function(intensity, duration) {
    if (!intensity || intensity <= 0) return;

    const dur = duration || 15;

    // If already shaking with higher intensity, don't downgrade
    if (R._shakeTimer > 0 && R._shakeIntensity > intensity) {
      // Keep the existing stronger shake
      return;
    }

    R._shakeIntensity = clamp(intensity, 0, R.CONFIG.SHAKE_MAX_OFFSET);
    R._shakeDuration = dur;
    R._shakeTimer = dur;
  };

  /**
   * Update screen shake state — decay intensity over time.
   * Called automatically from R.updateEffects().
   *
   * @param {number} dt - delta time in seconds
   */
  R.updateScreenShake = function(dt) {
    if (!R._shakeTimer || R._shakeTimer <= 0) {
      R._shakeIntensity = 0;
      R._shakeOffsetX = 0;
      R._shakeOffsetY = 0;
      return;
    }

    const frameScale = dt * 60;
    R._shakeTimer -= frameScale;

    if (R._shakeTimer <= 0) {
      R._shakeIntensity = 0;
      R._shakeOffsetX = 0;
      R._shakeOffsetY = 0;
      R._shakeTimer = 0;
      return;
    }

    // Decay factor: intensity ramps down linearly
    const decay = R._shakeTimer / R._shakeDuration;
    const currentIntensity = R._shakeIntensity * decay;

    // Random offset within current intensity range; changes each frame for jitter
    R._shakeOffsetX = randRange(-currentIntensity, currentIntensity);
    R._shakeOffsetY = randRange(-currentIntensity, currentIntensity);
  };

  /**
   * Apply screen shake offset to the canvas transform.
   * Call this in the render pipeline before drawing world objects,
   * or apply the offset manually to R.camera.
   *
   * Returns the current shake offsets { x, y } so the caller can apply them.
   *
   * @returns {{x: number, y: number}}
   */
  R.getScreenShakeOffset = function() {
    return {
      x: R._shakeOffsetX || 0,
      y: R._shakeOffsetY || 0
    };
  };

  /**
   * Legacy / compatibility wrapper: directly applies shake via ctx.translate.
   * Use getScreenShakeOffset + manual application in the render pipeline
   * for more control. This is a convenience method.
   */
  R.renderScreenShake = function() {
    if (!R._shakeTimer || R._shakeTimer <= 0) return;

    const offset = R.getScreenShakeOffset();
    if (offset.x !== 0 || offset.y !== 0) {
      R.ctx.translate(offset.x, offset.y);
    }
  };

  // ──────────────────────────────────────────────
  // Speed lines
  // ──────────────────────────────────────────────

  /**
   * Render speed lines at screen edges when the player is at high speed.
   * Lines streak backward to create a speed-sensation effect.
   *
   * Requires: R.playerCar (the player's car object with .speed and .maxSpeed).
   * Safe to call even if playerCar is not ready — returns silently.
   */
  R.renderSpeedLines = function() {
    const car = R.playerCar;
    if (!car || !car.maxSpeed) return;

    const speedRatio = car.speed / car.maxSpeed;
    if (speedRatio < R.CONFIG.SPEED_LINES_THRESHOLD) return;

    const ctx = R.ctx;
    const w = R.canvas.width;
    const h = R.canvas.height;

    // Intensity 0..1 based on speed above threshold
    const intensity = (speedRatio - R.CONFIG.SPEED_LINES_THRESHOLD) /
                      (1.0 - R.CONFIG.SPEED_LINES_THRESHOLD);

    const lineCount = Math.floor(intensity * 18) + 4;
    const maxLength = intensity * 120 + 30;
    const minLength = maxLength * 0.3;

    ctx.save();

    // Lines run horizontally, concentrated near top and bottom edges
    for (let i = 0; i < lineCount; i++) {
      const topEdge = Math.random() < 0.5;
      const y = topEdge
        ? randRange(0, h * 0.08)                          // near top
        : randRange(h * 0.92, h);                          // near bottom

      const length = randRange(minLength, maxLength);
      const xStart = randRange(0, w);
      const xEnd = xStart - length;                        // streak left (backward)

      const alpha = randRange(0.08, 0.22) * intensity;
      const lineWidth = randRange(1, 2.5);

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(xStart, y);
      ctx.lineTo(xEnd, y);
      ctx.stroke();

      // Occasionally add a slightly wider, more transparent glow line
      if (Math.random() < 0.3) {
        ctx.globalAlpha = alpha * 0.4;
        ctx.lineWidth = lineWidth * 3;
        ctx.beginPath();
        ctx.moveTo(xStart, y);
        ctx.lineTo(xEnd, y);
        ctx.stroke();
      }
    }

    ctx.restore();
    ctx.globalAlpha = 1.0;
  };

  // ──────────────────────────────────────────────
  // Exhaust particles (engine running)
  // ──────────────────────────────────────────────

  /**
   * Spawn exhaust particles behind a car.
   * Called each frame for every active car during racing.
   *
   * @param {number} carX - car center X (world)
   * @param {number} carY - car center Y (world)
   * @param {number} carAngle - car heading angle in radians
   * @param {number} throttle - 0..1 throttle amount
   * @param {number} speed - current car speed (used to reduce exhaust at speed)
   * @param {number} maxSpeed - car's maximum speed
   */
  R.spawnExhaust = function(carX, carY, carAngle, throttle, speed, maxSpeed) {
    if (throttle <= 0.05) return;

    // Exhaust decreases at very high speeds (less visible)
    const speedRatio = maxSpeed > 0 ? speed / maxSpeed : 0;
    const exhaustFactor = throttle * (1 - speedRatio * 0.6);

    if (exhaustFactor < 0.1) return;

    // Exhaust comes from behind the car
    const rearOffset = 30;
    const exhaustX = carX - Math.cos(carAngle) * rearOffset;
    const exhaustY = carY - Math.sin(carAngle) * rearOffset;

    const count = Math.floor(exhaustFactor * 3) + 1;

    for (let i = 0; i < count; i++) {
      const life = randInt(25, 50);
      const size = randRange(3, 7);

      R.spawnParticle(exhaustX + randRange(-6, 6), exhaustY + randRange(-3, 3), {
        vx: -Math.cos(carAngle) * randRange(0.2, 0.8) + randRange(-0.2, 0.2),
        vy: -Math.sin(carAngle) * randRange(0.2, 0.8) - randRange(0.5, 1.2),
        life: life,
        size: size,
        color: randPick(SMOKE_COLORS.slice(3, 8)),   // mid-to-dark grays
        type: 'smoke',
        alpha: randRange(0.15, 0.35) * exhaustFactor
      });
    }
  };

  // ──────────────────────────────────────────────
  // Collision burst (called on car-to-car or car-to-wall impact)
  // ──────────────────────────────────────────────

  /**
   * Spawn a combined spark+debris burst at the impact point.
   * Also triggers screen shake proportional to impact force.
   *
   * @param {number} x - impact position X
   * @param {number} y - impact position Y
   * @param {number} force - 0..1 impact severity
   */
  R.spawnCollisionBurst = function(x, y, force) {
    const clampedForce = clamp(force, 0, 1);

    const sparkCount = Math.floor(clampedForce * 25) + 5;
    const debrisCount = Math.floor(clampedForce * 10) + 2;
    const shakeIntensity = clampedForce * 8;

    R.spawnSparks(x, y, sparkCount);
    R.spawnDebris(x, y, debrisCount);
    R.triggerScreenShake(shakeIntensity, Math.floor(clampedForce * 25) + 5);
  };

  // ──────────────────────────────────────────────
  // Off-road particle burst
  // ──────────────────────────────────────────────

  /**
   * Spawn dust particles when a car goes off the track surface.
   * Call rate-limited (e.g. every 2-3 frames) from the car update logic.
   *
   * @param {number} x - car position X
   * @param {number} y - car position Y
   * @param {number} speed - current car speed for intensity scaling
   * @param {number} maxSpeed - car max speed
   */
  R.spawnOffRoadDust = function(x, y, speed, maxSpeed) {
    const speedRatio = maxSpeed > 0 ? clamp(speed / maxSpeed, 0, 1) : 0;
    const count = Math.floor(speedRatio * 8) + 1;

    R.spawnDust(x, y, count);
  };

  // ──────────────────────────────────────────────
  // Diagnostics / pool stats (non-hot-path, for debug)
  // ──────────────────────────────────────────────

  /**
   * Return the count of alive particles currently in the pool.
   * Useful for debug overlays and performance monitoring.
   *
   * @returns {number}
   */
  R.getAliveParticleCount = function() {
    if (!R.particles) return 0;
    let count = 0;
    for (let i = 0; i < R.particles.length; i++) {
      if (R.particles[i].life > 0) count++;
    }
    return count;
  };

  /**
   * Return pool utilization as a fraction (0..1).
   * @returns {number}
   */
  R.getPoolUtilization = function() {
    if (!R.particles || R.particles.length === 0) return 0;
    return R.getAliveParticleCount() / R.particles.length;
  };

  /**
   * Kill all particles and reset screen shake.
   * Useful when resetting the race or returning to menu.
   */
  R.clearAllEffects = function() {
    if (R.particles) {
      for (let i = 0; i < R.particles.length; i++) {
        R.particles[i].life = 0;
        R.particles[i].alpha = 0;
      }
    }
    _nextSpawnIndex = 0;
    R._shakeTimer = 0;
    R._shakeIntensity = 0;
    R._shakeOffsetX = 0;
    R._shakeOffsetY = 0;
  };

})();

// ──────────────────────────────────────────────
// Exported functions/objects (all attached to window.R):
//
// R.CONFIG.MAX_PARTICLES              — max pool size (default 3072)
// R.CONFIG.PARTICLE_GRAVITY           — gravity for smoke/debris (default 0.05)
// R.CONFIG.SPEED_LINES_THRESHOLD      — speed ratio to trigger lines (default 0.80)
// R.CONFIG.SHAKE_MAX_OFFSET           — max screen shake px (default 8)
//
// R.particles                          — particle pool array
//
// R.initEffects()                      — pre-allocate particle pool
// R.spawnParticle(x, y, config)        — activate a single particle from pool
// R.spawnSparks(x, y, count)           — burst of spark particles
// R.spawnSmoke(x, y, count)            — burst of smoke particles
// R.spawnDust(x, y, count)             — burst of dust particles
// R.spawnDriftSmoke(cx, cy, ang, int)  — tire smoke from rear wheels
// R.spawnDebris(x, y, count)           — burst of debris particles
// R.spawnExhaust(cx, cy, ang, thr, sp, mx) — exhaust particles behind car
// R.spawnCollisionBurst(x, y, force)   — combined spark+debris+shake
// R.spawnOffRoadDust(x, y, speed, max) — dust when off-track
//
// R.updateEffects(dt)                  — update all alive particles + shake
// R.renderEffects()                    — render all alive particles
//
// R.triggerScreenShake(intensity, dur) — start screen shake
// R.updateScreenShake(dt)              — decay shake (auto-called by updateEffects)
// R.getScreenShakeOffset()             — { x, y } current shake offset
// R.renderScreenShake()                — apply shake via ctx.translate
// R.renderSpeedLines()                 — speed sensation lines at edges
//
// R.getAliveParticleCount()            — debug: count alive particles
// R.getPoolUtilization()               — debug: pool usage ratio
// R.clearAllEffects()                  — reset all particles and shake
// ──────────────────────────────────────────────
