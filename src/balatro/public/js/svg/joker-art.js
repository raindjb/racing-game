// svg/joker-art.js — Joker 卡面程序化生成：主色渐变 + 精细图案库 + 装饰纹理
// 稀有度边框由 CSS（jokers.css .rarity-*）负责。
// 图标双色调（主白 + 暗部阴影 + 高光），带内发光底座。

// 每个图标：dark 层（偏移阴影）→ main 层（白）→ 高光点缀
const ICONS = {
  mask: `
    <path d="M-14 -6 Q0 -16 14 -6 Q14 8 0 14 Q-14 8 -14 -6 Z" fill="rgba(0,0,0,0.3)" transform="translate(1.2 1.5)"/>
    <path d="M-14 -6 Q0 -16 14 -6 Q14 8 0 14 Q-14 8 -14 -6 Z" fill="none" stroke="#fff" stroke-width="2.6"/>
    <path d="M-14 -6 Q0 -16 14 -6" fill="none" stroke="#ffe9a8" stroke-width="1" opacity="0.8"/>
    <circle cx="-5.5" cy="-2" r="2.4" fill="#fff"/><circle cx="5.5" cy="-2" r="2.4" fill="#fff"/>
    <circle cx="-4.9" cy="-2.6" r="0.8" fill="#ffe9a8"/><circle cx="6.1" cy="-2.6" r="0.8" fill="#ffe9a8"/>
    <path d="M-6 6 Q0 10 6 6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`,
  star: `
    <path d="M0 -14 L3.9 -4.6 L14 -4 L6.2 2.8 L8.6 13 L0 7.4 L-8.6 13 L-6.2 2.8 L-14 -4 L-3.9 -4.6 Z" fill="rgba(0,0,0,0.3)" transform="translate(1.2 1.5)"/>
    <path d="M0 -14 L3.9 -4.6 L14 -4 L6.2 2.8 L8.6 13 L0 7.4 L-8.6 13 L-6.2 2.8 L-14 -4 L-3.9 -4.6 Z" fill="#fff"/>
    <path d="M0 -14 L3.9 -4.6 L14 -4 L6.2 2.8 L0 0 Z" fill="#ffe9a8" opacity="0.55"/>
    <circle cx="0" cy="0" r="2" fill="#ffe9a8" opacity="0.9"/>`,
  skull: `
    <path d="M-9 -3 A9 9.5 0 1 1 9 -3 L9 6 L4 6 L4 10 L-4 10 L-4 6 L-9 6 Z" fill="rgba(0,0,0,0.3)" transform="translate(1.2 1.5)"/>
    <path d="M-9 -3 A9 9.5 0 1 1 9 -3 L9 6 L4 6 L4 10 L-4 10 L-4 6 L-9 6 Z" fill="#fff"/>
    <path d="M-9 -3 A9 9.5 0 0 1 0 -12.5 L0 -9 A6 6.5 0 0 0 -6 -3 Z" fill="#ffe9a8" opacity="0.45"/>
    <circle cx="-4" cy="-3" r="2.6" fill="#2a2a33"/><circle cx="4" cy="-3" r="2.6" fill="#2a2a33"/>
    <circle cx="-3.4" cy="-3.7" r="0.8" fill="#8af"/><circle cx="4.6" cy="-3.7" r="0.8" fill="#8af"/>
    <path d="M-2.5 4 L-1.2 6 M0 4 L0 6.5 M2.5 4 L1.2 6" stroke="#2a2a33" stroke-width="1" opacity="0.6"/>`,
  crown: `
    <path d="M-13 8 L-13 -4 L-6 2 L0 -9 L6 2 L13 -4 L13 8 Z" fill="rgba(0,0,0,0.3)" transform="translate(1.2 1.5)"/>
    <path d="M-13 8 L-13 -4 L-6 2 L0 -9 L6 2 L13 -4 L13 8 Z" fill="#fff"/>
    <path d="M-13 -4 L-6 2 L0 -9 L0 -3 L-6 4.5 L-13 -1 Z" fill="#ffe9a8" opacity="0.5"/>
    <rect x="-13" y="8" width="26" height="3.4" rx="1.5" fill="#fff"/>
    <rect x="-13" y="8" width="26" height="1.4" rx="0.7" fill="#ffe9a8" opacity="0.7"/>
    <circle cx="0" cy="-9" r="1.8" fill="#ffe9a8"/>
    <circle cx="-13" cy="-4" r="1.5" fill="#ffe9a8"/><circle cx="13" cy="-4" r="1.5" fill="#ffe9a8"/>
    <circle cx="0" cy="3" r="2" fill="rgba(0,0,0,0.25)"/><circle cx="-7.5" cy="9.7" r="1" fill="rgba(0,0,0,0.25)"/><circle cx="7.5" cy="9.7" r="1" fill="rgba(0,0,0,0.25)"/>`,
  diamond: `
    <path d="M0 -13 L9.5 0 L0 13 L-9.5 0 Z" fill="rgba(0,0,0,0.3)" transform="translate(1.2 1.5)"/>
    <path d="M0 -13 L9.5 0 L0 13 L-9.5 0 Z" fill="#fff"/>
    <path d="M0 -13 L9.5 0 L0 0 Z" fill="#ffe9a8" opacity="0.5"/>
    <path d="M0 -13 L-9.5 0 L0 0 Z" fill="rgba(0,0,0,0.12)"/>
    <path d="M-4 0 L0 -5.5 L4 0 L0 5.5 Z" fill="none" stroke="rgba(0,0,0,0.2)" stroke-width="1"/>`,
  heart: `
    <path d="M0 12 L-9.5 2 A5.8 5.8 0 1 1 0 -4 A5.8 5.8 0 1 1 9.5 2 Z" fill="rgba(0,0,0,0.3)" transform="translate(1.2 1.5)"/>
    <path d="M0 12 L-9.5 2 A5.8 5.8 0 1 1 0 -4 A5.8 5.8 0 1 1 9.5 2 Z" fill="#fff"/>
    <path d="M-9.5 2 A5.8 5.8 0 1 1 0 -4 L0 1 Z" fill="#ffe9a8" opacity="0.45"/>
    <ellipse cx="-4.5" cy="-4.5" rx="2.4" ry="1.6" fill="#fff" opacity="0.9" transform="rotate(-25 -4.5 -4.5)"/>`,
  spade: `
    <g transform="translate(1.2 0.5)"><path d="M0 -12 L9.5 -1 A5.8 5.8 0 1 1 1 5 L0 4 L-1 5 A5.8 5.8 0 1 1 -9.5 -1 Z" fill="rgba(0,0,0,0.3)"/></g>
    <g transform="translate(0 -1)">
      <path d="M0 -12 L9.5 -1 A5.8 5.8 0 1 1 1 5 L0 4 L-1 5 A5.8 5.8 0 1 1 -9.5 -1 Z" fill="#fff"/>
      <path d="M0 -12 L-9.5 -1 A5.8 5.8 0 0 0 -4 6 L0 -2 Z" fill="#ffe9a8" opacity="0.4"/>
      <path d="M0 3 C1 8 3 10 5 12.5 L-5 12.5 C-3 10 -1 8 0 3 Z" fill="#fff"/>
    </g>`,
  club: `
    <g transform="translate(1.2 1.5)"><circle cx="0" cy="-6.5" r="5.2" fill="rgba(0,0,0,0.3)"/><circle cx="-5.4" cy="1.6" r="5.2" fill="rgba(0,0,0,0.3)"/><circle cx="5.4" cy="1.6" r="5.2" fill="rgba(0,0,0,0.3)"/></g>
    <circle cx="0" cy="-6.5" r="5.2" fill="#fff"/>
    <circle cx="-5.4" cy="1.6" r="5.2" fill="#fff"/>
    <circle cx="5.4" cy="1.6" r="5.2" fill="#fff"/>
    <circle cx="-1.8" cy="-8" r="1.8" fill="#ffe9a8" opacity="0.8"/>
    <path d="M0 1 C1 7 3 10 5 12.5 L-5 12.5 C-3 10 -1 7 0 1 Z" fill="#fff"/>`,
  moon: `
    <path d="M4 -13 A13 13 0 1 0 4 13 A10 10 0 1 1 4 -13 Z" fill="rgba(0,0,0,0.3)" transform="translate(1.2 1.5)"/>
    <path d="M4 -13 A13 13 0 1 0 4 13 A10 10 0 1 1 4 -13 Z" fill="#fff"/>
    <path d="M4 -13 A13 13 0 0 0 -8.5 -6 L-4 -3 A9 9 0 0 1 4 -10 Z" fill="#ffe9a8" opacity="0.45"/>
    <circle cx="-4" cy="-4" r="1.4" fill="rgba(0,0,0,0.15)"/>
    <circle cx="-6.5" cy="3" r="2" fill="rgba(0,0,0,0.12)"/>
    <circle cx="-2" cy="7" r="1.1" fill="rgba(0,0,0,0.15)"/>`,
  bolt: `
    <path d="M3 -14 L-8 2 L-1 2 L-3 14 L8 -2 L1 -2 Z" fill="rgba(0,0,0,0.3)" transform="translate(1.4 1.5)"/>
    <path d="M3 -14 L-8 2 L-1 2 L-3 14 L8 -2 L1 -2 Z" fill="#fff"/>
    <path d="M3 -14 L-8 2 L-3.5 2 L1.5 -6 Z" fill="#ffe9a8" opacity="0.6"/>`,
  eye: `
    <path d="M-14 0 Q0 -11 14 0 Q0 11 -14 0 Z" fill="rgba(0,0,0,0.25)" transform="translate(1 1.3)"/>
    <path d="M-14 0 Q0 -11 14 0 Q0 11 -14 0 Z" fill="none" stroke="#fff" stroke-width="2.6"/>
    <path d="M-14 0 Q0 -11 14 0" fill="none" stroke="#ffe9a8" stroke-width="1" opacity="0.7"/>
    <circle cx="0" cy="0" r="5.6" fill="#fff" opacity="0.25"/>
    <circle cx="0" cy="0" r="4.6" fill="#fff"/>
    <circle cx="0" cy="0" r="2.2" fill="rgba(0,0,0,0.55)"/>
    <circle cx="1.4" cy="-1.4" r="1.1" fill="#fff"/>
    <path d="M-9 -3 Q-4 -6.5 0 -6.8" stroke="#fff" stroke-width="0.8" fill="none" opacity="0.5"/>`,
  flag: `
    <rect x="-7.8" y="-11.5" width="2.6" height="26" rx="1.3" fill="rgba(0,0,0,0.3)" transform="translate(1 1.3)"/>
    <rect x="-9" y="-13" width="2.6" height="26" rx="1.3" fill="#fff"/>
    <rect x="-9" y="-13" width="1" height="26" rx="0.5" fill="#ffe9a8" opacity="0.6"/>
    <path d="M-6 -12 L11 -8 L-6 -3 Z" fill="rgba(0,0,0,0.3)" transform="translate(1.2 1.3)"/>
    <path d="M-6 -12 L11 -8 L-6 -3 Z" fill="#fff"/>
    <path d="M-6 -12 L3 -10 L-6 -7.5 Z" fill="#ffe9a8" opacity="0.5"/>
    <circle cx="-7.7" cy="-13.5" r="1.6" fill="#ffe9a8"/>`,
  mountain: `
    <path d="M-14 10 L-4 -8 L1 0 L6 -11 L14 10 Z" fill="rgba(0,0,0,0.3)" transform="translate(1.2 1.5)"/>
    <path d="M-14 10 L-4 -8 L1 0 L6 -11 L14 10 Z" fill="#fff"/>
    <path d="M-4 -8 L-1.5 -3.5 L-3 -2 L-4.5 -4 Z" fill="#ffe9a8" opacity="0.7"/>
    <path d="M6 -11 L8.2 -6.5 L6.5 -5 L4.5 -7.8 Z" fill="#ffe9a8" opacity="0.7"/>
    <path d="M-14 10 L-4 -8 L-1 -2.5 L-8 10 Z" fill="rgba(0,0,0,0.1)"/>
    <circle cx="9" cy="-9.5" r="2.4" fill="#ffe9a8" opacity="0.85"/>`,
  question: `
    <text x="1.2" y="9.5" text-anchor="middle" font-size="26" font-weight="900" fill="rgba(0,0,0,0.3)" font-family="Georgia,serif">?</text>
    <text x="0" y="8" text-anchor="middle" font-size="26" font-weight="900" fill="#fff" font-family="Georgia,serif">?</text>`,
  fist: `
    <rect x="-8.8" y="-6.5" width="20" height="16" rx="6" fill="rgba(0,0,0,0.3)"/>
    <rect x="-10" y="-8" width="20" height="16" rx="6" fill="#fff"/>
    <rect x="-10" y="-8" width="20" height="5" rx="2.5" fill="#ffe9a8" opacity="0.4"/>
    <path d="M-5 -8 L-5 8 M0 -8 L0 8 M5 -8 L5 8" stroke="rgba(0,0,0,0.18)" stroke-width="1.2"/>
    <rect x="8" y="-6" width="4.5" height="10" rx="2" fill="#fff"/>
    <rect x="8" y="-6" width="4.5" height="3" rx="1.5" fill="#ffe9a8" opacity="0.5"/>`,
  spiral: `
    <path d="M0 0 A2.5 2.5 0 0 1 5 0 A5 5 0 0 1 -5 0 A7.5 7.5 0 0 1 10 0 A10 10 0 0 1 -10 0 A12.5 12.5 0 0 1 12.5 0" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="2.4" transform="translate(1 1.3)"/>
    <path d="M0 0 A2.5 2.5 0 0 1 5 0 A5 5 0 0 1 -5 0 A7.5 7.5 0 0 1 10 0 A10 10 0 0 1 -10 0 A12.5 12.5 0 0 1 12.5 0" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="0" cy="0" r="1.6" fill="#ffe9a8"/>`,
  coin: `
    <circle cx="1" cy="1.3" r="12" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="2.8"/>
    <circle cx="0" cy="0" r="12" fill="none" stroke="#fff" stroke-width="2.8"/>
    <path d="M-8.5 -8.5 A12 12 0 0 1 0 -12" fill="none" stroke="#ffe9a8" stroke-width="1.4" opacity="0.9"/>
    <circle cx="0" cy="0" r="9" fill="none" stroke="#fff" stroke-width="0.7" opacity="0.4" stroke-dasharray="2 2"/>
    <text x="0" y="6.5" text-anchor="middle" font-size="17" font-weight="800" fill="#fff">$</text>`,
};

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

const cache = new Map();

/** Joker 卡面 SVG（100×140）：渐变底 + 角饰 + 内发光图标底座 + 装饰点 */
export function jokerArtSVG(art, seedId = '') {
  const key = `${art.color}-${art.icon}-${seedId}`;
  if (cache.has(key)) return cache.get(key);
  const gid = `jg-${seedId || art.icon}-${Math.abs(hash(key)) % 99999}`;
  const dots = decorDots(key);
  const svg =
    `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">` +
    `<defs>` +
    `<linearGradient id="${gid}" x1="0" y1="0" x2="0.6" y2="1">` +
    `<stop offset="0" stop-color="${shade(art.color, 1.25)}"/>` +
    `<stop offset="1" stop-color="${shade(art.color, 0.45)}"/></linearGradient>` +
    `<radialGradient id="${gid}-halo" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="rgba(255,255,255,0.22)"/>` +
    `<stop offset="0.7" stop-color="rgba(255,255,255,0.06)"/>` +
    `<stop offset="1" stop-color="rgba(255,255,255,0)"/></radialGradient>` +
    `</defs>` +
    `<rect x="1" y="1" width="98" height="138" rx="9" fill="url(#${gid})"/>` +
    // 顶部光带
    `<path d="M1 30 Q50 14 99 30 L99 10 Q99 1 90 1 L10 1 Q1 1 1 10 Z" fill="rgba(255,255,255,0.10)"/>` +
    dots +
    // 图标底座光晕
    `<circle cx="50" cy="66" r="30" fill="url(#${gid}-halo)"/>` +
    `<circle cx="50" cy="66" r="26" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>` +
    `<circle cx="50" cy="66" r="29" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.8" stroke-dasharray="3 4"/>` +
    `<g transform="translate(50 66) scale(1.7)">${ICONS[art.icon] ?? ICONS.question}</g>` +
    // 四角饰线
    corner(8, 8, 1, 1) + corner(92, 8, -1, 1) + corner(8, 132, 1, -1) + corner(92, 132, -1, -1) +
    `<rect x="1" y="1" width="98" height="138" rx="9" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="2"/>` +
    `<rect x="4" y="4" width="92" height="132" rx="7" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="1"/></svg>`;
  cache.set(key, svg);
  return svg;
}

/** 角落饰线（L形 + 圆点） */
function corner(x, y, dx, dy) {
  return `<path d="M${x} ${y + dy * 8} L${x} ${y} L${x + dx * 8} ${y}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.4" stroke-linecap="round"/>` +
    `<circle cx="${x + dx * 3}" cy="${y + dy * 3}" r="1" fill="rgba(255,255,255,0.3)"/>`;
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
