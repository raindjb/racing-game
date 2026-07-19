// ui/hand-layout.js — 扇形手牌布局：重叠遮挡 + 弧线 + 旋转 + z 序
// 位置写入 CSS 变量（--tx/--ty/--rot），悬停/选中在 CSS 里基于变量叠加，互不打架。

/**
 * @param {HTMLElement} container #hand-area（position:relative）
 * @param {Array} cards G.hand 顺序
 * @param {Set<number>} selectedIds
 */
export function layoutHand(container, cards, selectedIds = new Set()) {
  const n = cards.length;
  if (!n) return;
  const W = container.clientWidth || 600;
  const cardW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 100;

  // 重叠步长：牌少时舒展、牌多时压缩（保证总宽不超容器）
  const idealStep = cardW * 0.72;
  const step = n > 1 ? Math.min(idealStep, (W - cardW) / (n - 1)) : 0;
  const totalW = cardW + step * (n - 1);
  const x0 = (W - totalW) / 2;

  const spread = Math.min(3.2 * n, 22);  // 扇形总角度
  const arcH = 16;                        // 弧线深度

  cards.forEach((card, i) => {
    const el = container.querySelector(`[data-cid="${card.id}"]`);
    if (!el) return;
    const ratio = n > 1 ? i / (n - 1) : 0.5;
    const rot = (ratio - 0.5) * spread;
    const y = arcH * Math.pow(2 * ratio - 1, 2); // 抛物线：两端下沉
    el.style.setProperty('--tx', `${x0 + i * step}px`);
    el.style.setProperty('--ty', `${y}px`);
    el.style.setProperty('--rot', `${rot}deg`);
    el.style.zIndex = selectedIds.has(card.id) ? 100 + i : i + 1;
  });
}

/** FLIP：记录旧位置 → 布局变更后播放位移动画 */
export function withFlip(container, mutate) {
  const before = new Map();
  for (const el of container.children) {
    before.set(el.dataset.cid, el.getBoundingClientRect());
  }
  mutate();
  requestAnimationFrame(() => {
    for (const el of container.children) {
      const prev = before.get(el.dataset.cid);
      if (!prev) { // 新入场：从右侧飞入
        el.animate(
          [{ transform: 'translateX(140px) rotate(12deg)', opacity: 0 }, { opacity: 1 }],
          { duration: 260, easing: 'cubic-bezier(0.34,1.56,0.64,1)' });
        continue;
      }
      const now = el.getBoundingClientRect();
      const dx = prev.left - now.left, dy = prev.top - now.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0,0)' }],
          { duration: 280, easing: 'cubic-bezier(0.34,1.56,0.64,1)', composite: 'add' });
      }
    }
  });
}
