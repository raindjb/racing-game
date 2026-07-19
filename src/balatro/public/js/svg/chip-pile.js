// svg/chip-pile.js v3 — 赌场筹码海：散落+不规则柱+5档独特特效
import { getChips } from '../upgrades.js';

const D = [
  { color: '#e8dcc8', edge: '#b8a888', ring: '#a09070', value: 1 },
  { color: '#e84838', edge: '#a02018', ring: '#d06050', value: 5 },
  { color: '#30a858', edge: '#186830', ring: '#50c878', value: 25 },
  { color: '#181828', edge: '#080810', ring: '#505068', value: 100 },
  { color: '#6828b0', edge: '#381060', ring: '#9058d8', value: 500 },
];

// 5 档配置（每档不同视觉特征）
const TIERS = [
  { min: 0,    scattered: 8,  cols: 0, colH: 0,  scale: 1.0, bg: '#1a1a18', glow: 'none',        label: '起步' },
  { min: 100,  scattered: 18, cols: 2, colH: 5,  scale: 1.05,bg: '#1a1818', glow: 'rgba(200,160,60,0.08)', label: '小有积蓄' },
  { min: 500,  scattered: 30, cols: 3, colH: 8,  scale: 1.1, bg: '#181818', glow: 'rgba(220,180,60,0.14)', label: '筹码堆' },
  { min: 1000, scattered: 40, cols: 4, colH: 12, scale: 1.2, bg: '#181a18', glow: 'rgba(240,192,40,0.22)', label: '筹码山' },
  { min: 5000, scattered: 50, cols: 5, colH: 16, scale: 1.3, bg: '#1a1818', glow: 'rgba(255,200,40,0.32)', label: '筹码帝国' },
];

function tierOf(c) { let t = TIERS[0]; for (const s of TIERS) if (c >= s.min) t = s; return t; }

/** 单枚筹码 */
function chip(x, y, r, tilt, d) {
  return `<g transform="translate(${x} ${y}) rotate(${tilt})">
    <ellipse cx="0" cy="3" rx="${r}" ry="${r*0.45}" fill="${d.edge}"/>
    <ellipse cx="0" cy="0" rx="${r}" ry="${r*0.45}" fill="${d.color}" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
    <ellipse cx="0" cy="0" rx="${r*0.68}" ry="${r*0.3}" fill="none" stroke="${d.ring}" stroke-width="1.4" stroke-dasharray="3 2"/>
    <text x="0" y="4" text-anchor="middle" font-size="${r*0.5}" font-weight="900" fill="${d.edge}" opacity="0.55">${d.value}</text>
    <ellipse cx="${-r*0.3}" cy="${-r*0.12}" rx="${r*0.28}" ry="${r*0.08}" fill="rgba(255,255,255,0.14)"/>
  </g>`;
}

/** 不规则筹码柱（稍微弯曲，不是完美圆柱） */
function column(cx, baseY, chips, r, denoms) {
  let els = '';
  for (let i = 0; i < chips; i++) {
    const lean = Math.sin(i * 0.4) * 1.5;  // 弱正弦弯曲
    const x = cx + lean;
    const y = baseY - i * 2.8;
    els += chip(x, y, r, lean * 2, denoms[i % denoms.length]);
  }
  return els;
}

/** 散落筹码 */
function scattered(n, r, denoms) {
  let els = '';
  for (let i = 0; i < n; i++) {
    const x = 10 + Math.random() * 180;
    const y = 45 + Math.random() * 55;
    const tilt = (Math.random() - 0.5) * 20;
    els += chip(x, y, r * (0.8 + Math.random() * 0.4), tilt, denoms[i % denoms.length]);
  }
  return els;
}

export function renderChipPile() {
  const chips = getChips();
  const t = tierOf(chips);
  const R = 11 * t.scale;
  const denoms = D.filter(d => d.value <= Math.max(1, chips / 2));
  if (!denoms.length) denoms.push(D[0]);

  // 柱位置
  const colXs = t.cols > 0 ? Array.from({length: t.cols}, (_, i) => 20 + i * (170 / Math.max(1, t.cols - 1))) : [];

  const columnsSVG = colXs.map((cx, i) => column(cx, 90, t.colH, R * 0.9, denoms)).join('');
  const scatteredSVG = scattered(t.scattered, R, denoms);

  const glowEl = t.glow !== 'none' ? `<ellipse cx="100" cy="50" rx="120" ry="50" fill="${t.glow}" filter="url(#blur)"/>` : '';

  return `<svg viewBox="0 0 200 110" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="blur"><feGaussianBlur stdDeviation="12"/></filter>
      <filter id="pileSh"><feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity="0.5"/></filter>
      ${t.min >= 1000 ? `<filter id="shine"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : ''}
      ${t.min >= 5000 ? `<radialGradient id="goldGlow" cx="0.5" cy="0.5" r="0.6"><stop offset="0%" stop-color="rgba(255,200,40,0.3)"/><stop offset="100%" stop-color="rgba(255,200,40,0)"/></radialGradient>` : ''}
    </defs>
    <rect x="0" y="0" width="200" height="110" rx="12" fill="${t.bg}" opacity="0.7"/>
    ${t.min >= 5000 ? `<ellipse cx="100" cy="60" rx="90" ry="35" fill="url(#goldGlow)"/>` : ''}
    ${glowEl}
    <ellipse cx="100" cy="100" rx="85" ry="6" fill="rgba(0,0,0,0.35)"/>
    <g filter="url(#pileSh)">${columnsSVG}${scatteredSVG}</g>
    ${t.min >= 1000 ? `<g filter="url(#shine)">${chip(170, 15, R*1.2, -12, D[3])}${chip(30, 20, R, 8, D[2])}</g>` : ''}
    <text x="100" y="14" text-anchor="middle" font-size="12" font-weight="900" fill="#f0c848" filter="url(#pileSh)">🪙 ${chips}</text>
  </svg>`;
}
