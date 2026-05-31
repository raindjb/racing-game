const fs = require('fs');
let html = fs.readFileSync('C:/Users/13751/src/racing/index.html', 'utf8');

// =========================================================
// STEP 0: Add MISSING track config constants
// =========================================================
const newConfig = [
  '  R.CONFIG.TRACK_CONTROL_POINTS      = 16;',
  '  R.CONFIG.TRACK_SEGMENTS_PER_CP     = 12;',
  '  R.CONFIG.TRACK_BASE_RADIUS         = 1200;',
  '  R.CONFIG.TRACK_RADIUS_VAR1         = 250;',
  '  R.CONFIG.TRACK_RADIUS_VAR2         = 180;',
  '  R.CONFIG.TRACK_RADIUS_VAR3         = 100;',
  '  R.CONFIG.TRACK_RADIUS_JITTER       = 80;',
  '  R.CONFIG.TRACK_SEED                = null;',
  '  R.CONFIG.PERSPECTIVE_COEFF         = 0.0005;',
  '  R.CONFIG.LAP_CHECKPOINT_COUNT      = 5;',
  '  R.CONFIG.SCENERY_SEGMENT_STEP      = 5;',
  '  R.CONFIG.SCENERY_GRANDSTAND_SEGMENT_INDEX = 0;',
  '  R.CONFIG.TRACK_BG_COLOR            = "#3a5a2c";',
  '  R.CONFIG.TRACK_ROAD_COLOR          = "#555555";',
  '  R.CONFIG.TRACK_CURB_COLOR          = "#cc3333";',
  '  R.CONFIG.TRACK_LINE_COLOR          = "#ffffff";',
  '  R.CONFIG.TRACK_CURB_ALT_COLOR      = "#ffffff";',
].join('\n');

const insertMarker = 'R.CONFIG.SCENERY_OBJECTS       = 80;';
const insertPoint = html.indexOf(insertMarker);
if (insertPoint >= 0) {
  html = html.substring(0, insertPoint) + newConfig + '\n  ' + html.substring(insertPoint);
  console.log('Added missing TRACK config constants');
}

// =========================================================
// STEP 1: Simplify worldToScreen to pure 2D (remove perspective distortion)
// =========================================================
const oldWTS = `R.worldToScreen = function (wx, wy, wz) {
    // Defaults
    if (wz === undefined) wz = 0;
    var cam = R.camera;
    if (!cam) return { x: wx, y: wy, scale: 1 };

    var zoom  = cam.zoom  || 1;
    var scale = zoom / (1 + wz * 0.002);   // perspective divisor
    var sx    = R.CONFIG.CANVAS_WIDTH  / 2 + (wx - (cam.x || 0)) * scale;
    var sy    = R.CONFIG.CANVAS_HEIGHT / 2 + (wy - (cam.y || 0)) * scale;

    return { x: sx, y: sy, scale: scale };
  };`;

const newWTS = `R.worldToScreen = function (wx, wy, wz) {
    // Simple 2D top-down projection with camera offset
    var cam = R.camera;
    if (!cam) return { x: wx, y: wy, scale: 1 };
    var zoom = cam.zoom || 1;
    var sx = R.CONFIG.CANVAS_WIDTH / 2 + (wx - (cam.x || 0)) * zoom;
    var sy = R.CONFIG.CANVAS_HEIGHT / 2 + (wy - (cam.y || 0)) * zoom;
    return { x: sx, y: sy, scale: zoom };
  };`;

if (html.includes(oldWTS)) {
  html = html.replace(oldWTS, newWTS);
  console.log('Fixed: worldToScreen → 2D projection');
} else {
  console.log('WARNING: worldToScreen not found with expected pattern');
}

// =========================================================
// STEP 2: Fix player module — replace local worldToScreen
// =========================================================
// Find the player module boundaries
const playerMarker = '<!-- ========== player.js ========== -->';
const aiMarker = '<!-- ========== ai.js ========== -->';
const playerStart = html.indexOf(playerMarker);
const aiStart = html.indexOf(aiMarker);

if (playerStart >= 0 && aiStart > playerStart) {
  let playerSection = html.substring(playerStart, aiStart);

  // Remove the local worldToScreen function definition
  const localWtsMatch = playerSection.match(/function worldToScreen\(wx,\s*wy\)\s*\{[\s\S]*?return \{ x: sx, y: sy \};[\s\n]*\}/);
  if (localWtsMatch) {
    playerSection = playerSection.replace(localWtsMatch[0], '// Using R.worldToScreen instead of local worldToScreen');
    console.log('Fixed: removed local worldToScreen from player.js');
  }

  // Replace remaining local calls with R.worldToScreen
  const remaining = playerSection.match(/[^.]worldToScreen\(/g);
  if (remaining) {
    playerSection = playerSection.replace(/([^.])worldToScreen\(/g, '$1R.worldToScreen(');
    console.log('Fixed: ' + remaining.length + ' local worldToScreen calls → R.worldToScreen');
  }

  html = html.substring(0, playerStart) + playerSection + html.substring(aiStart);
}

// =========================================================
// STEP 3: Fix AI module's worldToScreenPos
// =========================================================
const collisionMarker = '<!-- ========== collision.js ========== -->';
const collisionStart = html.indexOf(collisionMarker);

if (aiStart >= 0 && collisionStart > aiStart) {
  let aiSection = html.substring(aiStart, collisionStart);

  // Replace worldToScreenPos calls
  const posCalls = aiSection.match(/worldToScreenPos\(/g);
  if (posCalls) {
    aiSection = aiSection.replace(/worldToScreenPos\(/g, 'R.worldToScreen(');
    console.log('Fixed: ' + posCalls.length + ' worldToScreenPos calls → R.worldToScreen');
  }

  // Remove worldToScreenPos definition
  const posDef = aiSection.match(/function worldToScreenPos\(wx,\s*wz,\s*wy\)\s*\{[\s\S]*?return \{ x: [\s\S]*?\};[\s\n]*\}/);
  if (posDef) {
    aiSection = aiSection.replace(posDef[0], '// worldToScreenPos removed — using R.worldToScreen');
    console.log('Fixed: removed worldToScreenPos definition');
  }

  html = html.substring(0, aiStart) + aiSection + html.substring(collisionStart);
}

// =========================================================
// STEP 4: Fix R.updateCamera to track player properly
// =========================================================
if (html.includes('R.updateCamera = function')) {
  // Ensure camera tracks player position in 2D
  console.log('Camera update exists, keeping as-is');
}

// =========================================================
// STEP 5: Ensure R.input._keys can't be lost
// =========================================================
// Add a safety getter to always provide _keys
html = html.replace(
  'R.input = R.input || {};',
  'R.input = R.input || {}; if (!R.input._keys) { R.input._keys = {}; }'
);

// =========================================================
// STEP 6: Check player init position
// =========================================================
const initPlayerIdx = html.indexOf('R.initPlayer = function');
if (initPlayerIdx >= 0) {
  const initPlayerChunk = html.substring(initPlayerIdx, initPlayerIdx + 500);
  if (initPlayerChunk.includes('R.track.startX') || initPlayerChunk.includes('track start')) {
    console.log('Player init references track start position ✓');
  } else {
    console.log('WARNING: Player init might not use track start position');
  }
}

fs.writeFileSync('C:/Users/13751/src/racing/index.html', html);
// =========================================================
// STEP 6: Safety checks for missing track/scenery
// =========================================================
html = html.replace(
  'R.initScenery = function () {',
  'R.initScenery = function () { if (!R.track || !R.track.segments) return;'
);
html = html.replace(
  'R.renderTrack = function (ctx) {',
  'R.renderTrack = function (ctx) { if (!R.track || !R.track.segments) return;'
);
console.log('Added safety checks');

// =========================================================
// STEP 7: Also fix renderCars to check for player
// =========================================================
html = html.replace(
  'if (typeof R.renderCars    === \'function\') { R.renderCars(ctx); }',
  'if (typeof R.renderCars === \'function\' && R.player) { R.renderCars(ctx); }'
);

// =========================================================
// STEP 8: Debug overlay — add BEFORE existing render
// =========================================================
const oldRender2 = 'R.render = function () {';
const newRender2 = [
  'R.render = function () {',
  '  var ctx = R.ctx;',
  '  if (!ctx) return;',
  '  // DEBUG INFO',
  '  ctx.save();',
  '  ctx.setTransform(1,0,0,1,0,0);',
  '  ctx.fillStyle = "#1a3a1a";',
  '  ctx.fillRect(0, 0, R.CONFIG.CANVAS_WIDTH, R.CONFIG.CANVAS_HEIGHT);',
  '  ctx.fillStyle = "#0f0";',
  '  ctx.font = "16px monospace";',
  '  ctx.fillText("Phase: " + (R.state ? R.state.phase : "no-state"), 20, 30);',
  '  ctx.fillText("Track: " + (R.track && R.track.segments ? R.track.segments.length + " segs" : "no-track"), 20, 55);',
  '  ctx.fillText("Player: " + (R.player ? "x=" + Math.round(R.player.x) + " y=" + Math.round(R.player.y) : "no-player"), 20, 80);',
  '  ctx.fillText("Camera: " + (R.camera ? "x=" + Math.round(R.camera.x) + " y=" + Math.round(R.camera.y) : "no-cam"), 20, 105);',
  '  ctx.restore();',
  '  // ---- original render follows ----',
].join('\n');

html = html.replace(oldRender2, newRender2);
console.log('Added debug overlay BEFORE existing render');

fs.writeFileSync('C:/Users/13751/src/racing/index.html', html);
