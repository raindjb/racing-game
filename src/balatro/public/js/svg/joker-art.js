// svg/joker-art.js — Joker 卡面程序化生成：主色渐变 + 图案库 + 纹理
// 稀有度边框由 CSS（jokers.css .rarity-*）负责。

const ICONS = {
  mask:     '<path d="M-14 -6 Q0 -16 14 -6 Q14 8 0 14 Q-14 8 -14 -6 Z" fill="none" stroke="#fff" stroke-width="2.6"/><circle cx="-5.5" cy="-2" r="2.4" fill="#fff"/><circle cx="5.5" cy="-2" r="2.4" fill="#fff"/><path d="M-6 6 Q0 10 6 6" fill="none" stroke="#fff" stroke-width="2.2"/>',
  star:     '<path d="M0 -14 L3.9 -4.6 L14 -4 L6.2 2.8 L8.6 13 L0 7.4 L-8.6 13 L-6.2 2.8 L-14 -4 L-3.9 -4.6 Z" fill="#fff"/>',
  skull:    '<path d="M-9 -3 A9 9.5 0 1 1 9 -3 L9 6 L4 6 L4 10 L-4 10 L-4 6 L-9 6 Z" fill="#fff"/><circle cx="-4" cy="-3" r="2.6" fill="#333"/><circle cx="4" cy="-3" r="2.6" fill="#333"/>',
  crown:    '<path d="M-13 8 L-13 -4 L-6 2 L0 -9 L6 2 L13 -4 L13 8 Z" fill="#fff"/><rect x="-13" y="8" width="26" height="3.4" rx="1.5" fill="#fff" opacity="0.85"/>',
  diamond:  '<path d="M0 -13 L9.5 0 L0 13 L-9.5 0 Z" fill="#fff"/>',
  heart:    '<path d="M0 12 L-9.5 2 A5.8 5.8 0 1 1 0 -4 A5.8 5.8 0 1 1 9.5 2 Z" fill="#fff"/>',
  spade:    '<g transform="translate(0 -1)"><path d="M0 -12 L9.5 -1 A5.8 5.8 0 1 1 1 5 L0 4 L-1 5 A5.8 5.8 0 1 1 -9.5 -1 Z" fill="#fff"/><path d="M0 3 C1 8 3 10 5 12.5 L-5 12.5 C-3 10 -1 8 0 3 Z" fill="#fff"/></g>',
  club:     '<g><circle cx="0" cy="-6.5" r="5.2" fill="#fff"/><circle cx="-5.4" cy="1.6" r="5.2" fill="#fff"/><circle cx="5.4" cy="1.6" r="5.2" fill="#fff"/><path d="M0 1 C1 7 3 10 5 12.5 L-5 12.5 C-3 10 -1 7 0 1 Z" fill="#fff"/></g>',
  moon:     '<path d="M4 -13 A13 13 0 1 0 4 13 A10 10 0 1 1 4 -13 Z" fill="#fff"/>',
  bolt:     '<path d="M3 -14 L-8 2 L-1 2 L-3 14 L8 -2 L1 -2 Z" fill="#fff"/>',
  eye:      '<path d="M-14 0 Q0 -11 14 0 Q0 11 -14 0 Z" fill="none" stroke="#fff" stroke-width="2.6"/><circle cx="0" cy="0" r="4.6" fill="#fff"/>',
  flag:     '<rect x="-9" y="-13" width="2.6" height="26" rx="1.3" fill="#fff"/><path d="M-6 -12 L11 -8 L-6 -3 Z" fill="#fff"/>',
  mountain: '<path d="M-14 10 L-4 -8 L1 0 L6 -11 L14 10 Z" fill="#fff"/><circle cx="8" cy="-9" r="2.6" fill="#fff" opacity="0.7"/>',
  question: '<text x="0" y="8" text-anchor="middle" font-size="26" font-weight="900" fill="#fff" font-family="Georgia,serif">?</text>',
  fist:     '<rect x="-10" y="-8" width="20" height="16" rx="6" fill="#fff"/><rect x="-10" y="-2" width="20" height="2" fill="rgba(0,0,0,0.25)"/><rect x="8" y="-6" width="4.5" height="10" rx="2" fill="#fff"/>',
  spiral:   '<path d="M0 0 A2.5 2.5 0 0 1 5 0 A5 5 0 0 1 -5 0 A7.5 7.5 0 0 1 10 0 A10 10 0 0 1 -10 0 A12.5 12.5 0 0 1 12.5 0" fill="none" stroke="#fff" stroke-width="2.4"/>',
  coin:     '<circle cx="0" cy="0" r="12" fill="none" stroke="#fff" stroke-width="2.8"/><text x="0" y="6.5" text-anchor="middle" font-size="17" font-weight="800" fill="#fff">$</text>',
};

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

const cache = new Map();

/** Joker 卡面 SVG（100×140） */
export function jokerArtSVG(art, seedId = '') {
  const key = `${art.color}-${art.icon}-${seedId}`;
  if (cache.has(key)) return cache.get(key);
  const gid = `jg-${seedId || art.icon}-${Math.abs(hash(key)) % 99999}`;
  const dots = decorDots(key);
  const svg =
    `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0.6" y2="1">` +
    `<stop offset="0" stop-color="${shade(art.color, 1.25)}"/>` +
    `<stop offset="1" stop-color="${shade(art.color, 0.45)}"/></linearGradient></defs>` +
    `<rect x="1" y="1" width="98" height="138" rx="9" fill="url(#${gid})"/>` +
    dots +
    `<g transform="translate(50 66) scale(1.7)" opacity="0.95">${ICONS[art.icon] ?? ICONS.question}</g>` +
    `<rect x="1" y="1" width="98" height="138" rx="9" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="2"/></svg>`;
  cache.set(key, svg);
  return svg;
}

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

/** 背景装饰点（按 key 确定性分布） */
function decorDots(key) {
  let h = Math.abs(hash(key)), out = '';
  for (let i = 0; i < 7; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const x = 8 + (h % 84); const y = 10 + ((h >> 7) % 120); const r = 1.5 + ((h >> 14) % 3);
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,255,255,0.14)"/>`;
  }
  return out;
}
