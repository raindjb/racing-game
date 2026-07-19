// ui/drag.js — Pointer Events 拖拽理牌：拖动中实时让位，松手落位
import { G, PHASES, bus } from '../state.js';
import { layoutHand } from './hand-layout.js';

let st = null;              // 当前拖拽状态
let suppressClick = false;  // 拖拽结束后吞掉一次 click（避免误选牌）

export function isDragging() { return !!(st && st.dragging); }
export function consumeSuppressedClick() { const v = suppressClick; suppressClick = false; return v; }

export function initDrag(container) {
  const cardW = () =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 100;

  container.addEventListener('pointerdown', e => {
    if (G.phase !== PHASES.PLAYING) return;
    const el = e.target.closest('.card');
    if (!el) return;
    const card = G.hand.find(c => c.id === Number(el.dataset.cid));
    if (!card) return;
    st = { card, el, startX: e.clientX, startY: e.clientY, dragging: false };
    el.setPointerCapture(e.pointerId);
  });

  container.addEventListener('pointermove', e => {
    if (!st) return;
    if (!st.dragging) {
      if (Math.hypot(e.clientX - st.startX, e.clientY - st.startY) < 7) return;
      st.dragging = true;
      st.el.classList.add('dragging');
      st.baseRect = container.getBoundingClientRect();
      st.grabOffset = e.clientX - st.el.getBoundingClientRect().left;
    }
    // 拖拽牌跟随指针（内联 transform 覆盖变量布局）
    const localX = e.clientX - st.baseRect.left - st.grabOffset;
    const localY = Math.max(-70, Math.min(50, e.clientY - st.baseRect.top - 24));
    st.el.style.transform = `translate(${localX}px, ${localY}px) rotate(0deg) scale(1.08)`;

    // 计算插入位：与其余牌的槽位中心比较
    const centerX = e.clientX - st.baseRect.left;
    const others = G.hand.filter(c => c !== st.card);
    let idx = others.length;
    for (let i = 0; i < others.length; i++) {
      const oel = container.querySelector(`[data-cid="${others[i].id}"]`);
      if (!oel) continue;
      const ox = parseFloat(oel.style.getPropertyValue('--tx')) + cardW() / 2;
      if (centerX < ox) { idx = i; break; }
    }
    const newOrder = [...others.slice(0, idx), st.card, ...others.slice(idx)];
    if (newOrder.some((c, i) => c !== G.hand[i])) {
      G.hand.length = 0;
      G.hand.push(...newOrder);
      layoutHand(container, G.hand, new Set(G.selected)); // 其他牌实时让位（CSS 过渡）
    }
  });

  const finish = () => {
    if (!st) return;
    if (st.dragging) {
      suppressClick = true;
      st.el.classList.remove('dragging');
      st.el.style.removeProperty('transform'); // 回落到变量布局 → 平滑归位
      layoutHand(container, G.hand, new Set(G.selected));
      bus.emit('hand:reordered');
    }
    st = null;
  };
  container.addEventListener('pointerup', finish);
  container.addEventListener('pointercancel', finish);
}
