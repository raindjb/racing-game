// === menu.js — Racing Game ===
// Menu screens: title, pause, countdown integration, race results.
// All functions attach to window.R. Assumes R.CONFIG, R.canvas, R.ctx,
// R.input, R.camera, R.track, R.state already exist.

/* =========================== Module State =========================== */
// Closure variables for animation tracking (not exposed on R).
let _lastCountNumber = null;
let _countChangeTime = 0;
let _menuEntranceTime = 0;

/* =========================== Config Defaults =========================== */
// Extend R.CONFIG with menu-specific tunables if not already set.
if (!R.CONFIG.MENU) {
  R.CONFIG.MENU = {};
}
const MC = R.CONFIG.MENU;

if (MC.TITLE_FONT_SIZE == null)    MC.TITLE_FONT_SIZE = 96;
if (MC.TITLE_FONT == null)         MC.TITLE_FONT = 'bold ' + MC.TITLE_FONT_SIZE + 'px "Segoe UI","Arial Black",sans-serif';
if (MC.SUBTITLE_FONT_SIZE == null) MC.SUBTITLE_FONT_SIZE = 28;
if (MC.SUBTITLE_FONT == null)      MC.SUBTITLE_FONT = 'bold ' + MC.SUBTITLE_FONT_SIZE + 'px "Segoe UI",Arial,sans-serif';
if (MC.PROMPT_FONT_SIZE == null)   MC.PROMPT_FONT_SIZE = 22;
if (MC.PROMPT_FONT == null)        MC.PROMPT_FONT = MC.PROMPT_FONT_SIZE + 'px "Segoe UI",Arial,sans-serif';
if (MC.HINT_FONT_SIZE == null)     MC.HINT_FONT_SIZE = 14;
if (MC.HINT_FONT == null)          MC.HINT_FONT = MC.HINT_FONT_SIZE + 'px "Segoe UI",Arial,sans-serif';
if (MC.VERSION_FONT == null)       MC.VERSION_FONT = '12px "Segoe UI",Arial,sans-serif';
if (MC.BG_COLOR_TOP == null)       MC.BG_COLOR_TOP = '#0a0a1a';
if (MC.BG_COLOR_BOTTOM == null)    MC.BG_COLOR_BOTTOM = '#1a1a3e';
if (MC.TITLE_COLOR_TOP == null)    MC.TITLE_COLOR_TOP = '#ffffff';
if (MC.TITLE_COLOR_BOTTOM == null) MC.TITLE_COLOR_BOTTOM = '#8899bb';
if (MC.SUBTITLE_COLOR == null)     MC.SUBTITLE_COLOR = '#aabbcc';
if (MC.PROMPT_COLOR == null)       MC.PROMPT_COLOR = '#ffffff';
if (MC.HINT_COLOR == null)         MC.HINT_COLOR = 'rgba(200,210,220,0.55)';
if (MC.CAR_SLIDE_DURATION == null) MC.CAR_SLIDE_DURATION = 1.2;   // seconds
if (MC.CAR_SLIDE_DELAY == null)    MC.CAR_SLIDE_DELAY = 0.3;      // seconds
if (MC.PULSE_SPEED == null)        MC.PULSE_SPEED = 3.5;          // radians/sec
if (MC.COUNTDOWN_DURATION == null) MC.COUNTDOWN_DURATION = 0.65;  // seconds per number
if (MC.COUNTDOWN_START_SCALE == null) MC.COUNTDOWN_START_SCALE = 2.5;
if (MC.COUNTDOWN_FONT_SIZE == null)   MC.COUNTDOWN_FONT_SIZE = 160;
if (MC.COUNTDOWN_FONT == null)     MC.COUNTDOWN_FONT = 'bold ' + MC.COUNTDOWN_FONT_SIZE + 'px "Segoe UI","Arial Black",sans-serif';
if (MC.PAUSE_TITLE_SIZE == null)   MC.PAUSE_TITLE_SIZE = 72;
if (MC.PAUSE_TITLE_FONT == null)   MC.PAUSE_TITLE_FONT = 'bold ' + MC.PAUSE_TITLE_SIZE + 'px "Segoe UI","Arial Black",sans-serif';
if (MC.PAUSE_ITEM_SIZE == null)    MC.PAUSE_ITEM_SIZE = 26;
if (MC.PAUSE_ITEM_FONT == null)    MC.PAUSE_ITEM_FONT = MC.PAUSE_ITEM_SIZE + 'px "Segoe UI",Arial,sans-serif';
if (MC.OVERLAY_ALPHA == null)      MC.OVERLAY_ALPHA = 0.72;
if (MC.FINISH_TITLE_SIZE == null)  MC.FINISH_TITLE_SIZE = 64;
if (MC.FINISH_TITLE_FONT == null)  MC.FINISH_TITLE_FONT = 'bold ' + MC.FINISH_TITLE_SIZE + 'px "Segoe UI","Arial Black",sans-serif';
if (MC.RESULTS_HEADER_SIZE == null) MC.RESULTS_HEADER_SIZE = 20;
if (MC.RESULTS_ROW_SIZE == null)   MC.RESULTS_ROW_SIZE = 22;
if (MC.RESULTS_FONT == null)       MC.RESULTS_FONT = '"Segoe UI",Arial,sans-serif';
if (MC.GOLD_TOP == null)           MC.GOLD_TOP = '#ffdd44';
if (MC.GOLD_BOTTOM == null)        MC.GOLD_BOTTOM = '#cc8800';
if (MC.BUTTON_ROUND == null)       MC.BUTTON_ROUND = 8;
if (MC.PANEL_ROUND == null)        MC.PANEL_ROUND = 12;
if (MC.PANEL_BORDER == null)       MC.PANEL_BORDER = 'rgba(255,255,255,0.08)';

/* =========================== Internal Helpers =========================== */

/**
 * Draw a rounded rectangle path (must be wrapped in beginPath/fill/stroke by caller).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r - corner radius
 */
function _roundRect(ctx, x, y, w, h, r) {
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

/**
 * Format seconds into MM:SS.ms display string.
 * @param {number} totalSec
 * @returns {string}
 */
function _formatRaceTime(totalSec) {
  if (totalSec == null || !isFinite(totalSec)) return '--:--.--';
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const ms = Math.floor((totalSec % 1) * 100);
  return String(min).padStart(2, '0') + ':' +
         String(sec).padStart(2, '0') + '.' +
         String(ms).padStart(2, '0');
}

/**
 * Ordinal suffix for position numbers.
 * @param {number} n
 * @returns {string}
 */
function _ordinal(n) {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return n + 'th';
}

/**
 * Simple ease-out cubic.
 * @param {number} t - progress [0, 1]
 * @returns {number}
 */
function _easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/* =========================== Public API: Panels & Buttons ============= */

/**
 * R.drawPanel(x, y, w, h, alpha)
 * Draw a semi-transparent dark panel with subtle border.
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} [alpha=0.85]
 */
R.drawPanel = function(x, y, w, h, alpha) {
  const ctx = R.ctx;
  const a = (alpha != null) ? alpha : 0.85;

  ctx.save();
  _roundRect(ctx, x, y, w, h, MC.PANEL_ROUND);

  // Dark fill
  ctx.fillStyle = 'rgba(10, 12, 28, ' + a + ')';
  ctx.fill();

  // Subtle border
  ctx.strokeStyle = MC.PANEL_BORDER;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Top inner highlight (thin lighter line near top edge)
  const hlY = y + 2;
  const hlH = 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + MC.PANEL_ROUND, hlY, w - MC.PANEL_ROUND * 2, hlH);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x, hlY, w, hlH);
  ctx.restore();

  ctx.restore();
};

/**
 * R.drawButton(x, y, w, h, text, color)
 * Draw a styled button: rounded rect, gradient fill, border highlight, centered text.
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} text
 * @param {string} [color='#445577'] - base fill color
 */
R.drawButton = function(x, y, w, h, text, color) {
  const ctx = R.ctx;
  const baseColor = color || '#445577';

  ctx.save();
  _roundRect(ctx, x, y, w, h, MC.BUTTON_ROUND);

  // Gradient fill (lighter top, darker bottom)
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, baseColor);
  grad.addColorStop(1, _darkenColor(baseColor, 0.45));
  ctx.fillStyle = grad;
  ctx.fill();

  // Border highlight (top edge lighter)
  ctx.strokeStyle = _lightenColor(baseColor, 0.3);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner top highlight line
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + MC.BUTTON_ROUND, y + 1, w - MC.BUTTON_ROUND * 2, 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, w, 3);
  ctx.restore();

  // Text centered
  const fontSize = Math.max(12, Math.min(h * 0.45, 22));
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold ' + fontSize + 'px "Segoe UI",Arial,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 2;
  ctx.fillText(text, x + w / 2, y + h / 2);
  ctx.shadowBlur = 0;

  ctx.restore();
};

/**
 * R.drawGradientText(text, x, y, colorTop, colorBottom, font)
 * Draw text with a vertical gradient fill using clip region + gradient.
 * @param {string} text
 * @param {number} x - center-x of the text
 * @param {number} y - baseline-y of the text
 * @param {string} colorTop - top gradient color (e.g. '#ffffff')
 * @param {string} colorBottom - bottom gradient color (e.g. '#667799')
 * @param {string} font - CSS font string (e.g. 'bold 96px Arial')
 */
R.drawGradientText = function(text, x, y, colorTop, colorBottom, font) {
  const ctx = R.ctx;

  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Measure text to build clip region
  const metrics = ctx.measureText(text);
  const tw = metrics.width;
  const th = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  // Fallback if actualBoundingBox not supported: estimate from font size
  const fontSize = parseInt(font, 10) || 48;
  const textH = th > 0 ? th : fontSize * 1.2;
  const clipX = x - tw / 2 - 4;
  const clipY = y - textH;

  // Clip to text bounding box
  ctx.beginPath();
  ctx.rect(clipX, clipY, tw + 8, textH + 4);
  ctx.clip();

  // Vertical gradient
  const grad = ctx.createLinearGradient(0, clipY, 0, clipY + textH);
  grad.addColorStop(0, colorTop);
  grad.addColorStop(1, colorBottom);
  ctx.fillStyle = grad;
  ctx.fillText(text, x, y);

  ctx.restore();
};

/* =========================== Car Silhouette Drawing ================= */

/**
 * Draw a sports-car silhouette (side-ish view) that can be positioned and scaled.
 * Used by the title screen animation.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx - center x
 * @param {number} cy - center y (bottom of wheels)
 * @param {number} scale - size multiplier
 */
function _drawCarSilhouette(ctx, cx, cy, scale) {
  const s = scale;
  ctx.save();
  ctx.translate(cx, cy);

  // Car body dimensions (in base units, multiplied by scale)
  const bodyLen = 180 * s;
  const bodyH   = 32 * s;
  const cabinW  = 55 * s;
  const cabinH  = 28 * s;
  const wheelR  = 16 * s;
  const wheelW  = 10 * s;
  const groundY = 0;

  ctx.fillStyle = '#d0d8e8';

  // --- Main body (low, wide) ---
  ctx.beginPath();
  ctx.moveTo(-bodyLen * 0.48, groundY - bodyH * 0.35);                // front bumper top
  ctx.lineTo(-bodyLen * 0.38, groundY - bodyH * 0.7);                 // hood rise
  ctx.lineTo(-bodyLen * 0.10, groundY - bodyH * 0.75);                // windshield base
  ctx.lineTo(bodyLen * 0.08, groundY - bodyH * 0.75);                 // rear window base
  ctx.lineTo(bodyLen * 0.35, groundY - bodyH * 0.4);                  // trunk slope
  ctx.lineTo(bodyLen * 0.45, groundY - bodyH * 0.25);                 // rear bumper top
  ctx.lineTo(bodyLen * 0.45, groundY - bodyH * 0.05);                 // rear lower
  ctx.lineTo(-bodyLen * 0.48, groundY - bodyH * 0.05);                // front lower
  ctx.closePath();
  ctx.fill();

  // --- Cabin / roof ---
  ctx.fillStyle = '#c0c8d8';
  ctx.beginPath();
  ctx.moveTo(-bodyLen * 0.12, groundY - bodyH * 0.75);                // windshield top
  ctx.quadraticCurveTo(-bodyLen * 0.02, groundY - bodyH - cabinH * 0.25, bodyLen * 0.06, groundY - bodyH - cabinH * 0.15); // roof front
  ctx.lineTo(bodyLen * 0.22, groundY - bodyH - cabinH * 0.15);       // roof rear
  ctx.quadraticCurveTo(bodyLen * 0.30, groundY - bodyH - cabinH * 0.1, bodyLen * 0.33, groundY - bodyH * 0.6); // rear window
  ctx.lineTo(-bodyLen * 0.08, groundY - bodyH * 0.7);                // back to windshield
  ctx.closePath();
  ctx.fill();

  // --- Spoiler ---
  ctx.fillStyle = '#b0b8c8';
  ctx.beginPath();
  ctx.moveTo(bodyLen * 0.40, groundY - bodyH * 0.45);
  ctx.lineTo(bodyLen * 0.48, groundY - bodyH * 0.50);
  ctx.lineTo(bodyLen * 0.48, groundY - bodyH * 0.15);
  ctx.lineTo(bodyLen * 0.43, groundY - bodyH * 0.18);
  ctx.closePath();
  ctx.fill();

  // --- Front splitter ---
  ctx.fillStyle = '#c8d0e0';
  ctx.beginPath();
  ctx.moveTo(-bodyLen * 0.48, groundY - bodyH * 0.08);
  ctx.lineTo(-bodyLen * 0.44, groundY - bodyH * 0.08);
  ctx.lineTo(-bodyLen * 0.46, groundY + bodyH * 0.02);
  ctx.lineTo(-bodyLen * 0.50, groundY + bodyH * 0.02);
  ctx.closePath();
  ctx.fill();

  // --- Rear wheel ---
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(bodyLen * 0.28, groundY - wheelR * 0.1, wheelR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(bodyLen * 0.28, groundY - wheelR * 0.1, wheelR * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // Rim cross
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(bodyLen * 0.28 - wheelR * 0.5, groundY - wheelR * 0.1);
  ctx.lineTo(bodyLen * 0.28 + wheelR * 0.5, groundY - wheelR * 0.1);
  ctx.moveTo(bodyLen * 0.28, groundY - wheelR * 0.1 - wheelR * 0.5);
  ctx.lineTo(bodyLen * 0.28, groundY - wheelR * 0.1 + wheelR * 0.5);
  ctx.stroke();

  // --- Front wheel ---
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(-bodyLen * 0.30, groundY - wheelR * 0.1, wheelR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(-bodyLen * 0.30, groundY - wheelR * 0.1, wheelR * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(-bodyLen * 0.30 - wheelR * 0.5, groundY - wheelR * 0.1);
  ctx.lineTo(-bodyLen * 0.30 + wheelR * 0.5, groundY - wheelR * 0.1);
  ctx.moveTo(-bodyLen * 0.30, groundY - wheelR * 0.1 - wheelR * 0.5);
  ctx.lineTo(-bodyLen * 0.30, groundY - wheelR * 0.1 + wheelR * 0.5);
  ctx.stroke();

  // --- Window tint (dark) ---
  ctx.fillStyle = 'rgba(20, 25, 40, 0.6)';
  ctx.beginPath();
  ctx.moveTo(-bodyLen * 0.10, groundY - bodyH * 0.73);
  ctx.quadraticCurveTo(-bodyLen * 0.01, groundY - bodyH - cabinH * 0.28, bodyLen * 0.06, groundY - bodyH - cabinH * 0.18);
  ctx.lineTo(bodyLen * 0.20, groundY - bodyH - cabinH * 0.18);
  ctx.quadraticCurveTo(bodyLen * 0.28, groundY - bodyH - cabinH * 0.12, bodyLen * 0.31, groundY - bodyH * 0.62);
  ctx.lineTo(-bodyLen * 0.06, groundY - bodyH * 0.72);
  ctx.closePath();
  ctx.fill();

  // --- Headlight (front) ---
  ctx.fillStyle = '#ffe8c0';
  ctx.beginPath();
  ctx.ellipse(-bodyLen * 0.47, groundY - bodyH * 0.40, 5 * s, 3 * s, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // --- Tail light (rear) ---
  ctx.fillStyle = '#ff3333';
  ctx.beginPath();
  ctx.ellipse(bodyLen * 0.44, groundY - bodyH * 0.38, 4 * s, 2.5 * s, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // --- Exhaust pipes ---
  ctx.fillStyle = '#444';
  ctx.fillRect(bodyLen * 0.42, groundY - bodyH * 0.12, 8 * s, 5 * s);
  ctx.fillRect(bodyLen * 0.42, groundY - bodyH * 0.22, 8 * s, 5 * s);

  // --- Racing stripe ---
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(-bodyLen * 0.15, groundY - bodyH * 0.68, bodyLen * 0.42, 5 * s);

  ctx.restore();
}

/* =========================== Color Utilities ======================== */

/**
 * Darken a hex color by a factor (0 = no change, 1 = black).
 * @param {string} hex - e.g. '#445577'
 * @param {number} factor - 0..1
 * @returns {string}
 */
function _darkenColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 1 - factor;
  return 'rgb(' + Math.floor(r * f) + ',' + Math.floor(g * f) + ',' + Math.floor(b * f) + ')';
}

/**
 * Lighten a hex color by a factor.
 * @param {string} hex
 * @param {number} factor - 0..1
 * @returns {string}
 */
function _lightenColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 1 - factor;
  return 'rgb(' +
    Math.floor(r + (255 - r) * factor) + ',' +
    Math.floor(g + (255 - g) * factor) + ',' +
    Math.floor(b + (255 - b) * factor) + ')';
}

/* =====================================================================
   R.renderMenu() — Full Title Screen
   Shown when R.state.phase === 'menu'.
   ===================================================================== */

R.renderMenu = function() {
  const ctx = R.ctx;
  const W = R.canvas.width;
  const H = R.canvas.height;
  const time = R.state.time;

  // Track entrance time for slide-in animations
  if (_menuEntranceTime === 0) {
    _menuEntranceTime = time;
  }

  // --- 1. Dark background with gradient ---
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, MC.BG_COLOR_TOP);
  bgGrad.addColorStop(0.55, '#101030');
  bgGrad.addColorStop(1, MC.BG_COLOR_BOTTOM);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle radial glow behind title
  const glowGrad = ctx.createRadialGradient(W / 2, H * 0.28, 0, W / 2, H * 0.28, W * 0.45);
  glowGrad.addColorStop(0, 'rgba(60, 80, 140, 0.18)');
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, W, H);

  // --- 2. Title: "ASPHALT LEGENDS" with chrome/gradient effect ---
  const titleY = H * 0.24;
  // Shadow first (drawn behind the gradient text)
  ctx.save();
  ctx.font = MC.TITLE_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillText('ASPHALT LEGENDS', W / 2 + 3, titleY + 3);
  ctx.restore();

  // Main chrome gradient text
  R.drawGradientText(
    'ASPHALT LEGENDS',
    W / 2,
    titleY,
    MC.TITLE_COLOR_TOP,
    MC.TITLE_COLOR_BOTTOM,
    MC.TITLE_FONT
  );

  // Secondary highlight pass: lighter thin stroke at top for chrome effect
  ctx.save();
  ctx.font = MC.TITLE_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // Clip to top half of text area
  const titleMetrics = ctx.measureText('ASPHALT LEGENDS');
  const titleH = titleMetrics.actualBoundingBoxAscent + titleMetrics.actualBoundingBoxDescent;
  const estTitleH = titleH > 0 ? titleH : MC.TITLE_FONT_SIZE * 1.2;
  const clipTop = titleY - estTitleH;
  ctx.beginPath();
  ctx.rect(0, clipTop, W, estTitleH * 0.45);
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillText('ASPHALT LEGENDS', W / 2, titleY);
  ctx.restore();

  // --- 3. Subtitle ---
  const subtitleY = titleY + MC.TITLE_FONT_SIZE * 0.5;
  ctx.fillStyle = MC.SUBTITLE_COLOR;
  ctx.font = MC.SUBTITLE_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 3;
  ctx.fillText('CANVAS RACING CHAMPIONSHIP', W / 2, subtitleY);
  ctx.shadowBlur = 0;

  // Decorative line under subtitle
  const lineY = subtitleY + MC.SUBTITLE_FONT_SIZE + 14;
  const lineW = W * 0.25;
  const lineGrad = ctx.createLinearGradient(W / 2 - lineW / 2, 0, W / 2 + lineW / 2, 0);
  lineGrad.addColorStop(0, 'rgba(136, 153, 187, 0)');
  lineGrad.addColorStop(0.5, 'rgba(136, 153, 187, 0.5)');
  lineGrad.addColorStop(1, 'rgba(136, 153, 187, 0)');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - lineW / 2, lineY);
  ctx.lineTo(W / 2 + lineW / 2, lineY);
  ctx.stroke();

  // --- 4. Animated car silhouette ---
  const elapsed = time - _menuEntranceTime;
  const carSlideT = Math.max(0, Math.min(1, (elapsed - MC.CAR_SLIDE_DELAY) / MC.CAR_SLIDE_DURATION));
  const carEasedT = _easeOutCubic(carSlideT);
  const carTargetX = W / 2;
  const carStartX = W + 200;
  const carX = carStartX + (carTargetX - carStartX) * carEasedT;
  const carY = H * 0.80;
  const carScale = 0.9 + 0.1 * carEasedT; // slight scale pop at end

  // Road line behind car
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, carY + 22 * carScale);
  ctx.lineTo(W, carY + 22 * carScale);
  ctx.stroke();

  // Draw car with slight alpha fade during slide
  ctx.globalAlpha = 0.5 + 0.5 * carEasedT;
  _drawCarSilhouette(ctx, carX, carY, carScale);
  ctx.globalAlpha = 1;

  // Speed lines behind the car during entrance
  if (carSlideT < 1 && carSlideT > 0.05) {
    const lineAlpha = (1 - carSlideT) * 0.5;
    ctx.strokeStyle = 'rgba(200, 210, 230, ' + lineAlpha + ')';
    ctx.lineWidth = 1;
    const lineCount = 8;
    for (let i = 0; i < lineCount; i++) {
      const lx = carX + 140 * carScale + Math.random() * 300;
      const ly = carY - 20 * carScale + (Math.random() - 0.5) * 40 * carScale;
      const ll = 30 + Math.random() * 80;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + ll, ly);
      ctx.stroke();
    }
  }

  // --- 5. Blinking prompt ---
  const promptY = H * 0.90;
  const pulseAlpha = 0.5 + 0.5 * Math.sin(time * MC.PULSE_SPEED);
  ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.6 + pulseAlpha * 0.4) + ')';
  ctx.font = MC.PROMPT_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 255, 255, ' + (pulseAlpha * 0.4) + ')';
  ctx.shadowBlur = 8 + pulseAlpha * 6;
  ctx.fillText('PRESS ENTER TO RACE', W / 2, promptY);
  ctx.shadowBlur = 0;

  // --- 6. Controls hint ---
  const hintY = H * 0.945;
  ctx.fillStyle = MC.HINT_COLOR;
  ctx.font = MC.HINT_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('↑↓←→ or WASD to drive | SHIFT for boost | ESC to pause', W / 2, hintY);

  // --- 7. Version number ---
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.font = MC.VERSION_FONT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('v1.0', W - 16, H - 12);
};

/* =====================================================================
   R.renderPauseMenu() — Pause Overlay
   ===================================================================== */

R.renderPauseMenu = function() {
  const ctx = R.ctx;
  const W = R.canvas.width;
  const H = R.canvas.height;

  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, ' + MC.OVERLAY_ALPHA + ')';
  ctx.fillRect(0, 0, W, H);

  // Central panel
  const panelW = 440;
  const panelH = 300;
  const panelX = (W - panelW) / 2;
  const panelY = (H - panelH) / 2;
  R.drawPanel(panelX, panelY, panelW, panelH, 0.9);

  // "PAUSED" title
  const titleY = panelY + 70;
  ctx.fillStyle = '#ffffff';
  ctx.font = MC.PAUSE_TITLE_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 6;
  ctx.fillText('PAUSED', W / 2, titleY);
  ctx.shadowBlur = 0;

  // Menu items
  const items = [
    { text: 'Press ESC to resume',    yOff: 0,   color: '#ffffff',  bright: true },
    { text: 'R - Restart race',       yOff: 50,  color: '#cccccc',  bright: false },
    { text: 'M - Main menu',          yOff: 90,  color: '#aaaaaa',  bright: false },
  ];

  items.forEach(function(item) {
    const iy = titleY + 40 + item.yOff;
    ctx.fillStyle = item.color;
    ctx.font = MC.PAUSE_ITEM_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (item.bright) {
      ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
      ctx.shadowBlur = 4;
    }
    ctx.fillText(item.text, W / 2, iy);
    ctx.shadowBlur = 0;
  });

  // Decorative pause icon (two vertical bars)
  const iconY = panelY + 235;
  const barW = 8;
  const barH = 28;
  const barGap = 12;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  _roundRect(ctx, W / 2 - barW - barGap / 2, iconY - barH / 2, barW, barH, 3);
  ctx.fill();
  _roundRect(ctx, W / 2 + barGap / 2, iconY - barH / 2, barW, barH, 3);
  ctx.fill();
};

/* =====================================================================
   R.renderCountdownScreen(number) — Countdown Numbers
   Called each frame with the current number (3, 2, 1, or "GO!").
   Scale animation with cubic ease-out.
   ===================================================================== */

R.renderCountdownScreen = function(number) {
  const ctx = R.ctx;
  const W = R.canvas.width;
  const H = R.canvas.height;
  const time = R.state.time;

  // Detect count change
  if (_lastCountNumber !== number) {
    _lastCountNumber = number;
    _countChangeTime = time;
  }

  // Compute scale with cubic ease-out
  const elapsed = time - _countChangeTime;
  const duration = MC.COUNTDOWN_DURATION;
  const t = Math.min(elapsed / duration, 1);
  const scale = 1 + (MC.COUNTDOWN_START_SCALE - 1) * Math.pow(1 - t, 3);
  const alpha = number === 'GO!' ? 1 : 0.5 + 0.5 * Math.pow(1 - t, 2); // fade in as it shrinks

  ctx.save();

  // Semi-transparent backdrop
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, W, H);

  // Text color: white for numbers, gold for GO!
  const isGo = (number === 'GO!');
  const textColor = isGo ? '#ffdd44' : '#ffffff';
  const glowColor = isGo ? 'rgba(255, 200, 50, 0.5)' : 'rgba(255, 255, 255, 0.35)';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = MC.COUNTDOWN_FONT;

  // Apply scale transform around center
  ctx.translate(W / 2, H * 0.42);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  // Glow
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 18 * scale;
  ctx.fillStyle = textColor;
  ctx.fillText(String(number), 0, 0);

  // Second pass: brighter core
  ctx.shadowBlur = 0;
  ctx.fillStyle = textColor;
  ctx.fillText(String(number), 0, 0);

  ctx.restore();
};

/* =====================================================================
   R.renderFinishScreen() — Race Results Overlay
   ===================================================================== */

R.renderFinishScreen = function() {
  const ctx = R.ctx;
  const W = R.canvas.width;
  const H = R.canvas.height;

  // --- 1. Dark semi-transparent background ---
  ctx.fillStyle = 'rgba(0, 0, 0, ' + MC.OVERLAY_ALPHA + ')';
  ctx.fillRect(0, 0, W, H);

  // --- 2. "RACE COMPLETE!" title with golden gradient ---
  const finishTitleY = H * 0.12;
  R.drawGradientText(
    'RACE COMPLETE!',
    W / 2,
    finishTitleY,
    MC.GOLD_TOP,
    MC.GOLD_BOTTOM,
    MC.FINISH_TITLE_FONT
  );

  // Add subtle glow behind title
  ctx.save();
  ctx.font = MC.FINISH_TITLE_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(255, 200, 50, 0.4)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillText('RACE COMPLETE!', W / 2, finishTitleY);
  ctx.shadowBlur = 0;
  ctx.restore();

  // --- Gather race results ---
  // Try R.raceResults first, otherwise build from R.cars.
  /** @type {Array<{name:string, time:number, color:string, isPlayer:boolean}>} */
  let results = [];
  let playerName = 'You';
  let playerIndex = -1;

  if (R.raceResults && R.raceResults.length > 0) {
    // Pre-computed results array
    results = R.raceResults.map(function(r, i) {
      return {
        name: r.name || r.driver || ('Racer ' + (i + 1)),
        time: r.time || r.raceTime || r.finishTime || 0,
        color: r.color || '#888888',
        isPlayer: r.isPlayer || false,
      };
    });
    for (let i = 0; i < results.length; i++) {
      if (results[i].isPlayer) { playerIndex = i; break; }
    }
  } else if (R.cars && R.cars.length > 0) {
    // Build from car objects: sort by raceTime, then by laps descending for DNF
    const cars = R.cars.slice();
    cars.sort(function(a, b) {
      // Finished cars first, sorted by time
      if (a.finished && b.finished) return (a.raceTime || 0) - (b.raceTime || 0);
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      // Both unfinished: more laps = better position
      const lapDiff = (b.lap || 0) - (a.lap || 0);
      if (lapDiff !== 0) return lapDiff;
      return (b.checkpointIdx || 0) - (a.checkpointIdx || 0);
    });
    results = cars.map(function(car, i) {
      return {
        name: car.name || car.driverName || (i === 0 ? 'You' : 'AI ' + i),
        time: car.raceTime != null ? car.raceTime : null,
        color: car.color || '#888888',
        isPlayer: car.isPlayer || (i === 0),
      };
    });
    for (let i = 0; i < results.length; i++) {
      if (results[i].isPlayer) { playerIndex = i; break; }
    }
  }

  // If still no results, show a placeholder
  if (results.length === 0) {
    results = [{ name: 'You', time: R.state.time || 0, color: '#ff6644', isPlayer: true }];
    playerIndex = 0;
  }

  // --- 3. Results table ---
  const tableTop = H * 0.25;
  const headerY = tableTop;
  const rowH = 36;
  const colPad = 16;
  const tableW = Math.min(W * 0.72, 600);
  const tableX = (W - tableW) / 2;

  // Panel behind table
  const panelPad = 20;
  const panelH = headerY + (results.length + 1) * rowH + panelPad * 2 - tableTop + 10;
  R.drawPanel(tableX - panelPad, tableTop - panelPad, tableW + panelPad * 2, panelH, 0.85);

  // Column layout
  const posColX = tableX + 30;
  const nameColX = tableX + 100;
  const timeColX = tableX + tableW - 40;

  // --- Header row ---
  ctx.fillStyle = '#8899aa';
  ctx.font = 'bold ' + MC.RESULTS_HEADER_SIZE + 'px ' + MC.RESULTS_FONT;
  ctx.textBaseline = 'middle';

  ctx.textAlign = 'left';
  ctx.fillText('POS', posColX, headerY);
  ctx.fillText('DRIVER', nameColX, headerY);
  ctx.textAlign = 'right';
  ctx.fillText('TIME', timeColX, headerY);

  // Header underline
  const headerLineY = headerY + rowH * 0.55;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tableX, headerLineY);
  ctx.lineTo(tableX + tableW, headerLineY);
  ctx.stroke();

  // --- Result rows ---
  results.forEach(function(result, i) {
    const rowY = headerY + rowH + i * rowH;
    const isPlayer = result.isPlayer;

    // Row highlight for player
    if (isPlayer) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(tableX, rowY - rowH * 0.45, tableW, rowH);
      // Left accent bar
      ctx.fillStyle = result.color || '#ff6644';
      ctx.fillRect(tableX, rowY - rowH * 0.45, 4, rowH);
    }

    // Position
    ctx.fillStyle = i === 0 ? MC.GOLD_TOP : (i === 1 ? '#cccccc' : (i === 2 ? '#cc9966' : '#889999'));
    ctx.font = 'bold ' + MC.RESULTS_ROW_SIZE + 'px ' + MC.RESULTS_FONT;
    ctx.textAlign = 'left';
    ctx.fillText(_ordinal(i + 1), posColX, rowY);

    // Driver name
    ctx.fillStyle = isPlayer ? (result.color || '#ffffff') : '#cccccc';
    ctx.font = (isPlayer ? 'bold ' : '') + MC.RESULTS_ROW_SIZE + 'px ' + MC.RESULTS_FONT;
    ctx.fillText(result.name, nameColX, rowY);

    // Time
    const timeStr = (result.time != null) ? _formatRaceTime(result.time) : 'DNF';
    ctx.fillStyle = (result.time != null) ? '#dddddd' : '#ff6666';
    ctx.font = MC.RESULTS_ROW_SIZE + 'px ' + MC.RESULTS_FONT;
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, timeColX, rowY);
  });

  // --- 4. Victory message if player is 1st ---
  if (playerIndex === 0) {
    const victoryY = tableTop + panelH + 16;
    ctx.fillStyle = MC.GOLD_TOP;
    ctx.font = 'bold 32px "Segoe UI","Arial Black",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(255, 200, 50, 0.5)';
    ctx.shadowBlur = 12;
    ctx.fillText('\u{1F3C6} VICTORY! \u{1F3C6}', W / 2, victoryY);
    ctx.shadowBlur = 0;
  } else if (playerIndex >= 0 && playerIndex < 3) {
    // Podium finish (2nd or 3rd)
    const podiumY = tableTop + panelH + 16;
    ctx.fillStyle = playerIndex === 1 ? '#cccccc' : '#cc9966';
    ctx.font = 'bold 22px "Segoe UI",Arial,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Podium finish!', W / 2, podiumY);
  }

  // --- 5 & 6. Bottom prompts ---
  const promptY1 = H * 0.90;
  const promptY2 = H * 0.94;

  ctx.fillStyle = '#ffffff';
  ctx.font = MC.PROMPT_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const enterPulse = 0.7 + 0.3 * Math.sin(R.state.time * MC.PULSE_SPEED);
  ctx.globalAlpha = enterPulse;
  ctx.fillText('Press ENTER to race again', W / 2, promptY1);

  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#aaaaaa';
  ctx.font = MC.HINT_FONT;
  ctx.fillText('Press M for main menu', W / 2, promptY2);
  ctx.globalAlpha = 1;
};

/* =====================================================================
   Exported Symbols
   =====================================================================
   R.renderMenu()              — Full title screen (phase='menu')
   R.renderPauseMenu()         — Pause overlay
   R.renderCountdownScreen(n)  — Countdown 3, 2, 1, "GO!" with scale anim
   R.renderFinishScreen()      — Race results overlay
   R.drawGradientText()        — Vertical gradient text (clip+gradient)
   R.drawButton()              — Styled rounded button
   R.drawPanel()               — Semi-transparent panel background
   ===================================================================== */
