// === track.js — Racing Game ===
// Procedural track generation and rendering for the racing game.
// Manages track data, position queries, collision detection, sky, and road rendering.
// All functions attach to window.R. Assumes R.CONFIG, R.canvas, R.ctx,
// R.camera, R.state, and R.track already exist.

/* ==========================================================================
   CONFIG defaults — merged into R.CONFIG if keys are missing
   ========================================================================== */
(function ensureTrackConfig() {
  'use strict';

  window.R = window.R || {};
  window.R.CONFIG = window.R.CONFIG || {};

  var defaults = {
    // ── Track generation ────────────────────────────────────────────────
    TRACK_CONTROL_POINTS:   14,       // number of spline control points
    TRACK_SEGMENTS_PER_CP:  15,       // segments between each control-point pair
    TRACK_BASE_RADIUS:      1350,     // base circle radius for control points
    TRACK_RADIUS_VAR1:      480,      // amplitude of primary oval harmonic
    TRACK_RADIUS_VAR2:      280,      // amplitude of triangular harmonic
    TRACK_RADIUS_VAR3:      140,      // amplitude of fine-detail harmonic
    TRACK_RADIUS_JITTER:    120,      // max random offset per control point
    TRACK_TOTAL_LENGTH:     9000,     // approximate target (actual is computed)

    // ── Road geometry ───────────────────────────────────────────────────
    ROAD_WIDTH:             180,
    ROAD_WIDTH_MIN:         130,      // narrowest on tight hairpins
    ROAD_SHOULDER:          20,       // extra width for rumble strips / curbs
    RUMBLE_WIDTH:           6,
    RUMBLE_COLOR_A:         '#ff0000', // curb stripe A (red)
    RUMBLE_COLOR_B:         '#ffffff', // curb stripe B (white)
    CURB_CURVATURE_THRESH:  0.0012,   // |curvature| above this → draw curbs

    // ── Lane markings ───────────────────────────────────────────────────
    LANE_MARKER_DASH:       40,       // world units — dash length
    LANE_MARKER_GAP:        30,       // world units — gap between dashes
    LANE_MARKER_COLOR:      '#ccc',
    LANE_MARKER_WIDTH:      1.5,

    // ── Elevation / hills ───────────────────────────────────────────────
    HILL_AMPLITUDE_A:       28,       // primary hill height
    HILL_FREQ_A:            0.0012,   // primary hill frequency (rad / world-unit)
    HILL_AMPLITUDE_B:       14,       // secondary hill height
    HILL_FREQ_B:            0.0030,   // secondary hill frequency
    HILL_PHASE_B:           1.7,      // phase offset for secondary hills

    // ── Rendering ───────────────────────────────────────────────────────
    RENDER_DISTANCE:        1200,     // world units — max segment distance from camera to draw
    RENDER_FADE_NEAR:       1000,     // world units — start fading segments
    HORIZON_Y:              200,      // screen-space Y of horizon line
    PERSPECTIVE_COEFF:      0.0022,   // perspective strength (higher = more depth)
    ROAD_V_OFFSET:          0.42,     // forward→screen-Y slope multiplier
    SEGMENT_COLOR_VAR:      4,        // ± brightness variation per segment
    TRACK_BG_COLOR:         '#3a5a2c',// grass / terrain color behind the road
    TRACK_BG_COLOR_FAR:     '#4a6a3c',// grass color near horizon (atmospheric)
    SHOULDER_COLOR:         '#8b4513',// dirt shoulder color

    // ── Fog ─────────────────────────────────────────────────────────────
    FOG_NEAR:               300,
    FOG_FAR:                800,
    FOG_COLOR:              '#87CEEB',

    // ── Scenery (used by scenery module, defaults here for self-containment)
    SCENERY_OBJECTS:        80,
    SCENERY_LATERAL_MIN:    0.3,
    SCENERY_LATERAL_MAX:    1.2,
  };

  for (var k in defaults) {
    if (!(k in R.CONFIG)) R.CONFIG[k] = defaults[k];
  }
})();

/* ==========================================================================
   PRIVATE HELPERS — not attached to R; file-scoped
   ========================================================================== */

/**
 * Normalise an angle to the range [-PI, PI].
 * @param {number} a Angle in radians
 * @returns {number} Normalised angle
 */
function _normAngle(a) {
  while (a >  Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Catmull-Rom spline interpolation between four 2D control points.
 * Produces a smooth curve passing through p1 and p2, guided by p0 and p3.
 * @param {{x:number,z:number}} p0 Previous control point
 * @param {{x:number,z:number}} p1 Start control point
 * @param {{x:number,z:number}} p2 End control point
 * @param {{x:number,z:number}} p3 Next control point
 * @param {number} t Interpolation factor [0, 1]
 * @returns {{x:number,z:number}} Interpolated point
 */
function _catmullRom(p0, p1, p2, p3, t) {
  var t2 = t * t;
  var t3 = t2 * t;
  return {
    x: 0.5 * (
      (2 * p1.x) +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
    ),
    z: 0.5 * (
      (2 * p1.z) +
      (-p0.z + p2.z) * t +
      (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
      (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3
    )
  };
}

/**
 * Direction angle (radians) from point a to point b in the XZ plane.
 * Angle 0 = +Z direction; increases clockwise when viewed from above (+Y).
 * @param {{x:number,z:number}} a
 * @param {{x:number,z:number}} b
 * @returns {number} Angle in radians
 */
function _angleTo(a, b) {
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/**
 * Euclidean distance between two 2D points in XZ space.
 * @param {{x:number,z:number}} a
 * @param {{x:number,z:number}} b
 * @returns {number}
 */
function _distXZ(a, b) {
  var dx = a.x - b.x;
  var dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Compute forward distance from camera to a segment, handling the closed-loop
 * wrap so that the shorter arc is always used.
 * @param {number} segDist Cumulative distance of the segment
 * @param {number} camDist Camera's cumulative track distance
 * @param {number} totalLen Total track length
 * @returns {number} Signed forward distance (positive = ahead, negative = behind)
 */
function _forwardDist(segDist, camDist, totalLen) {
  var dz = segDist - camDist;
  if (dz >  totalLen / 2) dz -= totalLen;
  if (dz < -totalLen / 2) dz += totalLen;
  return dz;
}

/* ==========================================================================
   R.initTrack() — Generate a closed-loop racing circuit
   ========================================================================== */

/**
 * Generates a closed-loop racing track using Catmull-Rom spline interpolation
 * through stochastically-placed control points on a distorted circle.
 *
 * Each segment stores:
 *   { worldX, worldY, worldZ, width, curvature, elevation, type, dist, angle }
 *
 * After generation populates:
 *   R.track.segments[], R.track.totalLength, R.track.startX, R.track.startZ,
 *   R.track.startAngle
 */
R.initTrack = function () {
  var cfg  = R.CONFIG;
  var nCP  = cfg.TRACK_CONTROL_POINTS;
  var nSeg = cfg.TRACK_SEGMENTS_PER_CP;

  // ── Step 1: Generate control points on a distorted circle ───────────
  var cps = [];
  var baseR = cfg.TRACK_BASE_RADIUS;
  for (var i = 0; i < nCP; i++) {
    var angle = (i / nCP) * Math.PI * 2;
    var r = baseR
          + Math.sin(angle * 2) * cfg.TRACK_RADIUS_VAR1
          + Math.cos(angle * 3) * cfg.TRACK_RADIUS_VAR2
          + Math.sin(angle * 5) * cfg.TRACK_RADIUS_VAR3;
    // Random jitter (use seed if provided, otherwise Math.random)
    var jitter = cfg.TRACK_SEED != null
      ? (_pseudoRandom(i) - 0.5) * cfg.TRACK_RADIUS_JITTER * 2
      : (Math.random() - 0.5) * cfg.TRACK_RADIUS_JITTER * 2;
    // Apply jitter proportionally so the shape doesn't self-intersect
    var rFinal = r + jitter;
    if (rFinal < 300) rFinal = 300; // prevent collapsing to centre
    cps.push({ x: Math.cos(angle) * rFinal, z: Math.sin(angle) * rFinal });
  }

  // ── Step 2: Interpolate segments via Catmull-Rom ────────────────────
  var samples  = []; // intermediate dense samples {x, z}
  var totalCP  = cps.length;
  for (var ci = 0; ci < totalCP; ci++) {
    var p0 = cps[(ci - 1 + totalCP) % totalCP];
    var p1 = cps[ci];
    var p2 = cps[(ci + 1) % totalCP];
    var p3 = cps[(ci + 2) % totalCP];
    for (var si = 0; si < nSeg; si++) {
      var t = si / nSeg;
      var pt = _catmullRom(p0, p1, p2, p3, t);
      samples.push(pt);
    }
  }

  // ── Step 3: Build segment objects ───────────────────────────────────
  var segs    = [];
  var nSamples = samples.length;
  // Temporaries for curvature calculation
  var angles  = new Array(nSamples);
  var segDists = new Array(nSamples); // Euclidean distance between consecutive samples

  // First pass: compute angles and segment lengths (distance between consecutive samples)
  for (var s = 0; s < nSamples; s++) {
    var curr  = samples[s];
    var next  = samples[(s + 1) % nSamples];
    var prev  = samples[(s - 1 + nSamples) % nSamples];
    segDists[s] = _distXZ(curr, next);
    // Smooth angle using central difference (wrapping)
    var anglePrev = _angleTo(prev, curr);
    var angleNext = _angleTo(curr, next);
    // Average the two half-angles for a smoother direction at this point
    angles[s] = _normAngle((anglePrev + angleNext) / 2);
  }

  // Compute curvature as angle change per unit distance
  var curvatures = new Array(nSamples);
  // Find maximum absolute curvature for width-ramping
  var maxAbsCurv = 0;
  for (var s2 = 0; s2 < nSamples; s2++) {
    var aCurr  = angles[s2];
    var aNext  = angles[(s2 + 1) % nSamples];
    var deltaA = _normAngle(aNext - aCurr);
    var d      = segDists[s2];
    curvatures[s2] = d > 0.01 ? deltaA / d : 0;
    var ac = Math.abs(curvatures[s2]);
    if (ac > maxAbsCurv) maxAbsCurv = ac;
  }
  // Guard against zero max curvature (perfect circle)
  if (maxAbsCurv < 0.0001) maxAbsCurv = 0.0001;

  // Cumulative distance
  var cumDist = 0;
  for (var s3 = 0; s3 < nSamples; s3++) {
    var absCurv      = Math.abs(curvatures[s3]);
    var widthFraction = absCurv / maxAbsCurv; // 0 on straights, 1 on tightest curve
    if (widthFraction > 1) widthFraction = 1;

    var roadW = cfg.ROAD_WIDTH + (cfg.ROAD_WIDTH_MIN - cfg.ROAD_WIDTH) * widthFraction;

    // Classification
    var stype = 'straight';
    if (absCurv > maxAbsCurv * 0.15) stype = 'curve';
    if (absCurv > maxAbsCurv * 0.55) stype = 'tight_curve';

    // Elevation
    var d   = cumDist;
    var elev = Math.sin(d * cfg.HILL_FREQ_A)          * cfg.HILL_AMPLITUDE_A
             + Math.sin(d * cfg.HILL_FREQ_B + cfg.HILL_PHASE_B) * cfg.HILL_AMPLITUDE_B;

    // Check for hill
    if (cfg.HILL_AMPLITUDE_A > 0 || cfg.HILL_AMPLITUDE_B > 0) {
      var nextD  = cumDist + segDists[s3];
      var nextEl = Math.sin(nextD * cfg.HILL_FREQ_A)          * cfg.HILL_AMPLITUDE_A
                 + Math.sin(nextD * cfg.HILL_FREQ_B + cfg.HILL_PHASE_B) * cfg.HILL_AMPLITUDE_B;
      if (Math.abs(nextEl - elev) / Math.max(segDists[s3], 1) > 0.015) {
        stype = 'hill';
      }
    }

    segs.push({
      worldX:    samples[s3].x,
      worldY:    elev,
      worldZ:    samples[s3].z,
      width:     roadW,
      curvature: curvatures[s3],
      elevation: elev,
      type:      stype,
      dist:      cumDist,
      angle:     angles[s3],
      segDist:   segDists[s3]  // distance to next segment
    });

    cumDist += segDists[s3];
  }

  // ── Step 4: Store to R.track ────────────────────────────────────────
  R.track = {
    segments:    segs,
    totalLaps:   cfg.TOTAL_LAPS,
    totalLength: cumDist,
    startX:      segs[0].worldX,
    startY:      segs[0].worldY,
    startZ:      segs[0].worldZ,
    startAngle:  segs[0].angle,
    checkpointCount: cfg.LAP_CHECKPOINT_COUNT || 4
  };

  // Distribute checkpoints evenly
  R.track.checkpoints = [];
  var cpCount = R.track.checkpointCount;
  for (var c = 0; c < cpCount; c++) {
    var cpDist = (c / cpCount) * R.track.totalLength;
    var cpPos  = R.getTrackPosition(cpDist);
    R.track.checkpoints.push({
      dist: cpDist,
      x:    cpPos.x,
      z:    cpPos.z,
      width: cpPos.width
    });
  }

  // ── Step 5: Ensure camera Z is initialised ──────────────────────────
  if (R.camera) {
    R.camera.worldZ = segs[0].worldZ;
    R.camera.trackDist = 0;
  }
};

/**
 * Simple deterministic pseudo-random generator for seeded tracks.
 * Returns a value in [0, 1) based on index.
 * @param {number} idx Integer index
 * @returns {number} Pseudo-random value
 */
function _pseudoRandom(idx) {
  var x = Math.sin(idx * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ==========================================================================
   R.getTrackPosition(worldZ) — Interpolated position lookup by distance
   ========================================================================== */

/**
 * Given a cumulative distance along the track, returns the interpolated
 * position and properties at that point. Wraps around for closed circuit.
 *
 * @param {number} dist Cumulative distance (wraps modulo totalLength)
 * @returns {{x:number, y:number, z:number, angle:number, curvature:number, width:number, dist:number, index:number}}
 */
R.getTrackPosition = function (dist) {
  var segs   = R.track.segments;
  var total  = R.track.totalLength;
  var n      = segs.length;

  // Wrap distance
  var d = dist % total;
  if (d < 0) d += total;

  // Binary search for the segment just before d
  var lo = 0;
  var hi = n - 1;
  while (lo < hi) {
    var mid = (lo + hi + 1) >> 1;
    if (segs[mid].dist <= d) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  var idx = lo;
  var seg = segs[idx];
  var nextIdx = (idx + 1) % n;
  var nextSeg = segs[nextIdx];

  // Handle wrap: the next segment's dist may be less than current if we wrapped
  var segEndDist = nextSeg.dist;
  if (segEndDist <= seg.dist) segEndDist += total; // wrapped

  var t = 0;
  var span = segEndDist - seg.dist;
  if (span > 0.0001) {
    var localD = d;
    if (localD < seg.dist) localD += total;
    t = (localD - seg.dist) / span;
  }
  if (t < 0) t = 0;
  if (t > 1) t = 1;

  return {
    x:          R.lerp(seg.worldX, nextSeg.worldX, t),
    y:          R.lerp(seg.worldY, nextSeg.worldY, t),
    z:          R.lerp(seg.worldZ, nextSeg.worldZ, t),
    angle:      _normAngle(R.lerp(seg.angle, nextSeg.angle, t)),
    curvature:  R.lerp(seg.curvature, nextSeg.curvature, t),
    width:      R.lerp(seg.width, nextSeg.width, t),
    dist:       d,
    index:      idx
  };
};

/* ==========================================================================
   R.isOnTrack(worldX, worldZ) — Collision detection
   ========================================================================== */

/**
 * Checks whether a given world position (X, Z) is on the track surface.
 * Finds the nearest segment by track distance, computes lateral offset
 * from the road centre-line, and compares to the segment's half-width.
 *
 * @param {number} wx World X coordinate to test
 * @param {number} wz World Z coordinate to test
 * @returns {{onTrack:boolean, distFromCenter:number, segmentIndex:number, halfWidth:number}}
 */
R.isOnTrack = function (wx, wz) {
  var segs  = R.track.segments;
  var n     = segs.length;
  var total = R.track.totalLength;

  // Spiral search: start from last known nearest segment and expand outward
  // Fall back to full scan on first call
  var bestIdx    = -1;
  var bestDist2  = Infinity;

  // Scan all segments — 200-240 is cheap enough per call
  for (var i = 0; i < n; i++) {
    var seg = segs[i];
    var dx  = seg.worldX - wx;
    var dz  = seg.worldZ - wz;
    var d2  = dx * dx + dz * dz;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      bestIdx   = i;
    }
  }

  if (bestIdx < 0) {
    return { onTrack: false, distFromCenter: Infinity, segmentIndex: -1, halfWidth: 0 };
  }

  var seg       = segs[bestIdx];
  var segAngle  = seg.angle;

  // Compute lateral (perpendicular) distance from road centre-line
  // Vector from segment centre to test point
  var dx = wx - seg.worldX;
  var dz = wz - seg.worldZ;
  // Project onto perpendicular direction: left = (cos(angle), -sin(angle))
  var lateralDist = dx * Math.cos(segAngle) - dz * Math.sin(segAngle);
  // Take absolute value for distance from centre
  var absLat = Math.abs(lateralDist);
  var halfW  = seg.width / 2;

  return {
    onTrack:        absLat <= halfW,
    distFromCenter: absLat,
    segmentIndex:   bestIdx,
    halfWidth:      halfW
  };
};

/* ==========================================================================
   R.worldToScreen(wx, wy, wz) — World-to-screen projection
   ========================================================================== */

/**
 * Converts world coordinates to screen coordinates using perspective projection.
 * wz controls depth-based scaling: larger wz = farther away = smaller on screen.
 *
 * The camera position (R.camera.x, R.camera.y) defines the screen centre.
 * If R.camera.worldZ is set, wz is treated as relative to the camera's Z
 * (for proper perspective during racing). Otherwise wz is used as-is.
 *
 * @param {number} wx World X coordinate
 * @param {number} wy World Y coordinate (elevation)
 * @param {number} wz World Z coordinate (depth / forward distance)
 * @returns {{x:number, y:number, scale:number}}
 */
R.worldToScreen=function(wx,wy,wz){var cam=R.camera;if(!cam)return{x:wx,y:wy,scale:1};var zoom=cam.zoom||1;var sx=R.CONFIG.CANVAS_WIDTH/2+(wx-(cam.x||0))*zoom;var sy=R.CONFIG.CANVAS_HEIGHT/2+(wy-(cam.y||0))*zoom;return{x:sx,y:sy,scale:zoom};};

/* ==========================================================================
   R.renderSky(ctx) — Sky gradient and horizon
   ========================================================================== */

/**
 * Draws a full-screen sky gradient from a darker top colour to a lighter
 * horizon colour, followed by a narrow ground/horizon strip.
 *
 * Operates in screen space: saves the current transform, resets to identity,
 * draws the sky, and restores.
 *
 * @param {CanvasRenderingContext2D} ctx
 */
R.renderSky = function (ctx) {
  var W = R.CONFIG.CANVAS_WIDTH;
  var H = R.CONFIG.CANVAS_HEIGHT;
  var horizonY = R.CONFIG.HORIZON_Y || 200;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // ── Sky gradient ─────────────────────────────────────────────────────
  var skyTop    = R.CONFIG.SKY_TOP_COLOR    || '#1a1a2e';
  var skyBottom = R.CONFIG.SKY_BOTTOM_COLOR || '#87CEEB';
  var grad = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
  grad.addColorStop(0,    skyTop);
  grad.addColorStop(0.65, '#4a6fa5');
  grad.addColorStop(1,    skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, horizonY + 40);

  // ── Horizon glow ─────────────────────────────────────────────────────
  var glowGrad = ctx.createLinearGradient(0, horizonY - 20, 0, horizonY + 40);
  glowGrad.addColorStop(0, 'rgba(255,255,255,0)');
  glowGrad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  glowGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, horizonY - 20, W, 60);

  // ── Ground strip below horizon ───────────────────────────────────────
  var groundGrad = ctx.createLinearGradient(0, horizonY + 20, 0, H);
  groundGrad.addColorStop(0,    '#6b8c5c');  // distant green-brown
  groundGrad.addColorStop(0.15, '#5a7a4a');
  groundGrad.addColorStop(0.5,  R.CONFIG.TRACK_BG_COLOR || '#3a5a2c');
  groundGrad.addColorStop(1,    '#2a4a1c');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, horizonY + 20, W, H - horizonY - 20);

  // ── Horizon line ─────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, horizonY + 20);
  ctx.lineTo(W, horizonY + 20);
  ctx.stroke();

  ctx.restore();
};

/* ==========================================================================
   R.renderTrack(ctx) — Main track rendering
   ========================================================================== */

/**
 * Renders the racing track with pseudo-3D perspective.
 *
 * Drawing order: back-to-front (far segments first) for correct occlusion.
 * For each consecutive segment pair, draws:
 *   1. Road surface trapezoid
 *   2. Edge lines (solid white)
 *   3. Centre dashed lane markings
 *   4. Red/white curbs on tight curves
 *
 * Operates in screen space: saves the camera transform, resets to identity,
 * does perspective projection via worldToScreen, then restores.
 *
 * @param {CanvasRenderingContext2D} ctx
 */
R.renderTrack = function (ctx) {
  var segs   = R.track.segments;
  var n      = segs.length;
  var total  = R.track.totalLength;
  var cam    = R.camera;
  var cfg    = R.CONFIG;
  var W      = cfg.CANVAS_WIDTH;
  var H      = cfg.CANVAS_HEIGHT;

  if (!n) return;

  // ── Update camera track position from player ────────────────────────
  if (R.player) {
    cam.worldZ = R.player.z;
    // Compute camera's approximate track distance for forward-distance calc
    var playerSegIdx = 0;
    var bestD2 = Infinity;
    for (var pidx = 0; pidx < n; pidx++) {
      var pseg = segs[pidx];
      var pdx  = pseg.worldX - R.player.x;
      var pdz  = pseg.worldZ - R.player.z;
      var pd2  = pdx * pdx + pdz * pdz;
      if (pd2 < bestD2) { bestD2 = pd2; playerSegIdx = pidx; }
    }
    cam.trackDist = segs[playerSegIdx].dist;
  } else {
    cam.worldZ    = cam.worldZ || 0;
    cam.trackDist = cam.trackDist || 0;
  }

  // ── Save canvas state, reset to identity for screen-space drawing ───
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  var renderDist = cfg.RENDER_DISTANCE;
  var horY       = cfg.HORIZON_Y;
  var camDist    = cam.trackDist;

  // ── Collect visible segments with computed screen positions ──────────
  var visible = [];
  for (var i = 0; i < n; i++) {
    var seg = segs[i];
    var dz  = _forwardDist(seg.dist, camDist, total);

    // Cull segments too far behind or ahead
    if (dz < -renderDist || dz > renderDist * 1.4) continue;

    // Compute screen position via perspective projection
    var proj = _projectSegment(seg, dz, cam, cfg, W, H);

    // Cull segments off-screen
    if (proj.y > H + 100 || proj.y < -100) continue;

    visible.push({
      index: i,
      seg:   seg,
      dz:    dz,
      sx:    proj.x,
      sy:    proj.y,
      scale: proj.scale,
      lx:    proj.lx,
      rx:    proj.rx
    });
  }

  if (visible.length === 0) { ctx.restore(); return; }

  // Sort far-to-near (back-to-front) for painter's algorithm
  visible.sort(function (a, b) { return b.dz - a.dz; });

  // ── Draw terrain / grass beneath the road ─────────────────────────────
  // (A solid fill from horizon down, over which the road trapezoids sit)
  ctx.fillStyle = cfg.TRACK_BG_COLOR || '#3a5a2c';
  ctx.fillRect(0, horY + 20, W, H - horY - 20);

  // ── Build a set of visible indices for fast pair-check ────────────────
  var visSet = {};
  for (var vi = 0; vi < visible.length; vi++) {
    visSet[visible[vi].index] = vi;
  }

  // ── Track drawn-pair set to avoid double-drawing ─────────────────────
  var drawnPairs = {};

  // ── Pass 1: Road surface trapezoids ──────────────────────────────────
  for (var vi2 = 0; vi2 < visible.length; vi2++) {
    var cur  = visible[vi2];
    var idx  = cur.index;
    var nextIdx = (idx + 1) % n;

    // Only draw if the next segment is also visible
    if (!(nextIdx in visSet)) continue;

    // Avoid double-draw: each pair is drawn when processing the farther segment
    var pairKey = idx + '_' + nextIdx;
    if (drawnPairs[pairKey]) continue;
    drawnPairs[pairKey] = true;

    var nxtVis = visible[visSet[nextIdx]];
    // Use the stored screen coordinates
    var clx = cur.lx, crx = cur.rx, csy = cur.sy;
    var nlx = nxtVis.lx, nrx = nxtVis.rx, nsy = nxtVis.sy;

    // ── Road surface colour (slight variation per segment) ─────────────
    var baseColor = cfg.ROAD_COLOR || '#555';
    var colorVar  = ((idx * 17) & 7) - 3; // pseudo-random ±3 per segment
    var rgb = _adjustBrightness(baseColor, colorVar);
    ctx.fillStyle = rgb;

    // Draw the trapezoid: (clx,csy) → (crx,csy) → (nrx,nsy) → (nlx,nsy)
    ctx.beginPath();
    ctx.moveTo(clx, csy);
    ctx.lineTo(crx, csy);
    ctx.lineTo(nrx, nsy);
    ctx.lineTo(nlx, nsy);
    ctx.closePath();
    ctx.fill();

    // ── Edge lines ─────────────────────────────────────────────────────
    ctx.strokeStyle = cfg.LINE_COLOR || '#fff';
    ctx.lineWidth   = Math.max(cur.scale * 2.5, 1);
    ctx.beginPath();
    ctx.moveTo(clx, csy);
    ctx.lineTo(nlx, nsy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(crx, csy);
    ctx.lineTo(nrx, nsy);
    ctx.stroke();

    // ── Curbs on tight curves ──────────────────────────────────────────
    if (Math.abs(cur.seg.curvature) > (cfg.CURB_CURVATURE_THRESH || 0.0012)) {
      var curbW  = cfg.RUMBLE_WIDTH || 6;
      var curbScale = Math.max(cur.scale * curbW, 1);
      var isOuterRight = cur.seg.curvature < 0; // negative curvature = right turn, outer = left

      if (isOuterRight) {
        // Outer curb is on the left edge (outside of a right turn)
        _drawCurbSegment(ctx, clx, csy, nlx, nsy, curbScale, cur.dz, cfg);
      } else {
        // Outer curb is on the right edge (outside of a left turn)
        _drawCurbSegment(ctx, crx, csy, nrx, nsy, curbScale, cur.dz, cfg);
      }
    }
  }

  // ── Pass 2: Centre lane markings ─────────────────────────────────────
  _drawLaneMarkings(ctx, visible, cfg, total);

  ctx.restore();
};

/* ==========================================================================
   RENDERING HELPERS
   ========================================================================== */

/**
 * Projects a single track segment to screen coordinates.
 * Returns the centre screen position plus left/right edge positions.
 *
 * @param {Object} seg Segment object
 * @param {number} dz  Forward distance from camera (signed)
 * @param {Object} cam Camera object
 * @param {Object} cfg CONFIG object
 * @param {number} W   Canvas width
 * @param {number} H   Canvas height
 * @returns {{x:number, y:number, scale:number, lx:number, rx:number}}
 */
function _projectSegment(seg, dz, cam, cfg, W, H) {
  var coeff    = cfg.PERSPECTIVE_COEFF;
  var absDz    = dz < 0 ? -dz : dz;
  var scale    = cam.zoom / (1 + absDz * coeff);

  // Screen centre X — horizontal displacement from camera
  var dx   = seg.worldX - cam.x;
  var sx   = W / 2 + dx * scale;

  // Screen centre Y — incorporates elevation and forward distance
  // dz > 0 (ahead) → smaller sy (higher on screen, toward horizon)
  // dz < 0 (behind) → larger sy (lower on screen)
  var dy   = seg.worldY - cam.y;
  var sy   = H / 2 + dy * scale - dz * cfg.ROAD_V_OFFSET * scale;

  // Left/right edge screen positions
  var halfW = seg.width / 2;
  // Left edge: offset perpendicular to segment direction
  var cosA = Math.cos(seg.angle);
  var sinA = Math.sin(seg.angle);
  // Left = direction * halfWidth rotated 90° counter-clockwise
  var leftDx  = dx + cosA * halfW;
  var rightDx = dx - cosA * halfW;
  // Screen X for edges (same Y as centre, same scale)
  var lx = W / 2 + leftDx  * scale;
  var rx = W / 2 + rightDx * scale;

  return { x: sx, y: sy, scale: scale, lx: lx, rx: rx };
}

/**
 * Draws a single curb stripe segment between two screen-space points.
 * Alternates red/white based on distance along the track.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x1  Start X on screen
 * @param {number} y1  Start Y on screen
 * @param {number} x2  End X on screen
 * @param {number} y2  End Y on screen
 * @param {number} w   Curb width in screen pixels
 * @param {number} dz  Forward distance (for stripe index)
 * @param {Object} cfg CONFIG
 */
function _drawCurbSegment(ctx, x1, y1, x2, y2, w, dz, cfg) {
  var stripeLen = 25; // world units per stripe
  var idx = Math.floor(Math.abs(dz) / stripeLen);
  var color = (idx % 2 === 0) ? (cfg.RUMBLE_COLOR_A || '#ff0000')
                              : (cfg.RUMBLE_COLOR_B || '#ffffff');
  ctx.strokeStyle = color;
  ctx.lineWidth   = Math.max(w, 1.5);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/**
 * Draws dashed centre-line markings across visible road segments.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array}  visible Array of visible segment entries (sorted far→near)
 * @param {Object} cfg     CONFIG
 * @param {number} total   Total track length
 */
function _drawLaneMarkings(ctx, visible, cfg, total) {
  var dashLen  = cfg.LANE_MARKER_DASH || 40;
  var gapLen   = cfg.LANE_MARKER_GAP  || 30;
  var cycleLen = dashLen + gapLen;

  ctx.strokeStyle = cfg.LANE_MARKER_COLOR || '#ccc';

  for (var vi = 0; vi < visible.length; vi++) {
    var cur = visible[vi];
    var seg = cur.seg;
    var d   = seg.dist;

    // Determine if this segment is in a dash or gap
    var cyclePos = d % cycleLen;
    if (cyclePos < 0) cyclePos += cycleLen;
    if (cyclePos >= dashLen) continue; // gap — skip

    var lineW = Math.max(cur.scale * (cfg.LANE_MARKER_WIDTH || 1.5), 0.6);
    ctx.lineWidth = lineW;

    // Draw from centre position of this segment toward next
    // Use a short dash at the segment centre
    var dashScreenLen = Math.max(cur.scale * dashLen * 0.3, 3);
    var angle = seg.angle;
    var cosA  = Math.cos(angle);
    var sinA  = Math.sin(angle);
    // Forward direction in screen space (from the centre point)
    var fx = sinA * cur.scale * 8; // forward component projected to screen X
    var fy = -cfg.ROAD_V_OFFSET * cur.scale * 8; // forward component in screen Y

    ctx.beginPath();
    ctx.moveTo(cur.sx - fx, cur.sy - fy);
    ctx.lineTo(cur.sx + fx, cur.sy + fy);
    ctx.stroke();
  }
}

/**
 * Adjusts a hex colour string's brightness by a signed integer amount.
 * Preserves the colour format (#xxx or #xxxxxx).
 *
 * @param {string} hex    Hex colour (e.g. '#555')
 * @param {number} amount Signed adjustment (-255 to 255)
 * @returns {string} Adjusted hex colour
 */
function _adjustBrightness(hex, amount) {
  if (hex.charAt(0) === '#') hex = hex.slice(1);
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  var r = Math.min(255, Math.max(0, parseInt(hex.slice(0, 2), 16) + amount));
  var g = Math.min(255, Math.max(0, parseInt(hex.slice(2, 4), 16) + amount));
  var b = Math.min(255, Math.max(0, parseInt(hex.slice(4, 6), 16) + amount));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/* ==========================================================================
   R.getTrackDistanceAt(wx, wz) — Utility for AI / position tracking
   ========================================================================== */

/**
 * Returns the cumulative track distance of the nearest point on the track
 * centre-line to the given world position. Useful for AI lap tracking.
 *
 * @param {number} wx World X coordinate
 * @param {number} wz World Z coordinate
 * @returns {number} Track distance at nearest centre-line point
 */
R.getTrackDistanceAt = function (wx, wz) {
  var segs  = R.track.segments;
  var n     = segs.length;
  var bestIdx   = 0;
  var bestDist2 = Infinity;
  for (var i = 0; i < n; i++) {
    var dx = segs[i].worldX - wx;
    var dz = segs[i].worldZ - wz;
    var d2 = dx * dx + dz * dz;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      bestIdx   = i;
    }
  }
  return segs[bestIdx].dist;
};

/* ==========================================================================
   R.getSegmentAtDistance(dist) — Direct segment access
   ========================================================================== */

/**
 * Returns the segment object at a given track distance (no interpolation).
 * Wraps around for closed circuit.
 *
 * @param {number} dist Cumulative track distance
 * @returns {Object} The segment at that distance
 */
R.getSegmentAtDistance = function (dist) {
  var segs  = R.track.segments;
  var total = R.track.totalLength;
  var n     = segs.length;
  var d     = dist % total;
  if (d < 0) d += total;

  var lo = 0, hi = n - 1;
  while (lo < hi) {
    var mid = (lo + hi + 1) >> 1;
    if (segs[mid].dist <= d) lo = mid;
    else hi = mid - 1;
  }
  return segs[lo];
};

/* ==========================================================================
   R.getTrackWidth(dist) — Quick width lookup (AI avoidance)
   ========================================================================== */

/**
 * Returns the interpolated road width at a given track distance.
 * Convenience wrapper for AI / collision systems.
 *
 * @param {number} dist Cumulative track distance
 * @returns {number} Road width in world units
 */
R.getTrackWidth = function (dist) {
  var pos = R.getTrackPosition(dist);
  return pos.width;
};

/* ==========================================================================
   R.isOnTrackExtended(wx, wy, wz) — Full 3D collision check
   ========================================================================== */

/**
 * Extended on-track check that also verifies elevation proximity.
 * Useful for respawn logic or when cars go airborne (future).
 * Falls back to 2D check if worldY is unavailable.
 *
 * @param {number} wx World X
 * @param {number} wy World Y (elevation)
 * @param {number} wz World Z
 * @returns {{onTrack:boolean, distFromCenter:number, segmentIndex:number, elevationOk:boolean}}
 */
R.isOnTrackExtended = function (wx, wy, wz) {
  var result = R.isOnTrack(wx, wz);

  if (!result.onTrack) return result;

  // Check elevation proximity
  var seg       = R.track.segments[result.segmentIndex];
  var elevDiff  = Math.abs(wy - seg.worldY);
  var elevOk    = elevDiff < 80; // within 80 world units of segment elevation

  return {
    onTrack:        result.onTrack && elevOk,
    distFromCenter: result.distFromCenter,
    segmentIndex:   result.segmentIndex,
    halfWidth:      result.halfWidth,
    elevationOk:    elevOk
  };
};

/* ==========================================================================
   EXPORTS
   ==========================================================================
   Attached to window.R:
     R.initTrack()            — Generate closed-loop racing circuit
     R.getTrackPosition()     — Interpolated position lookup by distance
     R.isOnTrack()            — 2D on-track collision check
     R.isOnTrackExtended()    — 3D on-track check with elevation
     R.worldToScreen()        — Perspective world-to-screen projection
     R.renderSky(ctx)         — Sky gradient + horizon rendering
     R.renderTrack(ctx)       — Pseudo-3D road surface rendering
     R.getTrackDistanceAt()   — Nearest centre-line distance for a point
     R.getSegmentAtDistance() — Direct segment access
     R.getTrackWidth()        — Quick interpolated width lookup

   Populated data:
     R.track.segments[]       — Array of track segment objects
     R.track.totalLength      — Total track length in world units
     R.track.totalLaps        — Number of laps (from CONFIG)
     R.track.startX/Y/Z       — Spawn position (segment[0])
     R.track.startAngle       — Spawn facing direction
     R.track.checkpoints[]    — Evenly-spaced checkpoint positions

   Extended CONFIG keys (merged into R.CONFIG):
     TRACK_CONTROL_POINTS, TRACK_SEGMENTS_PER_CP, TRACK_BASE_RADIUS,
     TRACK_RADIUS_VAR1/2/3, TRACK_RADIUS_JITTER, ROAD_WIDTH_MIN,
     CURB_CURVATURE_THRESH, HILL_AMPLITUDE_A/B, HILL_FREQ_A/B,
     HILL_PHASE_B, RENDER_DISTANCE, RENDER_FADE_NEAR, HORIZON_Y,
     PERSPECTIVE_COEFF, ROAD_V_OFFSET, SEGMENT_COLOR_VAR,
     TRACK_BG_COLOR, TRACK_BG_COLOR_FAR, SHOULDER_COLOR
   ========================================================================== */
// === track.js — Racing Game ===
