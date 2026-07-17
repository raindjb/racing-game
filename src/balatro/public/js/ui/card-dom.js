// ui/card-dom.js — 卡牌 DOM 工厂 + 复用池（card.id ↔ element 一一映射）
import { cardFaceSVG, cardBackSVG } from '../svg/card-face.js';
import { ENHANCEMENTS, SEALS, SUIT_INFO } from '../data/card-data.js';

const pool = new Map(); // card.id -> element

const ENH_TAG = {
  bonus: { text: '+30', cls: 'tag-bonus' },
  mult:  { text: '+4×', cls: 'tag-mult' },
  wild:  { text: '万能', cls: 'tag-wild' },
  glass: { text: '×2', cls: 'tag-glass' },
  steel: { text: '×1.5', cls: 'tag-steel' },
  gold:  { text: '$3', cls: 'tag-gold' },
  lucky: { text: '🍀', cls: 'tag-lucky' },
};

/** 获取（或创建）卡牌元素并同步状态 */
export function cardEl(card) {
  let el = pool.get(card.id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'card';
    el.dataset.cid = card.id;
    el.innerHTML = `<div class="card-face"></div><div class="card-badges"></div>`;
    pool.set(card.id, el);
  }
  updateCardEl(el, card);
  return el;
}

/** 同步卡牌元素外观（幂等） */
export function updateCardEl(el, card) {
  const face = el.querySelector('.card-face');
  const wantBack = !!card.faceDown;
  const faceKey = wantBack ? '__back' : `${card.suit}-${card.rank}-${card.enhancement}`;
  if (el.dataset.faceKey !== faceKey) {
    face.innerHTML = wantBack ? cardBackSVG() : cardFaceSVG(card);
    el.dataset.faceKey = faceKey;
  }

  el.classList.toggle('face-down', wantBack);
  el.classList.toggle('debuffed', !!card.debuffed);
  // 强化/版本 class（发光边框等）
  el.className = el.className.replace(/\benh-\w+|\bed-\w+/g, '').trim();
  if (card.enhancement) el.classList.add(`enh-${card.enhancement}`);
  if (card.edition) el.classList.add(`ed-${card.edition}`);

  // 角标：强化标签 + 蜡封圆点
  const badges = el.querySelector('.card-badges');
  let html = '';
  if (!wantBack && card.enhancement && ENH_TAG[card.enhancement]) {
    const t = ENH_TAG[card.enhancement];
    html += `<span class="enh-tag ${t.cls}">${t.text}</span>`;
  }
  if (card.seal) html += `<span class="seal-dot seal-${card.seal}" title="${SEALS[card.seal].zh}"></span>`;
  if (badges.dataset.html !== html) { badges.innerHTML = html; badges.dataset.html = html; }

  // 无障碍/悬浮说明
  if (!wantBack && card.enhancement !== 'stone') {
    el.title = `${SUIT_INFO[card.suit].zh}${card.rank}` +
      (card.enhancement ? ` · ${ENHANCEMENTS[card.enhancement].zh}` : '') +
      (card.debuffed ? ' · 失效' : '');
  } else {
    el.title = wantBack ? '背面朝上' : '石头牌';
  }
}

/** 销毁的卡牌从池中移除 */
export function releaseCard(id) {
  const el = pool.get(id);
  if (el) { el.remove(); pool.delete(id); }
}

export function clearPool() {
  for (const el of pool.values()) el.remove();
  pool.clear();
}
