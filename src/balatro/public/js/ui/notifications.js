// ui/notifications.js — 浮动文字 + 粒子系统 + 屏幕震动（表现层反馈）

let pctx = null, particles = [];

export function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  pctx = canvas.getContext('2d');
  const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  window.addEventListener('resize', resize);
  resize();
  (function loop() {
    pctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= p.decay;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      pctx.globalAlpha = p.life;
      pctx.fillStyle = p.color;
      pctx.beginPath();
      pctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      pctx.fill();
    }
    pctx.globalAlpha = 1;
    requestAnimationFrame(loop);
  })();
}

export function spawnParticles(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 9,
      vy: (Math.random() - 0.5) * 9 - 3.2,
      life: 1, decay: 0.014 + Math.random() * 0.03,
      size: 2 + Math.random() * 4, color,
    });
  }
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
