// svg/chip-pile.js v4 — 超高密度筹码海（<use> 批量渲染 200+ 枚）
import { getChips } from '../upgrades.js';

const D = [
  { color: '#f0e4d0', edge: '#c0a880', ring: '#a89878', value: 1 },
  { color: '#f05040', edge: '#b02018', ring: '#e06858', value: 5 },
  { color: '#28b858', edge: '#107030', ring: '#58d080', value: 25 },
  { color: '#181828', edge: '#080810', ring: '#505068', value: 100 },
  { color: '#7838c0', edge: '#481870', ring: '#a868e8', value: 500 },
];

const TIERS = [
  { min: 0,    scat: 20, cols: 0, ch: 0,  scale: 1.0, bg: '#1a1a18', glow: 'none',        label: '起步' },
  { min: 100,  scat: 40, cols: 3, ch: 6,  scale: 1.05,bg: '#1a1818', glow: 'rgba(200,160,50,0.10)', label: '小有积蓄' },
  { min: 500,  scat: 55, cols: 4, ch: 10, scale: 1.1, bg: '#181818', glow: 'rgba(220,170,50,0.18)', label: '筹码堆' },
  { min: 1000, scat: 70, cols: 5, ch: 14, scale: 1.2, bg: '#181a18', glow: 'rgba(240,190,40,0.28)', label: '筹码山' },
  { min: 5000, scat: 90, cols: 6, ch: 18, scale: 1.3, bg: '#1a1818', glow: 'rgba(255,200,40,0.38)', label: '筹码帝国' },
];

function tOf(c) { let t = TIERS[0]; for (const s of TIERS) if (c >= s.min) t = s; return t; }

export function renderChipPile() {
  const chips = getChips();
  const t = tOf(chips);
  const R = 10 * t.scale;
  const denoms = D.filter(d => d.value <= Math.max(1, chips / 3));
  if (!denoms.length) denoms.push(D[0]);

  // 批量生成弯柱（正弦偏移，绝不完美）
  let colsSVG = '';
  const colXs = t.cols > 0 ? Array.from({length: t.cols}, (_, i) => 18 + i * (164 / Math.max(1, t.cols - 1))) : [];
  for (let ci = 0; ci < colXs.length; ci++) {
    const cx = colXs[ci];
    const h = t.ch + ci % 3;  // 柱高微差
    for (let i = 0; i < h; i++) {
      const lean = Math.sin(i * 0.5 + ci) * 2.2;  // 每柱不同相位
      const lean2 = Math.cos(i * 0.35 + ci) * 1.2;
      const x = cx + lean;
      const y = 92 - i * 2.6 + lean2;
      const tilt = lean * 1.8;
      colsSVG += `<use href="#chip" x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${tilt.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" data-color="${ci % denoms.length}"/>`;
    }
  }

  // 散落筹码（密度翻倍）
  let scatSVG = '';
  for (let i = 0; i < t.scat; i++) {
    const sx = 6 + Math.random() * 188;
    const sy = 48 + Math.random() * 50;
    const st = (Math.random() - 0.5) * 24;
    const sr = R * (0.7 + Math.random() * 0.5);
    scatSVG += `<use href="#chip" x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" transform="rotate(${st.toFixed(1)} ${sx.toFixed(1)} ${sy.toFixed(1)}) scale(${sr/R})" data-color="${i % denoms.length}"/>`;
  }

  // 坍塌堆（边缘散落的高密度区）
  let collapseSVG = '';
  for (let i = 0; i < Math.floor(t.scat * 0.6); i++) {
    const cx = 30 + (i % 5) * 28 + Math.random() * 8;
    const cy = 65 + Math.floor(i / 5) * 1.6 + Math.random() * 3;
    collapseSVG += `<use href="#chip" x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" transform="rotate(${(Math.random()-0.5)*30} ${cx.toFixed(1)} ${cy.toFixed(1)})" data-color="${(i+2) % denoms.length}"/>`;
  }

  // 高光闪烁点
  const sparkles = t.min >= 500 ? Array.from({length: 8}, (_, i) => {
    const sx = 20 + Math.random() * 160, sy = 15 + Math.random() * 70;
    return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${0.8+Math.random()*1.5}" fill="#fff" opacity="${0.4+Math.random()*0.5}"><animate attributeName="opacity" values="0.2;0.8;0.2" dur="${1.5+Math.random()*2}s" repeatCount="indefinite"/></circle>`;
  }).join('') : '';

  // 金光晕
  const glowEl = t.glow !== 'none' ? `<ellipse cx="100" cy="55" rx="110" ry="45" fill="${t.glow}" filter="url(#blur)"/>` : '';

  return `<svg viewBox="0 0 200 110" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="blur"><feGaussianBlur stdDeviation="14"/></filter>
      <filter id="pileSh"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000" flood-opacity="0.5"/></filter>
      ${t.min >= 1000 ? `<filter id="shine"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : ''}
      ${t.min >= 5000 ? `<radialGradient id="gG"><stop offset="0%" stop-color="rgba(255,200,40,0.35)"/><stop offset="100%" stop-color="rgba(255,200,40,0)"/></radialGradient>` : ''}
      <!-- 5 枚筹码模板（超饱合色） -->
      <g id="chip"><ellipse cx="0" cy="2.5" rx="10" ry="4.5" fill="${D[0].edge}"/><ellipse cx="0" cy="0" rx="10" ry="4.5" fill="${D[0].color}" stroke="rgba(255,255,255,0.2)" stroke-width="0.8"/><ellipse cx="0" cy="0" rx="6.8" ry="3" fill="none" stroke="${D[0].ring}" stroke-width="1.2" stroke-dasharray="3 2"/><text x="0" y="3.5" text-anchor="middle" font-size="5" font-weight="900" fill="${D[0].edge}" opacity="0.5">1</text><ellipse cx="-3" cy="-1.2" rx="2.8" ry="0.8" fill="rgba(255,255,255,0.15)"/></g>
      <g id="chip1"><ellipse cx="0" cy="2.5" rx="10" ry="4.5" fill="${D[1].edge}"/><ellipse cx="0" cy="0" rx="10" ry="4.5" fill="${D[1].color}" stroke="rgba(255,255,255,0.2)" stroke-width="0.8"/><ellipse cx="0" cy="0" rx="6.8" ry="3" fill="none" stroke="${D[1].ring}" stroke-width="1.2" stroke-dasharray="3 2"/><text x="0" y="3.5" text-anchor="middle" font-size="5" font-weight="900" fill="${D[1].edge}" opacity="0.5">5</text><ellipse cx="-3" cy="-1.2" rx="2.8" ry="0.8" fill="rgba(255,255,255,0.15)"/></g>
      <g id="chip2"><ellipse cx="0" cy="2.5" rx="10" ry="4.5" fill="${D[2].edge}"/><ellipse cx="0" cy="0" rx="10" ry="4.5" fill="${D[2].color}" stroke="rgba(255,255,255,0.2)" stroke-width="0.8"/><ellipse cx="0" cy="0" rx="6.8" ry="3" fill="none" stroke="${D[2].ring}" stroke-width="1.2" stroke-dasharray="3 2"/><text x="0" y="3.5" text-anchor="middle" font-size="4.5" font-weight="900" fill="${D[2].edge}" opacity="0.5">25</text><ellipse cx="-3" cy="-1.2" rx="2.8" ry="0.8" fill="rgba(255,255,255,0.15)"/></g>
      <g id="chip3"><ellipse cx="0" cy="2.5" rx="10" ry="4.5" fill="${D[3].edge}"/><ellipse cx="0" cy="0" rx="10" ry="4.5" fill="${D[3].color}" stroke="rgba(255,255,255,0.25)" stroke-width="0.8"/><ellipse cx="0" cy="0" rx="6.8" ry="3" fill="none" stroke="${D[3].ring}" stroke-width="1.2" stroke-dasharray="3 2"/><text x="0" y="3.5" text-anchor="middle" font-size="4.2" font-weight="900" fill="#888" opacity="0.5">100</text><ellipse cx="-3" cy="-1.2" rx="2.8" ry="0.8" fill="rgba(255,255,255,0.18)"/></g>
      <g id="chip4"><ellipse cx="0" cy="2.5" rx="10" ry="4.5" fill="${D[4].edge}"/><ellipse cx="0" cy="0" rx="10" ry="4.5" fill="${D[4].color}" stroke="rgba(255,255,255,0.25)" stroke-width="0.8"/><ellipse cx="0" cy="0" rx="6.8" ry="3" fill="none" stroke="${D[4].ring}" stroke-width="1.2" stroke-dasharray="3 2"/><text x="0" y="3.5" text-anchor="middle" font-size="4" font-weight="900" fill="#c8a0e8" opacity="0.5">500</text><ellipse cx="-3" cy="-1.2" rx="2.8" ry="0.8" fill="rgba(255,255,255,0.18)"/></g>
    </defs>
    <rect x="0" y="0" width="200" height="110" rx="12" fill="${t.bg}" opacity="0.75"/>
    ${t.min >= 5000 ? `<ellipse cx="100" cy="55" rx="95" ry="45" fill="url(#gG)"/>` : ''}
    ${glowEl}
    <ellipse cx="100" cy="98" rx="90" ry="5" fill="rgba(0,0,0,0.4)"/>
    <g filter="url(#pileSh)">
      <!-- 先坍塌堆（底层）→ 散落（中层）→ 柱（顶层）-->
      ${collapseSVG}
      ${scatSVG}
      ${colsSVG}
    </g>
    ${t.min >= 1000 ? `<g filter="url(#shine)"><use href="#chip3" x="172" y="12" transform="rotate(-14 172 12) scale(1.3)"/><use href="#chip2" x="24" y="18" transform="rotate(9 24 18)"/></g>` : ''}
    ${sparkles}
    <text x="100" y="14" text-anchor="middle" font-size="13" font-weight="900" fill="#f0c848" filter="url(#pileSh)">🪙 ${chips} · ${t.label}</text>
  </svg>`;
}
