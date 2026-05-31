// === scenery.js — Racing Game ===
// Track-side scenery generation and rendering.
// Buildings, trees, billboards, barriers, grandstands, and crowds.

// ---------------------------------------------------------------------------
// Scenery configuration — extend R.CONFIG
// ---------------------------------------------------------------------------
R.CONFIG = R.CONFIG || {};
R.CONFIG.SCENERY_OBJECTS = R.CONFIG.SCENERY_OBJECTS || 600;
R.CONFIG.SCENERY_CULL_DISTANCE = R.CONFIG.SCENERY_CULL_DISTANCE || 1200;
R.CONFIG.SCENERY_CULL_MARGIN = R.CONFIG.SCENERY_CULL_MARGIN || 200;
R.CONFIG.SCENERY_SEGMENT_STEP = R.CONFIG.SCENERY_SEGMENT_STEP || 5;
R.CONFIG.SCENERY_TRACK_EDGE_OFFSET_MIN = R.CONFIG.SCENERY_TRACK_EDGE_OFFSET_MIN || 30;
R.CONFIG.SCENERY_TRACK_EDGE_OFFSET_MAX = R.CONFIG.SCENERY_TRACK_EDGE_OFFSET_MAX || 220;
R.CONFIG.SCENERY_BUILDING_CLUSTER_RANGE = R.CONFIG.SCENERY_BUILDING_CLUSTER_RANGE || 30;
R.CONFIG.SCENERY_GRANDSTAND_SEGMENT_INDEX = R.CONFIG.SCENERY_GRANDSTAND_SEGMENT_INDEX || 0;

// ---------------------------------------------------------------------------
// Scenery object pool
// ---------------------------------------------------------------------------
R.sceneryObjects = [];

// ---------------------------------------------------------------------------
// Internal constants (not tunable via CONFIG — visual constants)
// ---------------------------------------------------------------------------

const SCENERY_TYPES = ['building', 'tree', 'billboard', 'barrier', 'grandstand'];
// Weighted distribution: buildings (25%), trees (40%), billboards (15%), barriers (15%), grandstands (5%)
const SCENERY_WEIGHTS = [25, 40, 15, 15, 5];

const TREE_GREENS = ['#2d5a1e', '#3b7a2d', '#4a8c3f', '#1e4d2b', '#5a7d3a', '#2e6b20'];
const BUILDING_COLORS = ['#c4c4c4', '#d4c8b8', '#b8b4a8', '#ccc0b0', '#beb8a8', '#d0d0d0',
                         '#c8bca8', '#b0b0c0', '#c0b8b0', '#d8d0c0'];
const ROOF_COLORS = ['#8b4513', '#a0522d', '#6b3410', '#7b3f20', '#8b3a3a', '#696969',
                     '#4a4a4a', '#555555'];
const BILLBOARD_COLORS = ['#ff4444', '#4488ff', '#ffaa00', '#44cc44', '#ff44ff',
                           '#ffdd00', '#00cccc', '#ff6688'];
const SKIN_TONES = ['#f5c6a0', '#e8b88a', '#d4a574', '#c68642', '#f0d5b0', '#e0ac69'];
const SHIRT_COLORS = ['#e03030', '#3030e0', '#30a030', '#e0a030', '#30a0a0', '#8030a0',
                       '#e06060', '#d0d0d0', '#202020', '#f0a030'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Weighted random selection from SCENERY_TYPES using SCENERY_WEIGHTS.
 * @returns {string} scenery type key
 */
function weightedRandomType() {
  let total = 0;
  for (let i = 0; i < SCENERY_WEIGHTS.length; i++) {
    total += SCENERY_WEIGHTS[i];
  }
  let roll = Math.random() * total;
  for (let i = 0; i < SCENERY_WEIGHTS.length; i++) {
    roll -= SCENERY_WEIGHTS[i];
    if (roll <= 0) {
      return SCENERY_TYPES[i];
    }
  }
  return 'tree';
}

/**
 * Random int in [min, max].
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random float in [min, max].
 */
function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Pick a random element from an array.
 */
function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Linear interpolation.
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Clamp a value.
 */
function clamp(val, lo, hi) {
  return val < lo ? lo : val > hi ? hi : val;
}

/**
 * Compute screen-space depth from world position relative to camera.
 * Positive z means farther away (on screen, y goes down; worldZ tilts toward horizon).
 */
function computeScreenDepth(worldX, worldY, worldZ, camX, camY) {
  // Approximate: distance from camera position (ignoring z for simplicity)
  var dx = worldX - camX;
  var dy = worldY - camY;
  var dist = Math.sqrt(dx * dx + dy * dy);
  return dist + worldZ * 0.5; // z pushes into depth
}

// ---------------------------------------------------------------------------
// R.initScenery — populate R.sceneryObjects along the track
// ---------------------------------------------------------------------------
R.initScenery = function () {
  R.sceneryObjects = [];
  var segments = R.track.segments;
  if (!segments || segments.length === 0) return;

  var step = R.CONFIG.SCENERY_SEGMENT_STEP;
  var totalSegments = segments.length;
  var startFinishSeg = R.CONFIG.SCENERY_GRANDSTAND_SEGMENT_INDEX;

  // Pre-compute per-segment direction vectors for perpendicular offsets
  var dirs = [];
  for (var i = 0; i < totalSegments; i++) {
    var prev = segments[(i - 1 + totalSegments) % totalSegments];
    var curr = segments[i];
    var dx = curr.worldX - prev.worldX;
    var dy = curr.worldY - prev.worldY;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) {
      // degenerate — reuse previous dir
      dirs.push(dirs.length > 0 ? dirs[dirs.length - 1] : { dx: 1, dy: 0, len: 1 });
    } else {
      dirs.push({ dx: dx / len, dy: dy / len, len: len });
    }
  }

  // Place grandstand near start/finish line, off to the right
  var startSeg = segments[startFinishSeg];
  var startDir = dirs[startFinishSeg];
  var perpX = -startDir.dy; // right perpendicular
  var perpY = startDir.dx;
  R.sceneryObjects.push({
    worldX: startSeg.worldX + perpX * 150,
    worldY: startSeg.worldY + perpY * 150,
    worldZ: startSeg.worldZ,
    type: 'grandstand',
    width: 300,
    height: 120,
    color: randPick(BUILDING_COLORS),
    variant: 1
  });

  // Generate scenery along every Nth segment
  var buildingClusterSegments = [];
  for (var s = 0; s < totalSegments; s += step) {
    var seg = segments[s];
    var dir = dirs[s];
    var perpRightX = -dir.dy;
    var perpRightY = dir.dx;

    // Determine if this segment is near start/finish (for building clustering)
    var distFromHome = Math.min(
      Math.abs(s - startFinishSeg),
      totalSegments - Math.abs(s - startFinishSeg)
    );

    // Choose type — rural vs urban bias
    var rawType = weightedRandomType();
    if (rawType === 'building') {
      if (distFromHome > R.CONFIG.SCENERY_BUILDING_CLUSTER_RANGE) {
        // Far from start/finish — convert some buildings to trees
        if (Math.random() < 0.7) rawType = 'tree';
      }
    }
    if (rawType === 'tree') {
      if (distFromHome <= R.CONFIG.SCENERY_BUILDING_CLUSTER_RANGE && Math.random() < 0.3) {
        rawType = 'building'; // some trees become buildings near start/finish
      }
    }

    // Only one grandstand (placed above)
    if (rawType === 'grandstand') {
      rawType = 'building';
    }

    // Choose side: left or right (biased toward outside of curves)
    var side = Math.random() < 0.5 ? 1 : -1;
    if (seg.curvature !== undefined && seg.curvature !== 0) {
      // Bias toward outside of curve
      side = seg.curvature > 0 ? 1 : -1;
      if (Math.random() < 0.3) side = -side; // 30% chance of inner placement
    }

    var offsetDist = randFloat(
      R.CONFIG.SCENERY_TRACK_EDGE_OFFSET_MIN,
      R.CONFIG.SCENERY_TRACK_EDGE_OFFSET_MAX
    ) + seg.width * 0.5;

    var obj = {
      worldX: seg.worldX + perpRightX * offsetDist * side,
      worldY: seg.worldY + perpRightY * offsetDist * side,
      worldZ: seg.worldZ || 0,
      type: rawType,
      width: 0,
      height: 0,
      color: '',
      variant: 0,
      rotation: 0
    };

    // Tune dimensions and color by type
    switch (rawType) {
      case 'building':
        obj.width = randInt(30, 90);
        obj.height = randInt(40, 160);
        obj.color = randPick(BUILDING_COLORS);
        obj.variant = randInt(0, 3); // 0=flat roof, 1=peaked, 2=wide, 3=tall+narrow
        buildingClusterSegments.push(s);
        break;

      case 'tree':
        obj.width = randInt(18, 40);
        obj.height = randInt(30, 70);
        obj.color = randPick(TREE_GREENS);
        obj.variant = randInt(0, 2); // 0=round, 1=pine, 2=double-canopy
        obj.rotation = randFloat(-0.3, 0.3); // slight random lean
        break;

      case 'billboard':
        obj.width = randInt(40, 70);
        obj.height = randInt(50, 90);
        obj.color = randPick(BILLBOARD_COLORS);
        obj.variant = randInt(0, 1); // 0=single pole, 1=double pole
        break;

      case 'barrier':
        obj.width = randInt(15, 30);
        obj.height = randInt(8, 16);
        obj.color = '#cc0000'; // red base, white stripes added in render
        obj.variant = 0;
        // Place barriers closer to track edge
        obj.worldX = seg.worldX + perpRightX * (seg.width * 0.5 + randInt(5, 15)) * side;
        obj.worldY = seg.worldY + perpRightY * (seg.width * 0.5 + randInt(5, 15)) * side;
        break;

      default:
        break;
    }

    R.sceneryObjects.push(obj);
  }

  // Depth-sort by worldZ + distance from origin (approximate back-to-front for rendering)
  // We'll sort per-frame in render for accurate camera-relative depth.
};

// ---------------------------------------------------------------------------
// R.renderScenery — render visible scenery objects
// ---------------------------------------------------------------------------
R.renderScenery = function () {
  var ctx = R.ctx;
  var cam = R.camera;
  var cullDist = R.CONFIG.SCENERY_CULL_DISTANCE;
  var margin = R.CONFIG.SCENERY_CULL_MARGIN;
  var objects = R.sceneryObjects;
  var n = objects.length;
  if (n === 0) return;

  var camX = cam.x;
  var camY = cam.y;

  // First pass: compute screen positions and depth, collect visible objects
  var visible = [];
  for (var i = 0; i < n; i++) {
    var obj = objects[i];
    var screen = R.worldToScreen
      ? R.worldToScreen(obj.worldX, obj.worldY, obj.worldZ)
      : defaultWorldToScreen(obj.worldX, obj.worldY, obj.worldZ, camX, camY, cam.zoom);

    if (!screen || !screen.visible) continue;

    // Cull by screen-space bounding box with margin
    var hw = obj.width * screen.scale * 0.5;
    var hh = obj.height * screen.scale * 0.5;
    if (screen.x + hw < -margin || screen.x - hw > R.canvas.width + margin ||
        screen.y + hh < -margin || screen.y - hh > R.canvas.height + margin) {
      continue;
    }

    // Depth for sorting
    obj._depth = computeScreenDepth(obj.worldX, obj.worldY, obj.worldZ, camX, camY);
    obj._screenX = screen.x;
    obj._screenY = screen.y;
    obj._scale = screen.scale;
    visible.push(obj);
  }

  // Sort by depth (far to near — paint back to front)
  visible.sort(function (a, b) { return b._depth - a._depth; });

  // Second pass: draw each visible object
  for (var v = 0; v < visible.length; v++) {
    var o = visible[v];
    ctx.save();
    drawSceneryObject(ctx, o, o._screenX, o._screenY, o._scale);
    ctx.restore();
  }
};

// ---------------------------------------------------------------------------
// drawSceneryObject — route to type-specific renderer
// ---------------------------------------------------------------------------
function drawSceneryObject(ctx, obj, sx, sy, scale) {
  switch (obj.type) {
    case 'building':
      drawBuilding(ctx, obj, sx, sy, scale);
      break;
    case 'tree':
      drawTree(ctx, obj, sx, sy, scale);
      break;
    case 'billboard':
      drawBillboard(ctx, obj, sx, sy, scale);
      break;
    case 'barrier':
      drawBarrier(ctx, obj, sx, sy, scale);
      break;
    case 'grandstand':
      drawGrandstand(ctx, obj, sx, sy, scale);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// drawBuilding — rectangle body + windows + roof + shadow
// ---------------------------------------------------------------------------
function drawBuilding(ctx, obj, sx, sy, scale) {
  var w = obj.width * scale;
  var h = obj.height * scale;
  var x = sx - w * 0.5;
  var y = sy - h; // bottom-aligned at ground

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(sx, sy, w * 0.55, w * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Building body
  ctx.fillStyle = obj.color;
  ctx.fillRect(x, y, w, h);

  // Outline
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = Math.max(1, scale * 1.5);
  ctx.strokeRect(x, y, w, h);

  // Windows
  var windowCols = Math.max(2, Math.floor(w / (10 * scale)));
  var windowRows = Math.max(2, Math.floor(h / (14 * scale)));
  if (windowCols < 1) windowCols = 1;
  if (windowRows < 1) windowRows = 1;
  var winW = (w * 0.7) / windowCols;
  var winH = (h * 0.6) / windowRows;
  var startX = x + w * 0.15;
  var startY = y + h * 0.1;

  // Seed deterministic per-building window pattern
  var seed = (obj.worldX * 31 + obj.worldY * 17) % 1000;

  for (var row = 0; row < windowRows; row++) {
    for (var col = 0; col < windowCols; col++) {
      var lit = ((seed + row * 7 + col * 13) % 5) < 3; // ~60% lit
      ctx.fillStyle = lit
        ? 'rgba(255,255,200,0.75)'
        : 'rgba(40,40,60,0.6)';
      var wx = startX + col * (winW + w * 0.02);
      var wy = startY + row * (winH + h * 0.03);
      ctx.fillRect(wx, wy, winW, winH);

      // Window frame
      ctx.strokeStyle = lit ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.35)';
      ctx.lineWidth = Math.max(0.5, scale * 0.5);
      ctx.strokeRect(wx, wy, winW, winH);
    }
  }

  // Door
  var doorW = w * 0.18;
  var doorH = h * 0.25;
  var doorX = sx - doorW * 0.5;
  var doorY = sy - doorH;
  ctx.fillStyle = 'rgba(60,40,30,0.8)';
  ctx.fillRect(doorX, doorY, doorW, doorH);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = Math.max(0.5, scale * 0.7);
  ctx.strokeRect(doorX, doorY, doorW, doorH);
  // Doorknob
  ctx.fillStyle = 'rgba(200,180,100,0.7)';
  ctx.beginPath();
  ctx.arc(doorX + doorW * 0.8, doorY + doorH * 0.5, Math.max(1, scale * 1.5), 0, Math.PI * 2);
  ctx.fill();

  // Roof
  var roofH = h * 0.15;
  switch (obj.variant) {
    case 0: // flat roof — slightly wider
      ctx.fillStyle = randPick(ROOF_COLORS);
      ctx.fillRect(x - w * 0.05, y - roofH, w * 1.1, roofH);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = Math.max(0.5, scale * 0.7);
      ctx.strokeRect(x - w * 0.05, y - roofH, w * 1.1, roofH);
      break;

    case 1: // peaked roof (triangle)
      ctx.fillStyle = randPick(ROOF_COLORS);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.08, y);
      ctx.lineTo(sx, y - roofH * 2);
      ctx.lineTo(x + w + w * 0.08, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = Math.max(0.5, scale * 0.7);
      ctx.stroke();
      break;

    case 2: // wide building — flat with slight overhang
      ctx.fillStyle = randPick(ROOF_COLORS);
      ctx.fillRect(x - w * 0.08, y - roofH, w * 1.16, roofH);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = Math.max(0.5, scale * 0.5);
      ctx.strokeRect(x - w * 0.08, y - roofH, w * 1.16, roofH);
      break;

    case 3: // tall narrow — flat roof + chimney
      ctx.fillStyle = randPick(ROOF_COLORS);
      ctx.fillRect(x - w * 0.04, y - roofH, w * 1.08, roofH);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = Math.max(0.5, scale * 0.5);
      ctx.strokeRect(x - w * 0.04, y - roofH, w * 1.08, roofH);
      // Chimney
      var chimW = w * 0.12;
      var chimH = roofH * 3;
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(x + w * 0.65, y - roofH - chimH, chimW, chimH);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = Math.max(0.3, scale * 0.4);
      ctx.strokeRect(x + w * 0.65, y - roofH - chimH, chimW, chimH);
      break;

    default:
      ctx.fillStyle = randPick(ROOF_COLORS);
      ctx.fillRect(x - w * 0.05, y - roofH, w * 1.1, roofH);
      break;
  }
}

// ---------------------------------------------------------------------------
// drawTree — circle canopy on brown trunk
// ---------------------------------------------------------------------------
function drawTree(ctx, obj, sx, sy, scale) {
  var w = obj.width * scale;
  var h = obj.height * scale;
  var trunkW = w * 0.2;
  var trunkH = h * 0.4;
  var canopyR = w * 0.5;

  // Rotation for slight lean
  var rot = obj.rotation || 0;

  ctx.save();
  if (rot !== 0) {
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    ctx.translate(-sx, -sy);
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(sx, sy, canopyR * 0.8, canopyR * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trunk
  var trunkX = sx - trunkW * 0.5;
  var trunkY = sy - trunkH - canopyR * 0.3;
  ctx.fillStyle = '#6b4226';
  ctx.fillRect(trunkX, trunkY, trunkW, trunkH);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = Math.max(0.5, scale * 0.5);
  ctx.strokeRect(trunkX, trunkY, trunkW, trunkH);

  // Canopy
  var canopyY = trunkY - canopyR * 0.5;
  var green = obj.color;

  switch (obj.variant) {
    case 0: // round canopy
      ctx.fillStyle = green;
      ctx.beginPath();
      ctx.arc(sx, canopyY, canopyR, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(sx - canopyR * 0.2, canopyY - canopyR * 0.2, canopyR * 0.5, 0, Math.PI * 2);
      ctx.fill();
      // Outline
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = Math.max(0.5, scale * 0.6);
      ctx.beginPath();
      ctx.arc(sx, canopyY, canopyR, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 1: // pine tree — triangular tiers
      var pineCY = trunkY - canopyR * 0.0;
      for (var tier = 0; tier < 3; tier++) {
        var tierW = canopyR * (1.2 - tier * 0.35);
        var tierH = canopyR * 0.8;
        var tierTopY = pineCY - tier * tierH * 0.5;
        ctx.fillStyle = tier === 0 ? green : shadeColor(green, -10 * tier);
        ctx.beginPath();
        ctx.moveTo(sx, tierTopY - tierH);
        ctx.lineTo(sx - tierW, tierTopY);
        ctx.lineTo(sx + tierW, tierTopY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = Math.max(0.5, scale * 0.4);
        ctx.stroke();
      }
      break;

    case 2: // double canopy — two overlapping circles
      var c1Y = canopyY - canopyR * 0.1;
      ctx.fillStyle = green;
      ctx.beginPath();
      ctx.arc(sx - canopyR * 0.25, c1Y, canopyR * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shadeColor(green, 10);
      ctx.beginPath();
      ctx.arc(sx + canopyR * 0.25, c1Y, canopyR * 0.65, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.arc(sx - canopyR * 0.35, c1Y - canopyR * 0.2, canopyR * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;

    default:
      ctx.fillStyle = green;
      ctx.beginPath();
      ctx.arc(sx, canopyY, canopyR, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// drawBillboard — tall rectangle with colored ad
// ---------------------------------------------------------------------------
function drawBillboard(ctx, obj, sx, sy, scale) {
  var w = obj.width * scale;
  var h = obj.height * scale;
  var poleW = Math.max(2, w * 0.12);
  var poleH = h * 0.25;
  var boardH = h * 0.75;
  var x = sx - w * 0.5;
  var y = sy - h;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(sx, sy, w * 0.45, w * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pole(s)
  ctx.fillStyle = '#555555';
  if (obj.variant === 0) {
    // Single center pole
    ctx.fillRect(sx - poleW * 0.5, sy - poleH, poleW, poleH);
  } else {
    // Double poles
    ctx.fillRect(x + w * 0.15, sy - poleH, poleW, poleH);
    ctx.fillRect(x + w * 0.85 - poleW, sy - poleH, poleW, poleH);
  }

  // Board background (white)
  var boardX = x;
  var boardY = y;
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(boardX, boardY, w, boardH);

  // Colored ad panel (center portion)
  var adPadding = w * 0.08;
  var adX = boardX + adPadding;
  var adY = boardY + adPadding;
  var adW = w - adPadding * 2;
  var adH = boardH * 0.55;
  ctx.fillStyle = obj.color;
  ctx.fillRect(adX, adY, adW, adH);

  // "Text" lines on ad
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  var lineH = Math.max(1, adH * 0.08);
  var lines = 3;
  for (var li = 0; li < lines; li++) {
    var lw = adW * (0.5 + Math.random() * 0.4);
    var lx = adX + adW * 0.1;
    var ly = adY + adH * 0.25 + li * adH * 0.25;
    ctx.fillRect(lx, ly, lw, lineH);
  }

  // Bottom text area
  var bottomY = adY + adH + adPadding * 0.5;
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(adX, bottomY, adW, Math.max(2, boardH * 0.12));

  // Border
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = Math.max(1, scale * 1);
  ctx.strokeRect(boardX, boardY, w, boardH);
}

// ---------------------------------------------------------------------------
// drawBarrier — red-white striped rectangle
// ---------------------------------------------------------------------------
function drawBarrier(ctx, obj, sx, sy, scale) {
  var w = obj.width * scale;
  var h = obj.height * scale;
  var x = sx - w * 0.5;
  var y = sy - h;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(sx, sy, w * 0.45, w * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // Barrier body with stripes
  var stripeCount = Math.max(2, Math.floor(w / (6 * scale)));
  var stripeW = w / stripeCount;

  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = Math.max(0.5, scale * 0.5);

  for (var s = 0; s < stripeCount; s++) {
    ctx.fillStyle = s % 2 === 0 ? '#cc0000' : '#ffffff';
    var sx2 = x + s * stripeW;
    ctx.fillRect(sx2, y, stripeW, h);
    ctx.strokeRect(sx2, y, stripeW, h);
  }
}

// ---------------------------------------------------------------------------
// drawGrandstand — multi-tier seating structure
// ---------------------------------------------------------------------------
function drawGrandstand(ctx, obj, sx, sy, scale) {
  var w = obj.width * scale;
  var h = obj.height * scale;
  var x = sx - w * 0.5;
  var y = sy - h;
  var tiers = 6;
  var tierH = h * 0.55 / tiers; // seating takes bottom 55%
  var roofH = h * 0.45;
  var tierOffset = w * 0.03;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(sx, sy, w * 0.6, w * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main structure
  ctx.fillStyle = '#888888';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = Math.max(1, scale * 1.5);
  ctx.strokeRect(x, y, w, h);

  // Seating tiers — each row a different color
  var tierColors = ['#cc3333', '#3366cc', '#33aa33', '#ccaa33', '#aa3366', '#33aaaa'];
  var baseY = y + roofH;
  for (var t = 0; t < tiers; t++) {
    var tw = w - t * tierOffset * 2; // each tier slightly narrower
    var tx = x + t * tierOffset;
    var ty = baseY + t * tierH;
    ctx.fillStyle = tierColors[t % tierColors.length];
    ctx.fillRect(tx, ty, tw, tierH);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = Math.max(0.5, scale * 0.4);
    ctx.strokeRect(tx, ty, tw, tierH);

    // Row of seat dots
    if (tw > 8 && tierH > 3) {
      var dotCount = Math.floor(tw / (3 * scale));
      var dotSpacing = tw / (dotCount + 1);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (var d = 0; d < dotCount; d++) {
        var dx = tx + (d + 1) * dotSpacing;
        ctx.beginPath();
        ctx.arc(dx, ty + tierH * 0.5, Math.max(0.5, scale * 0.8), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Roof
  ctx.fillStyle = '#666666';
  ctx.fillRect(x - w * 0.05, y, w * 1.1, roofH * 0.15);
  // Roof slant
  ctx.fillStyle = '#555555';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.08, y + roofH * 0.15);
  ctx.lineTo(sx, y - roofH * 0.15);
  ctx.lineTo(x + w + w * 0.08, y + roofH * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = Math.max(0.5, scale * 0.6);
  ctx.stroke();

  // Support pillars
  var pillarW = Math.max(2, scale * 3);
  ctx.fillStyle = '#777777';
  ctx.fillRect(x + w * 0.05, y + roofH * 0.1, pillarW, h * 0.5);
  ctx.fillRect(x + w * 0.95 - pillarW, y + roofH * 0.1, pillarW, h * 0.5);
}

// ---------------------------------------------------------------------------
// R.renderCrowd — draw crowd dots in grandstand
// ---------------------------------------------------------------------------
R.renderCrowd = function (grandstandX, grandstandY) {
  var ctx = R.ctx;
  var cam = R.camera;
  var screen = R.worldToScreen
    ? R.worldToScreen(grandstandX, grandstandY, 0)
    : defaultWorldToScreen(grandstandX, grandstandY, 0, cam.x, cam.y, cam.zoom);

  if (!screen || !screen.visible) return;
  if (screen.x < -200 || screen.x > R.canvas.width + 200 ||
      screen.y < -200 || screen.y > R.canvas.height + 200) return;

  // Find main grandstand object for dimensions
  var gs = null;
  for (var i = 0; i < R.sceneryObjects.length; i++) {
    if (R.sceneryObjects[i].type === 'grandstand') {
      gs = R.sceneryObjects[i];
      break;
    }
  }
  if (!gs) return;

  var scale = screen.scale;
  var w = gs.width * scale;
  var h = gs.height * scale;
  var x = screen.x - w * 0.5;
  var y = screen.y - h;
  var roofH = h * 0.45;
  var tiers = 6;
  var tierH = h * 0.55 / tiers;
  var tierOffset = w * 0.03;
  var baseY = y + roofH;

  // Crowd dots per tier
  for (var t = 0; t < tiers; t++) {
    var tw = w - t * tierOffset * 2;
    var tx = x + t * tierOffset;
    var ty = baseY + t * tierH;
    var peoplePerRow = Math.floor(tw / Math.max(3, 4 * scale));
    if (peoplePerRow < 1) peoplePerRow = 1;

    // Seed based on tier
    var seed = t * 137 + 42;

    for (var p = 0; p < peoplePerRow; p++) {
      var px = tx + tw * (p + 0.5) / peoplePerRow;
      var py = ty + tierH * 0.35;
      // Skip some seats for natural look
      if (((seed + p * 11) % 7) === 0) continue;

      // Small person dot
      var skin = SKIN_TONES[(seed + p * 3) % SKIN_TONES.length];
      var shirt = SHIRT_COLORS[(seed + p * 7) % SHIRT_COLORS.length];
      var dotR = Math.max(1.2, scale * 1.8);

      // Head
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(px, py - dotR * 0.4, dotR * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = shirt;
      ctx.fillRect(px - dotR * 0.4, py, dotR * 0.8, dotR * 0.9);
    }
  }
};

// ---------------------------------------------------------------------------
// Helper: shade a hex color darker or lighter
// ---------------------------------------------------------------------------
function shadeColor(color, percent) {
  var num = parseInt(color.replace('#', ''), 16);
  var amt = Math.round(2.55 * percent);
  var R = (num >> 16) + amt;
  var G = ((num >> 8) & 0x00ff) + amt;
  var B = (num & 0x0000ff) + amt;
  R = R < 0 ? 0 : R > 255 ? 255 : R;
  G = G < 0 ? 0 : G > 255 ? 255 : G;
  B = B < 0 ? 0 : B > 255 ? 255 : B;
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// ---------------------------------------------------------------------------
// Helper: default world-to-screen projection (fallback if R.worldToScreen is
// not yet defined). Uses simple perspective projection with camera offset.
// ---------------------------------------------------------------------------
function defaultWorldToScreen(wx, wy, wz, camX, camY, zoom) {
  var canvasW = R.canvas.width;
  var canvasH = R.canvas.height;
  var cx = canvasW * 0.5;
  var cy = canvasH * 0.4; // horizon line

  // World offset relative to camera
  var rx = wx - camX;
  var ry = wy - camY;
  var rz = wz; // elevation

  // Simple perspective: farther objects appear higher and smaller
  var perspectiveFactor = 1;
  if (ry > 1) {
    perspectiveFactor = 300 / ry;
  } else {
    perspectiveFactor = 1;
  }

  var scale = perspectiveFactor * zoom;
  var sx = cx + rx * perspectiveFactor * zoom;
  var sy = cy - rz * perspectiveFactor * zoom + perspectiveFactor * zoom * 50;

  // Visibility check
  var visible = perspectiveFactor > 0.01 && perspectiveFactor < 2.0;
  if (ry <= 0) visible = false;

  return { x: sx, y: sy, scale: scale, visible: visible };
}

// ---------------------------------------------------------------------------
// Exported interface:
//   R.CONFIG.SCENERY_OBJECTS          — target count for scenery generation
//   R.CONFIG.SCENERY_CULL_DISTANCE    — max screen distance for drawing
//   R.CONFIG.SCENERY_CULL_MARGIN      — extra margin beyond viewport
//   R.CONFIG.SCENERY_SEGMENT_STEP     — segments between scenery placements
//   R.CONFIG.SCENERY_TRACK_EDGE_*     — offset range from track edge
//   R.CONFIG.SCENERY_BUILDING_CLUSTER_RANGE — urban zone radius
//   R.sceneryObjects                  — array of scenery objects
//   R.initScenery()                   — generate scenery along track
//   R.renderScenery()                 — render visible scenery each frame
//   R.renderCrowd(gx, gy)             — draw crowd dots in grandstand
// ---------------------------------------------------------------------------
