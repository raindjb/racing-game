// === hud.js — Racing Game ===
// Heads-up display: speedometer, minimap, position tracker, lap counter,
// race timer, drift indicator, countdown, and race results overlay.
// All rendering helpers attach to window.R.

(function () {
  'use strict';

  var R = window.R;

  // ── Default config (overridable via R.CONFIG) ──────────────────────
  const CFG = R.CONFIG;
  if (CFG.HUD == null) CFG.HUD = {};

  // Speedometer
  CFG.HUD.SPEEDO_X          = CFG.HUD.SPEEDO_X          ?? 120;
  CFG.HUD.SPEEDO_Y          = CFG.HUD.SPEEDO_Y          ?? 580;
  CFG.HUD.SPEEDO_RADIUS     = CFG.HUD.SPEEDO_RADIUS     ?? 80;
  CFG.HUD.SPEEDO_NEEDLE_LEN = CFG.HUD.SPEEDO_NEEDLE_LEN ?? 62;
  CFG.HUD.SPEEDO_ARC_START  = CFG.HUD.SPEEDO_ARC_START  ?? Math.PI * 0.75;
  CFG.HUD.SPEEDO_ARC_END    = CFG.HUD.SPEEDO_ARC_END    ?? Math.PI * 2.25;

  // Position badge
  CFG.HUD.POS_BADGE_X       = CFG.HUD.POS_BADGE_X       ?? 1120;
  CFG.HUD.POS_BADGE_Y       = CFG.HUD.POS_BADGE_Y       ?? 30;

  // Lap counter
  CFG.HUD.LAP_X             = CFG.HUD.LAP_X             ?? 1120;
  CFG.HUD.LAP_Y             = CFG.HUD.LAP_Y             ?? 120;
  CFG.HUD.LAP_BAR_WIDTH     = CFG.HUD.LAP_BAR_WIDTH     ?? 140;
  CFG.HUD.LAP_BAR_HEIGHT    = CFG.HUD.LAP_BAR_HEIGHT    ?? 12;

  // Minimap
  CFG.HUD.MINIMAP_X         = CFG.HUD.MINIMAP_X         ?? 1100;
  CFG.HUD.MINIMAP_Y         = CFG.HUD.MINIMAP_Y         ?? 540;
  CFG.HUD.MINIMAP_SIZE      = CFG.HUD.MINIMAP_SIZE      ?? 140;

  // Race timer
  CFG.HUD.TIMER_X           = CFG.HUD.TIMER_X           ?? 640;
  CFG.HUD.TIMER_Y           = CFG.HUD.TIMER_Y           ?? 30;

  // Drift indicator
  CFG.HUD.DRIFT_X           = CFG.HUD.DRIFT_X           ?? 640;
  CFG.HUD.DRIFT_Y           = CFG.HUD.DRIFT_Y           ?? 670;
  CFG.HUD.DRIFT_BAR_WIDTH   = CFG.HUD.DRIFT_BAR_WIDTH   ?? 180;
  CFG.HUD.DRIFT_BAR_HEIGHT  = CFG.HUD.DRIFT_BAR_HEIGHT  ?? 12;

  // Position update interval (seconds)
  CFG.HUD.POSITION_UPDATE_INTERVAL = CFG.HUD.POSITION_UPDATE_INTERVAL ?? 0.5;

  // Countdown
  CFG.HUD.COUNTDOWN_DURATION = CFG.HUD.COUNTDOWN_DURATION ?? 0.8;

  // ── Internal state ──────────────────────────────────────────────────
  let _minimapCanvas = null;
  let _minimapCtx    = null;

  /** Current track-progress offset (percentage 0–1) for each car, keyed by car index */
  let _carProgress = [];

  /** Previous sort order snapshot to detect position changes */
  let _prevSortedIds = [];

  /** Timestamp of last position update (game time) */
  let _lastPositionUpdate = -999;

  /** Position-change bounce timers per car index: { index: remainingSeconds } */
  let _bounceTimers = {};

  /** Player's best lap time in seconds (null = no completed lap yet) */
  let _bestLapTime = null;

  /** Timestamp when player started current lap */
  let _lapStartTime = 0;

  /** Whether the player has started their first lap */
  let _hasStartedLap = false;

  /** Countdown animation state */
  let _countdownNumber   = 0;
  let _countdownElapsed  = 0;
  let _countdownActive   = false;

  /** Cached race results snapshot for the finished overlay */
  let _finalResults = null;

  // ── Initialization ──────────────────────────────────────────────────

  /**
   * R.initHUD()
   * Initialize HUD state. Create offscreen canvas for minimap.
   * Called once before the game loop starts.
   */
  R.initHUD = function () {
    var size = CFG.HUD.MINIMAP_SIZE;
    _minimapCanvas = document.createElement('canvas');
    _minimapCanvas.width  = size;
    _minimapCanvas.height = size;
    _minimapCtx = _minimapCanvas.getContext('2d');

    _carProgress    = [];
    _prevSortedIds  = [];
    _bounceTimers   = {};
    _bestLapTime    = null;
    _lapStartTime   = 0;
    _hasStartedLap  = false;
    _finalResults   = null;
    _countdownActive   = false;
    _countdownNumber   = 0;
    _countdownElapsed  = 0;
  };

  // ── Per-frame update ────────────────────────────────────────────────

  /**
   * R.updateHUD(dt)
   * Update minimap state, position tracking, lap timer, and countdown animation.
   * @param {number} dt — delta time in seconds
   */
  R.updateHUD = function (dt) {
    // Countdown animation tick
    if (_countdownActive) {
      _countdownElapsed += dt;
      if (_countdownElapsed >= CFG.HUD.COUNTDOWN_DURATION) {
        _countdownActive = false;
      }
    }

    // Decay position-change bounce timers
    var keys = Object.keys(_bounceTimers);
    for (var i = 0; i < keys.length; i++) {
      var idx = keys[i];
      _bounceTimers[idx] -= dt;
      if (_bounceTimers[idx] <= 0) {
        delete _bounceTimers[idx];
      }
    }

    // Lap timing
    if (R.player && R.state && R.state.phase === 'racing') {
      if (!_hasStartedLap) {
        _lapStartTime  = R.state.time;
        _hasStartedLap = true;
      }
      // Detect lap completion: if player's lap advances, record lap time
      if (R.player.currentLap !== undefined && R.player.lastRecordedLap == null) {
        R.player.lastRecordedLap = R.player.lap || 0;
      }
      if (R.player.currentLap !== undefined && R.player.lastRecordedLap !== R.player.currentLap) {
        var lapTime = R.state.time - _lapStartTime;
        if (_bestLapTime == null || lapTime < _bestLapTime) {
          _bestLapTime = lapTime;
        }
        _lapStartTime = R.state.time;
        R.player.lastRecordedLap = R.player.currentLap;
      }
    }

    // Periodic position sorting
    var needsSort = (R.state.time - _lastPositionUpdate) >= CFG.HUD.POSITION_UPDATE_INTERVAL;
    if (needsSort && R.state.phase === 'racing') {
      var sorted = R.sortCarsByPosition ? R.sortCarsByPosition() : [];
      if (sorted.length > 0) {
        // Detect position changes by comparing to previous
        var newIds = [];
        for (var s = 0; s < sorted.length; s++) {
          newIds.push(sorted[s]._carIndex != null ? sorted[s]._carIndex : s);
        }
        if (_prevSortedIds.length === newIds.length) {
          for (var j = 0; j < newIds.length; j++) {
            if (newIds[j] !== _prevSortedIds[j]) {
              _bounceTimers[newIds[j]] = 0.35;
            }
          }
        }
        _prevSortedIds = newIds;
        _lastPositionUpdate = R.state.time;
      } else {
        _lastPositionUpdate = R.state.time;
      }
    }
  };

  // ── Main render ─────────────────────────────────────────────────────

  /**
   * R.renderHUD()
   * Main HUD render call. Dispatches to sub-renderers in order.
   * Called every frame from the render loop.
   */
  R.renderHUD = function () {
    // Always render time-critical overlays first (countdown / finished / menu)
    R.renderOverlay();

    // Only render gameplay HUD during racing or countdown (not menu/finished)
    if (!R.state) return;

    var phase = R.state.phase;
    if (phase === 'menu' || phase === 'finished') {
      // In finished, still show results overlay (handled in renderOverlay)
      // In menu, only show the menu overlay
      return;
    }

    R.renderSpeedometer();
    R.renderPositionBadge();
    R.renderLapCounter();
    R.renderMiniMap();
    R.renderRaceTimer();
    R.renderDriftIndicator();
  };

  // ── Overlay dispatcher ──────────────────────────────────────────────

  /**
   * R.renderOverlay()
   * Dispatch to the correct overlay based on game phase.
   */
  R.renderOverlay = function () {
    var phase = R.state && R.state.phase;
    if (!phase) return;

    switch (phase) {
      case 'countdown':
        if (_countdownActive) {
          R.renderCountdown(_countdownNumber);
        }
        break;
      case 'finished':
        R.renderRaceResults();
        break;
      case 'menu':
        R._renderMenuPrompt();
        break;
    }
  };

  // ── Speedometer ─────────────────────────────────────────────────────

  /**
   * R.renderSpeedometer()
   * Draw analog-style speedometer at SPEEDO_X, SPEEDO_Y.
   * Outer circle, tick marks, colored zones, needle, digital readout.
   */
  R.renderSpeedometer = function () {
    var ctx  = R.ctx;
    var cx   = CFG.HUD.SPEEDO_X;
    var cy   = CFG.HUD.SPEEDO_Y;
    var r    = CFG.HUD.SPEEDO_RADIUS;
    var nLen = CFG.HUD.SPEEDO_NEEDLE_LEN;
    var a0   = CFG.HUD.SPEEDO_ARC_START;
    var a1   = CFG.HUD.SPEEDO_ARC_END;

    var player = R.player;
    if (!player) return;
    var maxSpeed  = player.maxSpeed || 200;
    var speed     = player.speed  || 0;
    var speedFrac = Math.min(speed / maxSpeed, 1);

    ctx.save();

    // Outer circle — dark background with subtle gradient
    var grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
    grad.addColorStop(0, '#2a2a2a');
    grad.addColorStop(0.85, '#111111');
    grad.addColorStop(1, '#000000');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(cx, cy, r - 12, 0, Math.PI * 2);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Colored zones: green 0–50%, yellow 50–80%, red 80–100%
    var zoneDefs = [
      { from: 0,   to: 0.5, color: 'rgba(0,200,60,0.25)'  },
      { from: 0.5, to: 0.8, color: 'rgba(220,200,0,0.25)'  },
      { from: 0.8, to: 1.0, color: 'rgba(220,40,40,0.30)'  }
    ];
    for (var z = 0; z < zoneDefs.length; z++) {
      var zd   = zoneDefs[z];
      var za0  = a0 + (a1 - a0) * zd.from;
      var za1  = a0 + (a1 - a0) * zd.to;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 6, za0, za1);
      ctx.lineWidth = 4;
      ctx.strokeStyle = zd.color;
      ctx.stroke();
    }

    // Tick marks every 10 units (0 to maxSpeed+2)
    var tickStep = 10;
    var tickMax  = Math.ceil((maxSpeed + 2) / tickStep) * tickStep;
    for (var v = 0; v <= tickMax; v += tickStep) {
      var frac  = Math.min(v / maxSpeed, 1);
      var angle = a0 + (a1 - a0) * frac;
      var isMajor = (v % 40 === 0);
      var innerR  = isMajor ? r - 20 : r - 14;
      var outerR  = r - 5;
      var tx1 = cx + Math.cos(angle) * innerR;
      var ty1 = cy + Math.sin(angle) * innerR;
      var tx2 = cx + Math.cos(angle) * outerR;
      var ty2 = cy + Math.sin(angle) * outerR;

      ctx.beginPath();
      ctx.moveTo(tx1, ty1);
      ctx.lineTo(tx2, ty2);
      ctx.strokeStyle = isMajor ? '#ddd' : '#777';
      ctx.lineWidth   = isMajor ? 2 : 1;
      ctx.stroke();

      // Label every 40 units
      if (isMajor) {
        var lblR = r - 28;
        var lx   = cx + Math.cos(angle) * lblR;
        var ly   = cy + Math.sin(angle) * lblR;
        ctx.font         = 'bold 9px "Courier New", monospace';
        ctx.fillStyle    = '#ddd';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(v), lx, ly);
      }
    }

    // Needle
    var needleAngle = a0 + (a1 - a0) * speedFrac;
    var nx = cx + Math.cos(needleAngle) * nLen;
    var ny = cy + Math.sin(needleAngle) * nLen;

    // Needle shadow
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy + 1);
    ctx.lineTo(nx + 1, ny + 1);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth   = 3;
    ctx.stroke();

    // Needle
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    // Center cap
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ff3333';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();

    // Digital readout centered below
    var digiY = cy + r * 0.55;
    var speedKmh = Math.round(speed);
    ctx.font         = 'bold 22px "Courier New", monospace';
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(speedKmh + ' km/h', cx, digiY);

    // "SPEED" label
    ctx.font         = 'bold 10px Arial, sans-serif';
    ctx.fillStyle    = '#aaaaaa';
    ctx.textBaseline = 'top';
    ctx.fillText('SPEED', cx, digiY + 24);

    ctx.restore();
  };

  // ── Position Badge ──────────────────────────────────────────────────

  /**
   * R.renderPositionBadge()
   * Top-right corner. Show "1st / 6" with large bold position number.
   * Color-coded: 1st=gold, 2nd=silver, 3rd=bronze, rest=white.
   * Animate position changes with scale bounce.
   */
  R.renderPositionBadge = function () {
    var ctx = R.ctx;
    var px  = CFG.HUD.POS_BADGE_X;
    var py  = CFG.HUD.POS_BADGE_Y;

    var player     = R.player;
    var totalCars  = R.cars ? R.cars.length : 1;
    var position   = 1;
    var playerIdx  = -1;

    // Determine player position and index
    if (player && R.cars) {
      for (var i = 0; i < R.cars.length; i++) {
        if (R.cars[i] === player) {
          playerIdx = i;
          break;
        }
      }
      // Use sorted order if available
      var sorted = R.sortCarsByPosition ? R.sortCarsByPosition() : null;
      if (sorted && sorted.length > 0) {
        for (var s = 0; s < sorted.length; s++) {
          var entry = sorted[s];
          var idx   = entry._carIndex != null ? entry._carIndex : s;
          if (idx === playerIdx) {
            position = s + 1;
            break;
          }
        }
      }
    }

    // Bounce scale
    var bounce = 1;
    if (playerIdx >= 0 && _bounceTimers[playerIdx]) {
      var tRemain = _bounceTimers[playerIdx];
      var tTotal  = 0.35;
      var t       = 1 - (tRemain / tTotal); // 0→1
      // Eased bounce: sin decay
      bounce = 1 + Math.sin(t * Math.PI) * 0.25 * (1 - t);
    }

    // Color based on position
    var posColor = '#ffffff';
    if (position === 1) posColor = '#ffd700';
    else if (position === 2) posColor = '#c0c0c0';
    else if (position === 3) posColor = '#cd7f32';

    // Ordinal suffix
    var suffix = 'th';
    if (position === 1) suffix = 'st';
    else if (position === 2) suffix = 'nd';
    else if (position === 3) suffix = 'rd';

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(bounce, bounce);

    // Background panel
    var panelW = 120;
    var panelH = 72;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    R._roundRect(ctx, -panelW / 2, 0, panelW, panelH, 8);

    // Position number — large
    var posText = position + suffix;
    ctx.font         = 'bold 30px Arial, sans-serif';
    ctx.fillStyle    = posColor;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    // Dark outline for readability
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth   = 3;
    ctx.strokeText(posText, 0, 6);
    ctx.fillText(posText, 0, 6);

    // "/ total" below
    ctx.font         = '14px Arial, sans-serif';
    ctx.fillStyle    = '#cccccc';
    ctx.textBaseline = 'top';
    ctx.lineWidth    = 1.5;
    ctx.strokeStyle  = 'rgba(0,0,0,0.6)';
    ctx.strokeText('/ ' + totalCars, 0, 40);
    ctx.fillText('/ ' + totalCars, 0, 40);

    ctx.restore();
  };

  // ── Lap Counter ─────────────────────────────────────────────────────

  /**
   * R.renderLapCounter()
   * Below position badge. "LAP 2 / 3" with progress bar showing lap completion %.
   */
  R.renderLapCounter = function () {
    var ctx = R.ctx;
    var lx  = CFG.HUD.LAP_X;
    var ly  = CFG.HUD.LAP_Y;
    var bw  = CFG.HUD.LAP_BAR_WIDTH;
    var bh  = CFG.HUD.LAP_BAR_HEIGHT;

    var player    = R.player;
    var track     = R.track;
    var totalLaps = (track && track.totalLaps) ? track.totalLaps : 3;
    var curLap    = player ? (player.lap || 1) : 1;
    // Clamp display lap
    var displayLap = Math.min(curLap, totalLaps);

    // Estimate lap progress (0–1) based on checkpoint index and car x position
    var progress = 0;
    if (player && track && track.segments && track.segments.length > 0) {
      var segs = track.segments;
      // Simple progress: fraction of track based on player x vs total track length
      var segIdx  = player.checkpointIdx || 0;
      var clamped = Math.min(segIdx, segs.length - 1);
      // Approximate progress: segment index / total segments, plus sub-segment offset
      var subFrac = segs[clamped].worldX ? (player.x - segs[clamped].worldX) / (segs[clamped].width || 200) : 0;
      subFrac = Math.max(0, Math.min(subFrac, 1));
      progress = (clamped + subFrac) / segs.length;
    }

    // Progress bar background
    var barX = lx - bw / 2;
    var barY = ly + 30;

    ctx.save();

    // "LAP" label
    ctx.font         = 'bold 12px Arial, sans-serif';
    ctx.fillStyle    = '#aaaaaa';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('LAP', lx, ly);

    // Lap numbers
    ctx.font         = 'bold 26px Arial, sans-serif';
    ctx.fillStyle    = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.lineWidth    = 2.5;
    ctx.strokeStyle  = 'rgba(0,0,0,0.6)';
    var lapText = displayLap + ' / ' + totalLaps;
    ctx.strokeText(lapText, lx, ly + 14);
    ctx.fillText(lapText, lx, ly + 14);

    // Progress bar background
    ctx.fillStyle = 'rgba(60,60,60,0.7)';
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    R._roundRect(ctx, barX, barY, bw, bh, bh / 2);

    // Progress bar fill
    var fillW = Math.max(bh, bw * progress); // minimum = height (for rounded ends)
    var barColor = displayLap >= totalLaps ? '#22cc55' : '#4488ff';
    ctx.save();
    ctx.beginPath();
    R._roundRectPath(ctx, barX, barY, bw, bh, bh / 2);
    ctx.clip();
    ctx.fillStyle = barColor;
    R._roundRect(ctx, barX, barY, fillW, bh, bh / 2);
    ctx.restore();

    // Outline the bar again over the fill
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    R._roundRectStroke(ctx, barX, barY, bw, bh, bh / 2);

    ctx.restore();
  };

  // ── Minimap ─────────────────────────────────────────────────────────

  /**
   * R.renderMiniMap()
   * Bottom-right corner, 140x140 pixels.
   * Simplified track outline + all cars as dots + player as pulsing dot.
   */
  R.renderMiniMap = function () {
    var ctx  = R.ctx;
    var mx   = CFG.HUD.MINIMAP_X;
    var my   = CFG.HUD.MINIMAP_Y;
    var size = CFG.HUD.MINIMAP_SIZE;

    // Draw onto offscreen canvas first
    var mCtx = _minimapCtx;
    var w = size, h = size;

    // Clear offscreen
    mCtx.clearRect(0, 0, w, h);

    // Background
    mCtx.fillStyle = 'rgba(10,10,10,0.8)';
    mCtx.fillRect(0, 0, w, h);
    mCtx.strokeStyle = 'rgba(255,255,255,0.2)';
    mCtx.lineWidth = 1.5;
    mCtx.strokeRect(0, 0, w, h);

    // Compute track bounds
    var track = R.track;
    if (!track || !track.segments || track.segments.length === 0) {
      // Draw empty minimap to screen
      ctx.drawImage(_minimapCanvas, mx, my);
      return;
    }

    var segs = track.segments;
    var minX = Infinity, maxX = -Infinity;
    var minY = Infinity, maxY = -Infinity;
    var points = [];
    for (var i = 0; i < segs.length; i++) {
      var sx = segs[i].worldX || 0;
      var sy = segs[i].worldY || 0;
      points.push({ x: sx, y: sy });
      if (sx < minX) minX = sx;
      if (sx > maxX) maxX = sx;
      if (sy < minY) minY = sy;
      if (sy > maxY) maxY = sy;
    }

    // Pad bounds
    var rangeX = maxX - minX || 1;
    var rangeY = maxY - minY || 1;
    var maxRange = Math.max(rangeX, rangeY);
    // Ensure square aspect with padding
    var pad = maxRange * 0.12;
    minX -= pad; maxX += pad;
    minY -= pad; maxY += pad;
    rangeX = maxX - minX;
    rangeY = maxY - minY;
    maxRange = Math.max(rangeX, rangeY);

    var margin = 12;
    var drawW  = w - margin * 2;
    var drawH  = h - margin * 2;
    var scale  = Math.min(drawW / maxRange, drawH / maxRange);

    // Center offset
    var cxOff = margin + (drawW - rangeX * scale) / 2 - minX * scale;
    var cyOff = margin + (drawH - rangeY * scale) / 2 - minY * scale;

    function toMapX(wx) { return cxOff + wx * scale; }
    function toMapY(wy) { return cyOff + wy * scale; }

    // Draw track outline — thin polyline with subtle gradient segments
    mCtx.lineWidth = 2;
    mCtx.lineCap   = 'round';
    mCtx.lineJoin  = 'round';

    for (var tSeg = 1; tSeg < points.length; tSeg++) {
      var p0 = points[tSeg - 1];
      var p1 = points[tSeg];
      var x0 = toMapX(p0.x), y0 = toMapY(p0.y);
      var x1 = toMapX(p1.x), y1 = toMapY(p1.y);

      // Gradient based on track progress (lighter at start, dimmer toward end)
      var frac = tSeg / points.length;
      var gAlpha = 0.25 + frac * 0.35;

      mCtx.beginPath();
      mCtx.moveTo(x0, y0);
      mCtx.lineTo(x1, y1);
      mCtx.strokeStyle = 'rgba(255,255,255,' + gAlpha.toFixed(2) + ')';
      mCtx.stroke();
    }

    // Draw road width as subtle parallel lines
    mCtx.lineWidth = 1;
    for (var rSeg = 1; rSeg < points.length; rSeg++) {
      var rp0 = points[rSeg - 1];
      var rp1 = points[rSeg];
      var segW = (rp0.width || 30) * scale * 0.3;
      var dx = rp1.x - rp0.x;
      var dy = rp1.y - rp0.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len * segW;
      var ny =  dx / len * segW;

      var mx0L = toMapX(rp0.x) + nx, my0L = toMapY(rp0.y) + ny;
      var mx0R = toMapX(rp0.x) - nx, my0R = toMapY(rp0.y) - ny;
      var mx1L = toMapX(rp1.x) + nx, my1L = toMapY(rp1.y) + ny;
      var mx1R = toMapX(rp1.x) - nx, my1R = toMapY(rp1.y) - ny;

      mCtx.strokeStyle = 'rgba(255,255,255,0.1)';
      mCtx.beginPath();
      mCtx.moveTo(mx0L, my0L); mCtx.lineTo(mx1L, my1L);
      mCtx.moveTo(mx0R, my0R); mCtx.lineTo(mx1R, my1R);
      mCtx.stroke();
    }

    // Draw all cars as dots
    var cars = R.cars || [];
    var playerIdx = -1;
    for (var c = 0; c < cars.length; c++) {
      if (cars[c] === R.player) { playerIdx = c; break; }
    }

    for (var ci = 0; ci < cars.length; ci++) {
      var car = cars[ci];
      var cmx = toMapX(car.x || 0);
      var cmy = toMapY(car.y || 0);

      if (ci === playerIdx) continue; // player drawn last

      mCtx.beginPath();
      mCtx.arc(cmx, cmy, 3, 0, Math.PI * 2);
      mCtx.fillStyle = car.color || '#aaaaaa';
      mCtx.fill();
      mCtx.strokeStyle = 'rgba(0,0,0,0.5)';
      mCtx.lineWidth = 0.8;
      mCtx.stroke();
    }

    // Draw player car as larger pulsing dot
    if (playerIdx >= 0 && R.player) {
      var pmx = toMapX(R.player.x || 0);
      var pmy = toMapY(R.player.y || 0);
      var pulse = 1 + Math.sin(R.state.time * 5) * 0.25;
      var pRad  = 5.5 * pulse;

      // Outer glow
      mCtx.beginPath();
      mCtx.arc(pmx, pmy, pRad + 3, 0, Math.PI * 2);
      mCtx.fillStyle = 'rgba(255,255,100,0.15)';
      mCtx.fill();

      // Main dot
      mCtx.beginPath();
      mCtx.arc(pmx, pmy, pRad, 0, Math.PI * 2);
      mCtx.fillStyle = '#ffff44';
      mCtx.fill();
      mCtx.strokeStyle = '#ffffff';
      mCtx.lineWidth = 1.2;
      mCtx.stroke();
    }

    // Draw to screen
    ctx.drawImage(_minimapCanvas, mx, my);

    // "MAP" label above the minimap
    ctx.font         = 'bold 10px Arial, sans-serif';
    ctx.fillStyle    = 'rgba(255,255,255,0.4)';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('MAP', mx + 2, my - 3);
  };

  // ── Race Timer ──────────────────────────────────────────────────────

  /**
   * R.renderRaceTimer()
   * Top-center. Large monospace digits: "1:23.456". Below: best lap.
   */
  R.renderRaceTimer = function () {
    var ctx = R.ctx;
    var tx  = CFG.HUD.TIMER_X;
    var ty  = CFG.HUD.TIMER_Y;

    var timeSec = R.state ? R.state.time : 0;

    // Format as M:SS.mmm
    var minutes = Math.floor(timeSec / 60);
    var seconds = Math.floor(timeSec % 60);
    var millis  = Math.floor((timeSec % 1) * 1000);
    var timeStr = minutes + ':' +
      (seconds < 10 ? '0' : '') + seconds + '.' +
      (millis < 100 ? (millis < 10 ? '00' : '0') : '') + millis;

    ctx.save();

    // Timer background panel
    var panelW = 200;
    var panelH = 52;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    R._roundRect(ctx, tx - panelW / 2, ty, panelW, panelH, 6);

    // Timer digits
    ctx.font         = 'bold 30px "Courier New", monospace';
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth    = 3;
    ctx.strokeStyle  = 'rgba(0,0,0,0.65)';
    ctx.strokeText(timeStr, tx, ty + 4);
    ctx.fillText(timeStr, tx, ty + 4);

    // Best lap
    if (_bestLapTime != null) {
      var bMin = Math.floor(_bestLapTime / 60);
      var bSec = Math.floor(_bestLapTime % 60);
      var bMil = Math.floor((_bestLapTime % 1) * 1000);
      var bestStr = 'BEST: ' + bMin + ':' +
        (bSec < 10 ? '0' : '') + bSec + '.' +
        (bMil < 100 ? (bMil < 10 ? '00' : '0') : '') + bMil;

      ctx.font         = 'bold 12px "Courier New", monospace';
      ctx.fillStyle    = '#ffcc00';
      ctx.textBaseline = 'top';
      ctx.lineWidth    = 1.5;
      ctx.strokeStyle  = 'rgba(0,0,0,0.6)';
      ctx.strokeText(bestStr, tx, ty + 38);
      ctx.fillText(bestStr, tx, ty + 38);
    }

    ctx.restore();
  };

  // ── Drift Indicator ─────────────────────────────────────────────────

  /**
   * R.renderDriftIndicator()
   * Bottom-center. Horizontal bar showing lateral G-force / drift.
   * Center = no drift. Extends left/right based on drift direction.
   */
  R.renderDriftIndicator = function () {
    var ctx = R.ctx;
    var dx  = CFG.HUD.DRIFT_X;
    var dy  = CFG.HUD.DRIFT_Y;
    var bw  = CFG.HUD.DRIFT_BAR_WIDTH;
    var bh  = CFG.HUD.DRIFT_BAR_HEIGHT;

    var player = R.player;
    if (!player) return;

    // Drift amount: use driftFactor or compute from speed & steer angle
    var driftAmt = 0;
    if (player.driftFactor !== undefined) {
      driftAmt = player.driftFactor;
    } else {
      // Approximate drift from steer angle and speed
      var steer = R.input ? R.input.steer : 0;
      var spd   = player.speed || 0;
      var maxSpd = player.maxSpeed || 200;
      driftAmt = steer * Math.min(spd / (maxSpd * 0.3), 1);
    }
    // Clamp to [-1, 1]
    driftAmt = Math.max(-1, Math.min(1, driftAmt));

    var absDrift = Math.abs(driftAmt);
    var barHalf  = bw / 2;

    ctx.save();

    // Background bar (dark)
    var bgX = dx - barHalf;
    var bgY = dy;
    ctx.fillStyle = 'rgba(30,30,30,0.7)';
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    R._roundRect(ctx, bgX, bgY, bw, bh, bh / 2);

    // Center notch
    ctx.beginPath();
    ctx.moveTo(dx, bgY - 3);
    ctx.lineTo(dx, bgY + bh + 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Active drift fill
    if (absDrift > 0.005) {
      // Color based on drift intensity
      var r, g, bVal;
      if (absDrift < 0.4) {
        // white → yellow
        var t = absDrift / 0.4;
        r = 255;
        g = 255 - t * 55;
        bVal = 255 - t * 200;
      } else if (absDrift < 0.75) {
        // yellow → orange
        var t2 = (absDrift - 0.4) / 0.35;
        r = 255;
        g = 200 - t2 * 100;
        bVal = 55 - t2 * 55;
      } else {
        // orange
        r = 255;
        g = 100;
        bVal = 0;
      }
      var driftColor = 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(bVal) + ')';

      var fillHalf = barHalf * absDrift;
      var fillX, fillW;

      if (driftAmt > 0) {
        // Drift right
        fillX = dx;
        fillW = fillHalf;
      } else {
        // Drift left
        fillX = dx - fillHalf;
        fillW = fillHalf;
      }

      ctx.save();
      ctx.beginPath();
      R._roundRectPath(ctx, bgX, bgY, bw, bh, bh / 2);
      ctx.clip();
      ctx.fillStyle = driftColor;
      R._roundRect(ctx, fillX, bgY, fillW, bh, bh / 2);
      ctx.restore();
    }

    // "DRIFT" label below bar
    ctx.font         = 'bold 10px Arial, sans-serif';
    ctx.fillStyle    = 'rgba(255,255,255,0.5)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('DRIFT', dx, bgY + bh + 3);

    ctx.restore();
  };

  // ── Countdown ───────────────────────────────────────────────────────

  /**
   * R.renderCountdown(number)
   * Large centered number during countdown phase.
   * Animate: scale from 2→1 over 0.8s with easing.
   * @param {number} num — the countdown number to display
   */
  R.renderCountdown = function (num) {
    var ctx  = R.ctx;
    var elapsed  = _countdownElapsed;
    var duration = CFG.HUD.COUNTDOWN_DURATION;

    // Easing: cubic ease-out
    var t   = Math.min(elapsed / duration, 1);
    var scale = 2 - t * t * (3 - 2 * t); // ease-out cubic: goes from 2→1

    var cx = (R.canvas ? R.canvas.width  : 1280) / 2;
    var cy = (R.canvas ? R.canvas.height : 720)  / 2;

    // Dark backdrop
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(cx - 200, cy - 150, 400, 200);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Glow
    ctx.shadowColor  = 'rgba(255,255,255,0.5)';
    ctx.shadowBlur   = 30 * scale;

    var text = String(num);
    ctx.font         = 'bold 140px Arial, sans-serif';
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Outline
    ctx.strokeStyle  = 'rgba(0,0,0,0.6)';
    ctx.lineWidth    = 8;
    ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);

    ctx.shadowBlur = 0;
    ctx.restore();
  };

  /**
   * Internal helper: trigger a new countdown number.
   * Called externally by the game engine when countdown ticks.
   */
  R.triggerCountdown = function (number) {
    _countdownNumber   = number;
    _countdownElapsed  = 0;
    _countdownActive   = true;
  };

  // ── Menu Prompt ─────────────────────────────────────────────────────

  /**
   * R._renderMenuPrompt()
   * Internal: render the start prompt on the menu screen.
   */
  R._renderMenuPrompt = function () {
    var ctx = R.ctx;
    var cw  = R.canvas ? R.canvas.width  : 1280;
    var ch  = R.canvas ? R.canvas.height : 720;

    ctx.save();

    // Semi-transparent backdrop over lower half
    var grad = ctx.createLinearGradient(0, ch * 0.55, 0, ch);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, ch * 0.55, cw, ch * 0.45);

    // Title
    ctx.font         = 'bold 48px Arial, sans-serif';
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth    = 4;
    ctx.strokeStyle  = 'rgba(0,0,0,0.7)';
    ctx.strokeText('RACING', cw / 2, ch * 0.35);
    ctx.fillText('RACING', cw / 2, ch * 0.35);

    // Prompt — blinking
    var blink = Math.sin(R.state.time * 3) > 0;
    if (blink) {
      ctx.font         = '22px Arial, sans-serif';
      ctx.fillStyle    = '#ffcc00';
      ctx.textBaseline = 'middle';
      ctx.lineWidth    = 2;
      ctx.strokeStyle  = 'rgba(0,0,0,0.6)';
      ctx.strokeText('Press ENTER or tap to start', cw / 2, ch * 0.65);
      ctx.fillText('Press ENTER or tap to start', cw / 2, ch * 0.65);
    }

    ctx.restore();
  };

  // ── Race Results ────────────────────────────────────────────────────

  /**
   * R.renderRaceResults()
   * Semi-transparent dark overlay showing final race standings.
   */
  R.renderRaceResults = function () {
    var ctx = R.ctx;
    var cw  = R.canvas ? R.canvas.width  : 1280;
    var ch  = R.canvas ? R.canvas.height : 720;

    // Cache results on first render
    if (!_finalResults) {
      _finalResults = _buildResultsTable();
    }

    ctx.save();

    // Full-screen dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, cw, ch);

    // Panel centered
    var panelW = 520;
    var panelH = 380;
    var panelX = (cw - panelW) / 2;
    var panelY = (ch - panelH) / 2;

    ctx.fillStyle = 'rgba(20,20,20,0.9)';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    R._roundRect(ctx, panelX, panelY, panelW, panelH, 12);

    // Title
    ctx.font         = 'bold 32px Arial, sans-serif';
    ctx.fillStyle    = '#ffd700';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth    = 3;
    ctx.strokeStyle  = 'rgba(0,0,0,0.7)';
    ctx.strokeText('RACE COMPLETE', cw / 2, panelY + 18);
    ctx.fillText('RACE COMPLETE', cw / 2, panelY + 18);

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 30, panelY + 62);
    ctx.lineTo(panelX + panelW - 30, panelY + 62);
    ctx.stroke();

    // Column headers
    var colPosX   = panelX + 50;
    var colNameX  = panelX + 120;
    var colTimeX  = panelX + panelW - 80;
    var headerY   = panelY + 72;

    ctx.font         = 'bold 11px Arial, sans-serif';
    ctx.fillStyle    = '#888888';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('POS', colPosX, headerY);
    ctx.fillText('DRIVER', colNameX, headerY);
    ctx.textAlign    = 'right';
    ctx.fillText('TIME', colTimeX, headerY);

    // Results rows
    var results = _finalResults || [];
    var rowH    = 32;
    var startY  = headerY + 22;

    for (var i = 0; i < results.length; i++) {
      var entry  = results[i];
      var rowY   = startY + i * rowH;
      var isPlayer = entry._isPlayer;

      // Row highlight
      if (isPlayer) {
        ctx.fillStyle = 'rgba(255,215,0,0.12)';
        ctx.fillRect(panelX + 20, rowY - 2, panelW - 40, rowH);
        ctx.strokeStyle = 'rgba(255,215,0,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX + 20, rowY - 2, panelW - 40, rowH);
      }

      // Position
      var posColor = '#ffffff';
      if (i === 0) posColor = '#ffd700';
      else if (i === 1) posColor = '#c0c0c0';
      else if (i === 2) posColor = '#cd7f32';

      var suffix = 'th';
      if (i === 0) suffix = 'st';
      else if (i === 1) suffix = 'nd';
      else if (i === 2) suffix = 'rd';

      ctx.font         = 'bold 14px Arial, sans-serif';
      ctx.fillStyle    = posColor;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((i + 1) + suffix, colPosX, rowY + rowH / 2);

      // Driver name / car color indicator
      ctx.fillStyle = entry._color || '#aaaaaa';
      ctx.beginPath();
      ctx.arc(colNameX - 10, rowY + rowH / 2, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.font         = isPlayer ? 'bold 15px Arial, sans-serif' : '14px Arial, sans-serif';
      ctx.fillStyle    = isPlayer ? '#ffff44' : '#dddddd';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(entry._name || ('Car ' + (i + 1)), colNameX, rowY + rowH / 2);

      // Time
      ctx.font         = '14px "Courier New", monospace';
      ctx.fillStyle    = '#cccccc';
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(entry._timeStr || '--', colTimeX, rowY + rowH / 2);
    }

    // Restart prompt
    var promptY = panelY + panelH - 38;
    var blink = Math.sin(R.state.time * 3) > 0;
    if (blink) {
      ctx.font         = 'bold 16px Arial, sans-serif';
      ctx.fillStyle    = '#ffcc00';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Press ENTER to restart', cw / 2, promptY);
    }

    ctx.restore();
  };

  /**
   * _buildResultsTable()
   * Internal: build the sorted results snapshot for the race-results overlay.
   * @returns {Array<Object>} sorted list of result entries
   */
  function _buildResultsTable() {
    var cars  = R.cars || [];
    var track = R.track;
    var totalLaps = (track && track.totalLaps) || 3;
    var entries = [];

    for (var i = 0; i < cars.length; i++) {
      var car = cars[i];
      var finished = car.finished || false;
      var lap      = car.lap || 0;
      var timeStr  = 'DNF';

      if (finished) {
        timeStr = _formatTime(car.finishTime || 0);
      } else if (lap >= totalLaps) {
        timeStr = 'DONE';
      }

      entries.push({
        _carIndex:  i,
        _isPlayer:  car === R.player,
        _color:     car.color || '#aaaaaa',
        _name:      car === R.player ? 'YOU' : (car.driverName || ('Car ' + (i + 1))),
        _lap:       lap,
        _finished:  finished,
        _finishTime: car.finishTime || 0,
        _timeStr:   timeStr
      });
    }

    // Sort: finished cars first (by finishTime asc), then by lap desc, then by checkpoint/x
    entries.sort(function (a, b) {
      if (a._finished && b._finished) {
        return a._finishTime - b._finishTime;
      }
      if (a._finished) return -1;
      if (b._finished) return 1;
      if (a._lap !== b._lap) return b._lap - a._lap;

      var carA = R.cars[a._carIndex];
      var carB = R.cars[b._carIndex];
      var lapA = carA ? (carA.checkpointIdx || 0) : 0;
      var lapB = carB ? (carB.checkpointIdx || 0) : 0;
      if (lapA !== lapB) return lapB - lapA;

      var xA = carA ? (carA.x || 0) : 0;
      var xB = carB ? (carB.x || 0) : 0;
      return xB - xA;
    });

    return entries;
  }

  /**
   * R.sortCarsByPosition()
   * Sort cars by race position: finished first, then by lap/checkpoint.
   * Used by both HUD and potentially other systems.
   * Each entry gets a _carIndex property so HUD can map back to R.cars.
   * @returns {Array<Object>} sorted list
   */
  R.sortCarsByPosition = function () {
    var cars  = R.cars || [];
    var track = R.track;
    var totalLaps = (track && track.totalLaps) || 3;
    var entries = [];

    for (var i = 0; i < cars.length; i++) {
      var car = cars[i];
      entries.push({
        _carIndex:  i,
        _isPlayer:  car === R.player,
        _lap:       car.lap || 0,
        _finished:  car.finished || false,
        _finishTime: car.finishTime || 0,
        _checkpointIdx: car.checkpointIdx || 0,
        _x:         car.x || 0,
        _y:         car.y || 0
      });
    }

    entries.sort(function (a, b) {
      if (a._finished && b._finished) {
        return a._finishTime - b._finishTime;
      }
      if (a._finished) return -1;
      if (b._finished) return 1;
      if (a._lap !== b._lap) return b._lap - a._lap;
      if (a._checkpointIdx !== b._checkpointIdx) {
        return b._checkpointIdx - a._checkpointIdx;
      }
      return b._x - a._x;
    });

    return entries;
  };

  // ── Utility helpers ─────────────────────────────────────────────────

  /**
   * _formatTime(seconds)
   * Format a time value in seconds as M:SS.mmm.
   * @param {number} sec
   * @returns {string}
   */
  function _formatTime(sec) {
    if (sec == null || isNaN(sec)) return '--';
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    var ms = Math.floor((sec % 1) * 1000);
    return m + ':' +
      (s < 10 ? '0' : '') + s + '.' +
      (ms < 100 ? (ms < 10 ? '00' : '0') : '') + ms;
  }

  /**
   * R._roundRect(ctx, x, y, w, h, r)
   * Draw a filled rounded rectangle.
   */
  R._roundRect = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    R._roundRectPath(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
  };

  /**
   * R._roundRectPath(ctx, x, y, w, h, r)
   * Add a rounded rectangle path to the current context.
   */
  R._roundRectPath = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  };

  /**
   * R._roundRectStroke(ctx, x, y, w, h, r)
   * Stroke-only rounded rectangle.
   */
  R._roundRectStroke = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    R._roundRectPath(ctx, x, y, w, h, r);
    ctx.stroke();
  };

})();
// === Exported to window.R ===
// R.initHUD()
// R.updateHUD(dt)
// R.renderHUD()
// R.renderSpeedometer()
// R.renderPositionBadge()
// R.renderLapCounter()
// R.renderMiniMap()
// R.renderRaceTimer()
// R.renderDriftIndicator()
// R.renderCountdown(number)
// R.renderOverlay()
// R.renderRaceResults()
// R.triggerCountdown(number)
// R.sortCarsByPosition()
// R._renderMenuPrompt()
// R._roundRect(ctx, x, y, w, h, r)
// R._roundRectPath(ctx, x, y, w, h, r)
// R._roundRectStroke(ctx, x, y, w, h, r)
