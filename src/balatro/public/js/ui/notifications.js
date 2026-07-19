// ui/notifications.js — 浮动文字 + 分级粒子系统 + 冲击波 + 屏幕震动（表现层反馈）

let pctx = null, particles = [], rings = [];

export function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  pctx = canvas.getContext('2d');
  const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  window.addEventListener('resize', resize);
  resize();
  (function loop() {
    pctx.clearRect(0, 0, canvas.width, canvas.height);
    // 冲击波圆环
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.r += r.speed; r.life -= r.decay; r.speed *= 0.97;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
      pctx.globalAlpha = r.life * 0.8;
      pctx.strokeStyle = r.color;
      pctx.lineWidth = r.width * r.life;
      pctx.beginPath();
      pctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      pctx.stroke();
    }
    // 粒子
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.life -= p.decay;
      p.rot += p.vrot;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      pctx.globalAlpha = p.life;
      pctx.fillStyle = p.color;
      if (p.glow) { pctx.shadowBlur = 12; pctx.shadowColor = p.color; }
      drawShape(p);
      pctx.shadowBlur = 0;
    }
    pctx.globalAlpha = 1;
    requestAnimationFrame(loop);
  })();
}

function drawShape(p) {
  const s = p.size * (0.4 + p.life * 0.6);
  switch (p.shape) {
    case 'star': {
      pctx.save();
      pctx.translate(p.x, p.y); pctx.rotate(p.rot);
      pctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k * 4 * Math.PI) / 5 - Math.PI / 2;
        pctx[k === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * s, Math.sin(a) * s);
      }
      pctx.closePath(); pctx.fill();
      pctx.restore();
      break;
    }
    case 'spark': {
      // 速度方向拉长的光条
      const len = Math.hypot(p.vx, p.vy) * 2.2 + s;
      const ang = Math.atan2(p.vy, p.vx);
      pctx.save();
      pctx.translate(p.x, p.y); pctx.rotate(ang);
      pctx.fillRect(-len / 2, -s * 0.28, len, s * 0.56);
      pctx.restore();
      break;
    }
    case 'diamond': {
      pctx.save();
      pctx.translate(p.x, p.y); pctx.rotate(p.rot);
      pctx.beginPath();
      pctx.moveTo(0, -s); pctx.lineTo(s * 0.7, 0); pctx.lineTo(0, s); pctx.lineTo(-s * 0.7, 0);
      pctx.closePath(); pctx.fill();
      pctx.restore();
      break;
    }
    default:
      pctx.beginPath();
      pctx.arc(p.x, p.y, s, 0, Math.PI * 2);
      pctx.fill();
  }
}

/** 基础粒子（兼容旧调用） */
export function spawnParticles(x, y, n, color, opts = {}) {
  for (let i = 0; i < n; i++) {
    const speed = opts.speed ?? 9;
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed - (opts.up ?? 3.2),
      life: 1, decay: 0.014 + Math.random() * 0.03,
      size: (opts.size ?? 2) + Math.random() * 4,
      color: Array.isArray(color) ? color[i % color.length] : color,
      shape: opts.shape ?? 'circle',
      gravity: opts.gravity ?? 0.06,
      glow: opts.glow ?? false,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.25,
    });
  }
}

/** 冲击波圆环 */
export function spawnRing(x, y, color, { speed = 7, width = 5 } = {}) {
  rings.push({ x, y, r: 6, speed, width, color, life: 1, decay: 0.03 });
}

/** 全屏闪光（tier 高分用） */
export function screenFlash(color = '#fff', ms = 220) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;inset:0;z-index:490;pointer-events:none;background:${color};opacity:0.34;transition:opacity ${ms}ms ease-out`;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '0'; });
  setTimeout(() => el.remove(), ms + 60);
}

// ===== 结算分级爆发：赤橙黄绿青紫（分数越高越炸裂） =====
export const SCORE_TIERS = [
  { min: 0,      cls: 'tier-0', colors: ['#e8e4d8'],                               n: 16 },
  { min: 300,    cls: 'tier-1', colors: ['#ff4c40', '#ff8a70'],                    n: 28 },
  { min: 800,    cls: 'tier-2', colors: ['#ff9030', '#ffb860'],                    n: 40, ring: 1 },
  { min: 2000,   cls: 'tier-3', colors: ['#ffd83a', '#fff0a0'],                    n: 55, ring: 1, star: true },
  { min: 5000,   cls: 'tier-4', colors: ['#4bff6e', '#a8ffc0', '#20d848'],         n: 72, ring: 2, star: true },
  { min: 12000,  cls: 'tier-5', colors: ['#3ae8e8', '#88f4ff', '#20b8d8'],         n: 92, ring: 2, star: true, flash: true },
  { min: 30000,  cls: 'tier-6', colors: ['#b53aff', '#e088ff', '#ff52c8', '#8a20e8'], n: 120, ring: 3, star: true, flash: true },
  { min: 100000, cls: 'tier-7', colors: ['#ff4c40','#ffd83a','#4bff6e','#3ae8e8','#b53aff','#ff52c8'], n: 180, ring: 4, star: true, flash: true },
  { min: 1000000,cls: 'tier-8', colors: ['#ff0000','#ff8000','#ffff00','#00ff00','#0080ff','#8000ff','#ff00ff','#ffffff'], n: 260, ring: 6, star: true, flash: true },
];

export function tierOf(score) {
  let t = SCORE_TIERS[0];
  for (const s of SCORE_TIERS) if (score >= s.min) t = s;
  return t;
}

/** 分级结算爆发：粒子（圆+星+光条）+ 冲击波 + 闪光 */
export function scoreBurst(x, y, score) {
  const t = tierOf(score);
  const main = t.colors[0];
  // 主体圆粒子
  spawnParticles(x, y, t.n, t.colors, { speed: 8 + t.n / 14, glow: t.ring >= 2 });
  // 光条飞溅
  spawnParticles(x, y, Math.round(t.n * 0.45), t.colors, { shape: 'spark', speed: 13 + t.n / 10, gravity: 0.1, glow: true });
  // 星形（tier3+）
  if (t.star) spawnParticles(x, y, Math.round(t.n * 0.3), t.colors, { shape: 'star', speed: 7, gravity: 0.03, size: 3.5, glow: true });
  // 菱形点缀（tier4+）
  if (t.ring >= 2) spawnParticles(x, y, Math.round(t.n * 0.25), '#ffffff', { shape: 'diamond', speed: 10, gravity: 0.04, size: 2.5 });
  // 冲击波
  for (let i = 0; i < (t.ring ?? 0); i++) {
    setTimeout(() => spawnRing(x, y, t.colors[i % t.colors.length], { speed: 8 + i * 3, width: 6 - i }), i * 90);
  }
  // 全屏闪光
  if (t.flash) screenFlash(main, 260);
  return t;
}

/** 浮动文字：cls ∈ chips|mult|xmult|gold|white|red */
export function floatText(text, x, y, cls = 'white') {
  const el = document.createElement('div');
  el.className = `float-txt ft-${cls}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1150);
}

export function shakeScreen(strong = false) {
  const app = document.getElementById('app');
  app.style.animation = 'none';
  void app.offsetWidth;      // 重置动画
  app.style.animation = `screenShake ${strong ? 0.5 : 0.32}s ease-out`;
}
