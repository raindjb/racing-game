// ui/hover-3d.js — 悬停 3D 倾斜：卡牌绕指针位置轻微翻转（perspective + rotateX/Y）
import { isDragging } from './drag.js';

export function initHover3d(container) {
  container.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || isDragging()) return;
    const el = e.target.closest('.card');
    if (!el || el.classList.contains('dragging')) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;   // -0.5 ~ 0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    const lift = el.classList.contains('selected') ? -36 : -14;
    el.style.transform =
      `perspective(650px) translate(var(--tx, 0), calc(var(--ty, 0px) + ${lift}px)) ` +
      `rotate(calc(var(--rot, 0deg) * 0.4)) ` +
      `rotateY(${(px * 16).toFixed(1)}deg) rotateX(${(-py * 12).toFixed(1)}deg) scale(1.05)`;
  });

  container.addEventListener('pointerout', e => {
    const el = e.target.closest('.card');
    if (el && !el.classList.contains('dragging')) el.style.transform = '';
  });
}
