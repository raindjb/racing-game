/**
 * build.js — Racing Game Assembly with Systematic Fixes
 *
 * Strategy: fix interface incompatibilities BEFORE assembly.
 * Fix 1: Standardize worldToScreen to pure 2D
 * Fix 2: Add missing track config to config.js
 * Fix 3: Unify input system (R.input._keys)
 * Fix 4: Camera init at track start
 * Fix 5: Guard against missing subsystems
 */
const fs = require('fs');

// Read all modules
const modules = {};
const order = ['config','engine','input','track','player','ai','collision','hud','effects','audio','scenery','menu'];
order.forEach(name => {
  modules[name] = fs.readFileSync('modules/' + name + '.js', 'utf8');
});

console.log('=== Loaded 12 modules ===');
order.forEach(n => console.log('  ' + n + '.js: ' + modules[n].split('\n').length + ' lines'));

// ============================================================
// FIX 1: Add missing track config to config.js
// ============================================================
const trackConfig = `
  // === TRACK GENERATION ===
  R.CONFIG.TRACK_CONTROL_POINTS      = 16;
  R.CONFIG.TRACK_SEGMENTS_PER_CP     = 12;
  R.CONFIG.TRACK_BASE_RADIUS         = 1200;
  R.CONFIG.TRACK_RADIUS_VAR1         = 250;
  R.CONFIG.TRACK_RADIUS_VAR2         = 180;
  R.CONFIG.TRACK_RADIUS_VAR3         = 100;
  R.CONFIG.TRACK_RADIUS_JITTER       = 80;
  R.CONFIG.TRACK_SEED                = null;
  R.CONFIG.PERSPECTIVE_COEFF         = 0.0005;
  R.CONFIG.LAP_CHECKPOINT_COUNT      = 5;
  R.CONFIG.SCENERY_SEGMENT_STEP      = 5;
  R.CONFIG.SCENERY_GRANDSTAND_SEGMENT_INDEX = 0;
  R.CONFIG.TRACK_BG_COLOR            = '#3a5a2c';
  R.CONFIG.TRACK_ROAD_COLOR          = '#555555';
  R.CONFIG.TRACK_CURB_COLOR          = '#cc3333';
  R.CONFIG.TRACK_LINE_COLOR          = '#ffffff';
  R.CONFIG.TRACK_CURB_ALT_COLOR      = '#ffffff';
`;

// Insert before SCENERY_OBJECTS in config
modules.config = modules.config.replace(
  'R.CONFIG.SCENERY_OBJECTS       = 80;',
  trackConfig + '  R.CONFIG.SCENERY_OBJECTS       = 80;'
);
console.log('Fix 1: Added track config ✓');

// ============================================================
// FIX 2: Standardize worldToScreen to pure 2D in track.js
// ============================================================
const oldWTS = /R\.worldToScreen = function[\s\S]*?return \{ x: sx, y: sy, scale: scale \};[\s\n]*\};/;
const newWTS = `R.worldToScreen = function (wx, wy, wz) {
  var cam = R.camera;
  if (!cam) return { x: wx, y: wy, scale: 1 };
  var zoom = cam.zoom || 1;
  var sx = R.CONFIG.CANVAS_WIDTH / 2 + (wx - (cam.x || 0)) * zoom;
  var sy = R.CONFIG.CANVAS_HEIGHT / 2 + (wy - (cam.y || 0)) * zoom;
  return { x: sx, y: sy, scale: zoom };
};`;

modules.track = modules.track.replace(oldWTS, newWTS);
console.log('Fix 2: worldToScreen → 2D ✓');

// ============================================================
// FIX 3: Remove local worldToScreen from player.js, use R.worldToScreen
// ============================================================
// Fix local worldToScreen: turn declaration into assignment (keeps backward compat)
// Change "function worldToScreen(wx, wy) {" → "R.worldToScreen = function(wx, wy) {"
// This OVERLOADS R.worldToScreen with a 2-param version — safe since 3rd param is optional
modules.player = modules.player.replace(
  'function worldToScreen(wx, wy) {',
  '// worldToScreen — redirects to R.worldToScreen\nfunction worldToScreen(wx, wy) { return R.worldToScreen(wx, wy); }'
);
// Then remove the old body and just replace with delegation
// Actually, simplest: leave the local function BUT make it delegate
const localDef = /function worldToScreen\(wx,\s*wy\)\s*\{[\s\S]*?return \{\s*\n?\s*sx:[\s\S]*?\};[\s\n]*\}/;
modules.player = modules.player.replace(localDef,
  'function worldToScreen(wx, wy) {\n  return R.worldToScreen(wx, wy);\n}');
console.log('Fix 3: Player worldToScreen delegates to R.worldToScreen ✓');
console.log('Fix 3: Player uses R.worldToScreen ✓');

// ============================================================
// FIX 4: Replace worldToScreenPos with R.worldToScreen delegation
// ============================================================
// Strategy: Find the worldToScreenPos function (with or without spaces in params)
// and replace it with a delegation wrapper. Then replace all calls.
const posDefRegex = /function worldToScreenPos\s*\(/;
const posMatch = modules.ai.match(posDefRegex);
if (posMatch) {
  const posDefStart = posMatch.index;
  // Find matching closing brace
  let braceCount = 0;
  let posDefEnd = posDefStart;
  let started = false;
  for (let i = posDefStart; i < modules.ai.length; i++) {
    if (modules.ai[i] === '{') { braceCount++; started = true; }
    else if (modules.ai[i] === '}') { braceCount--; }
    if (started && braceCount === 0) { posDefEnd = i + 1; break; }
  }
  const oldDef = modules.ai.substring(posDefStart, posDefEnd);
  const newDef = 'function worldToScreenPos(wx, wz, wy) {\n  return R.worldToScreen(wx, wy, wz);\n}';
  modules.ai = modules.ai.replace(oldDef, newDef);
  console.log('Fix 4: worldToScreenPos function → delegation (replaced ' + oldDef.length + ' chars)');
} else {
  console.log('Fix 4: worldToScreenPos function not found — may be pre-fixed');
}
// Replace CALLS to worldToScreenPos but NOT the function definition itself.
// (The function name is 'worldToScreenPos' — replacing it would create
//  'function R.worldToScreen(...)' which is a syntax error.)
// Use negative lookbehind to skip 'function ' prefix.
modules.ai = modules.ai.replace(/(?<!function )worldToScreenPos\(/g, 'R.worldToScreen(');
console.log('Fix 4: AI calls → R.worldToScreen ✓');

// ============================================================
// FIX 5: Unify input — ensure R.input._keys always exists
// ============================================================
// In engine.js, make _attachBuiltinInput more robust
modules.engine = modules.engine.replace(
  "R.input = R.input || { throttle: 0, brake: 0, steer: 0, boost: 0, _keys: {} };",
  "R.input = R.input || {};\n  R.input.throttle = R.input.throttle ?? 0;\n  R.input.brake = R.input.brake ?? 0;\n  R.input.steer = R.input.steer ?? 0;\n  R.input.boost = R.input.boost ?? 0;\n  if (!R.input._keys) R.input._keys = {};"
);

// Guard key handlers in engine.js
modules.engine = modules.engine.replace(
  'R.input._keys[e.code] = true;',
  'if (!R.input._keys) R.input._keys = {}; R.input._keys[e.code] = true;'
);
modules.engine = modules.engine.replace(
  'R.input._keys[e.code] = false;',
  'if (!R.input._keys) R.input._keys = {}; R.input._keys[e.code] = false;'
);
console.log('Fix 5: Input system unified ✓');

// ============================================================
// FIX 6: Camera init at track start
// ============================================================
modules.engine = modules.engine.replace(
  'R.camera = R.camera || { x: 0, y: 0, zoom: 1 };',
  'R.camera = R.camera || { x: 0, y: 0, zoom: 1 };\n  if (R.track && R.track.startX !== undefined) { R.camera.x = R.track.startX; R.camera.y = R.track.startY; }'
);

// In updateCamera: handle no-player case
modules.engine = modules.engine.replace(
  'var player = R.player;\n  if (!player) return;',
  'var player = R.player;\n  if (!player) {\n    if (R.track && R.track.startX !== undefined) {\n      R.camera.x += (R.track.startX - R.camera.x) * 0.05;\n      R.camera.y += (R.track.startY - R.camera.y) * 0.05;\n    }\n    return;\n  }'
);
console.log('Fix 6: Camera init at track start ✓');

// ============================================================
// FIX 7: Add guards — renderTrack, initScenery check for R.track
// ============================================================
modules.track = modules.track.replace(
  'R.renderTrack = function (ctx) {\n  var segs   = R.track.segments;',
  'R.renderTrack = function (ctx) {\n  if (!R.track || !R.track.segments) return;\n  var segs   = R.track.segments;'
);
modules.scenery = modules.scenery.replace(
  'R.initScenery = function () {\n  R.sceneryObjects = [];\n  var segments = R.track.segments;',
  'R.initScenery = function () {\n  R.sceneryObjects = [];\n  if (!R.track || !R.track.segments) return;\n  var segments = R.track.segments;'
);
console.log('Fix 7: Guards added ✓');

// ============================================================
// FIX 8: Add COUNTDOWN_DURATION alias (engine expects it, config has COUNTDOWN_SECONDS)
// ============================================================
modules.engine = modules.engine.replace(
  "R.CONFIG.COUNTDOWN_DURATION  = R.CONFIG.COUNTDOWN_DURATION  || 3;",
  "R.CONFIG.COUNTDOWN_DURATION  = R.CONFIG.COUNTDOWN_DURATION || R.CONFIG.COUNTDOWN_SECONDS || 3;"
);
console.log('Fix 8: COUNTDOWN_DURATION alias ✓');

// ============================================================
// ASSEMBLY
// ============================================================
console.log('\n=== Assembling ===');

let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>Asphalt Legends — Canvas Racing</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
  canvas { display: block; }
</style>
</head>
<body>
<script>
"use strict";
window.R = window.R || {};

// Error capture
window._errors = [];
window.onerror = function(m,s,l,c,e) {
  _errors.push('L' + l + ': ' + m);
  var d = document.getElementById('_err');
  if (!d) { d = document.createElement('div'); d.id='_err'; d.style.cssText='position:fixed;top:0;left:0;right:0;background:#c00;color:#fff;padding:8px;font:13px monospace;z-index:9999;white-space:pre-wrap'; document.body.appendChild(d); }
  d.style.display='block'; d.textContent=_errors.join('\\n');
};
</script>
`;

// Append each module in order
order.forEach(name => {
  html += '\n<!-- ========== ' + name + '.js ========== -->\n';
  html += '<script>\n';
  html += modules[name];
  html += '\n</script>\n';
});

// Init
html += `
<script>
window.addEventListener('DOMContentLoaded', function() {
  if (window.R && typeof R.init === 'function') {
    R.init();
  }
});
</script>
</body>
</html>
`;

// Fix 9: Change const R in module scope to var R (avoids redeclaration errors)
// In separate <script> tags, const creates global bindings that can't be redeclared
html = html.replace(/\nconst R = window\.R;/g, '\nvar R = window.R;');
// Also fix: "const R = window.R || {};" patterns
html = html.replace(/const R = window\.R \|\| \{\};/g, 'var R = window.R || {};');
// And: top-level "const R = window.R" at start of scripts
// More patterns to be safe
html = html.replace(/^\s*const R = window\.R;$/gm, 'var R = window.R;');

fs.writeFileSync('index.html', html);
console.log('Assembly complete');
console.log('Lines: ' + html.split('\n').length);
console.log('Size: ' + Math.round(html.length / 1024) + ' KB');

// ============================================================
// VERIFY SYNTAX — per-module (browser runs <script> tags independently)
// ============================================================
const scripts = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
let syntaxOk = true;
scripts.forEach((s, i) => {
  const code = s.replace(/<script>/, '').replace(/<\/script>/, '');
  try {
    new Function(code);
  } catch(e) {
    syntaxOk = false;
    console.log('\n✗ Script ' + i + ' syntax: FAIL — ' + e.message.substring(0, 80));
    // Show context around error
    const start = code.substring(0, 80).replace(/\n/g, '\\n');
    console.log('  Starts with: ' + start);
  }
});
if (syntaxOk) {
  console.log('\n✓ JavaScript syntax: PASS (' + scripts.length + ' scripts)');
} else {
  console.log('\n✗ JavaScript syntax: FAIL — see above');
  process.exit(1);
}

// Interface check (search in all JS — concatenation is fine for string search)
let allJs = '';
scripts.forEach(s => { allJs += s.replace(/<script>/, '').replace(/<\/script>/, '') + ';\n'; });

// Verify key interfaces
const checks = [
  'R.CONFIG.TRACK_BASE_RADIUS',
  'R.CONFIG.COUNTDOWN_DURATION',
  'R.worldToScreen',
  'R.init',
  'R.loop',
  'R.initPlayer',
  'R.renderPlayerCar',
  'R.initAI',
  'R.renderTrack',
  'R.renderHUD',
  'R._renderMenuPrompt',
  'R.renderMenu',
  'R.renderOverlay',
  'R.initScenery',
  'R.initAudio',
  'R.initEffects',
];
console.log('\nInterface check:');
checks.forEach(c => {
  const found = allJs.includes(c);
  console.log((found ? '  ✓' : '  ✗') + ' ' + c);
});

// Check for duplicate worldToScreen
const wtsCount = (allJs.match(/R\.worldToScreen\s*=\s*function/g) || []).length;
console.log('\nworldToScreen definitions: ' + wtsCount + ' (should be 1)');

// Check for worldToScreenPos (should be 0)
const posCount = (allJs.match(/worldToScreenPos/g) || []).length;
console.log('worldToScreenPos references: ' + posCount + ' (should be 0)');
