const fs = require('fs');
let html = fs.readFileSync('C:/Users/13751/src/racing/index.html', 'utf8');

// ============================================================
// COMPREHENSIVE DIAGNOSTIC INSTRUMENTATION
// Instrument every layer: init, loop, render, each subsystem
// ============================================================

// 1. Wrap R.init with try-catch and logging
const oldInit = 'R.init = function () {';
const newInit = `R.init = function () {
  try {
    window._diag = { log: [], errors: [] };
    _diag.log.push('[init] R.init() called');
    _diag.log.push('[init] R.CONFIG=' + (R.CONFIG ? 'OK(' + Object.keys(R.CONFIG).length + ' keys)' : 'MISSING'));
    _diag.log.push('[init] document.body=' + (document.body ? 'OK' : 'MISSING'));
`;
html = html.replace(oldInit, newInit);

// 2. Log after canvas creation
const canvasCreate = "R.ctx    = canvas.getContext('2d');";
const canvasCreateDiag = `R.ctx    = canvas.getContext('2d');
  _diag.log.push('[init] canvas ' + canvas.width + 'x' + canvas.height + ' ctx=' + (R.ctx ? 'OK' : 'FAIL'));
  _diag.log.push('[init] body children=' + document.body.children.length);`;
html = html.replace(canvasCreate, canvasCreateDiag);

// 3. Log each subsystem init
const callIfExists = `function _callIfExists(fnName) {
  if (typeof R[fnName] === 'function') {
    R[fnName]();
  }
}`;
const callIfExistsDiag = `function _callIfExists(fnName) {
  _diag.log.push('[init] calling ' + fnName + ': ' + (typeof R[fnName]));
  if (typeof R[fnName] === 'function') {
    try {
      R[fnName]();
      _diag.log.push('[init] ' + fnName + ' OK');
    } catch(e) {
      _diag.log.push('[init] ' + fnName + ' ERROR: ' + e.message);
      _diag.errors.push(fnName + ': ' + e.message);
    }
  }
}`;
html = html.replace(callIfExists, callIfExistsDiag);

// 4. Log after init complete (before requestAnimationFrame)
const rafCall = 'requestAnimationFrame(R.loop);';
const rafCallDiag = `_diag.log.push('[init] starting game loop');
  _diag.log.push('[init] R.state.phase=' + (R.state ? R.state.phase : 'no-state'));
  _diag.log.push('[init] R.track=' + (R.track ? (R.track.segments ? R.track.segments.length + ' segs' : 'no-segs') : 'no-track'));
  _diag.log.push('[init] R.player=' + (R.player ? 'OK x=' + Math.round(R.player.x) : 'no-player'));
  _diag.log.push('[init] R.camera=' + (R.camera ? 'OK x=' + Math.round(R.camera.x) : 'no-camera'));
  _diag.log.push('[init] R.input=' + (R.input ? 'OK' : 'no-input'));
  _diag.log.push('[init] R.input._keys=' + (R.input && R.input._keys ? 'OK' : 'MISSING'));
  _diag.log.push('=== INIT COMPLETE ===');
  requestAnimationFrame(R.loop);`;
html = html.replace(rafCall, rafCallDiag);

// 5. Add frame counter and periodic logging to game loop
const oldLoop = 'R.loop = function (timestamp) {';
const newLoop = `R.loop = function (timestamp) {
  try {
  _diag._frameCount = (_diag._frameCount || 0) + 1;
  var isFirstFrame = (_diag._frameCount === 1);
  var is60thFrame = (_diag._frameCount === 60);`;
html = html.replace(oldLoop, newLoop);

// 6. Add rendering diagnostics
const oldRender = 'R.render = function () {';
const newRender = `R.render = function () {
  try {
  var ctx = R.ctx;
  if (!ctx) { _diag.errors.push('render: no ctx'); return; }`;
html = html.replace(oldRender, newRender);

// 7. Close the render try-catch
const renderEnd = '  ctx.restore();\n};';
const renderEndDiag = `  ctx.restore();
  } catch(e) { _diag.errors.push('render: ' + e.message); if (_diag._frameCount <= 5) _diag.log.push('[render] ERROR frame#' + _diag._frameCount + ': ' + e.message); }
};`;
html = html.replace(renderEnd, renderEndDiag);

// 8. Wrap the loop's requestAnimationFrame to catch errors
const loopEnd = '  requestAnimationFrame(R.loop);';
const loopEndDiag = `  if (isFirstFrame || is60thFrame) {
    _diag.log.push('[loop] frame#' + _diag._frameCount + ' phase=' + (R.state ? R.state.phase : '?'));
    _diag.log.push('[loop] errors so far: ' + _diag.errors.length);
  }
  } catch(e) { _diag.errors.push('loop: ' + e.message); _diag.log.push('[loop] CRASH frame#' + (_diag._frameCount||0) + ': ' + e.message); }
  requestAnimationFrame(R.loop);`;
html = html.replace(loopEnd, loopEndDiag);

// 9. Add diagnostic display function
const diagDisplay = `
R._showDiag = function() {
  var ctx = R.ctx;
  if (!ctx) return;
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, R.CONFIG.CANVAS_WIDTH, R.CONFIG.CANVAS_HEIGHT);
  ctx.fillStyle = '#0f0';
  ctx.font = '13px monospace';
  var y = 20;
  var entries = (_diag.log || []).slice(-40);
  for (var i = 0; i < entries.length; i++) {
    ctx.fillText(entries[i], 10, y);
    y += 17;
  }
  if (_diag.errors.length > 0) {
    ctx.fillStyle = '#f44';
    for (var j = 0; j < _diag.errors.length; j++) {
      ctx.fillText('ERR: ' + _diag.errors[j], 10, y);
      y += 17;
    }
  }
  ctx.restore();
};

// Override render to show diagnostics for first 5 seconds
var _origRender = R.render;
var _diagPhase = true;

// Add keyboard shortcut: press D to toggle diagnostic overlay
window.addEventListener('keydown', function(e) {
  if (e.code === 'KeyD' && e.ctrlKey) {
    _diagPhase = !_diagPhase;
  }
});
`;

// Insert before the window.onerror handler (or before </body>)
html = html.replace('window.onerror=function', diagDisplay + 'window.onerror=function');

// 10. Make render show diagnostics when _diagPhase is true
// We already instrumented render. Now the diagnostic will auto-show first frames.
// Let's modify render to show diagnostics for first 300 frames (5 seconds)
const renderCall = 'R.state.time += dt;\n  R.render();';
const renderCallDiag = `R.state.time += dt;
  R.render();
  // Show diagnostics for first 5 seconds (300 frames @ 60fps)
  if (_diag._frameCount <= 300 && R._showDiag) { R._showDiag(); }`;
html = html.replace(renderCall, renderCallDiag);

// Close init try-catch
const initEnd = 'requestAnimationFrame(R.loop);';
// This was already handled above

fs.writeFileSync('C:/Users/13751/src/racing/index.html', html);
console.log('Instrumented with full diagnostics');
console.log('Lines: ' + html.split('\n').length);
