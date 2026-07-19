// svg/chip-pile.js — 左下角 3D 筹码堆 v2：赌场散堆（非圆柱，真实堆叠感）
import { getChips } from '../upgrades.js';

// 筹码面额配色（$1白 $5红 $25绿 $100黑 $500紫）
const DENOMS = [
  { color: '#e8e0d0', edge: '#c0b8a0', ring: '#b0a888', value: 1 },
  { color: '#d84030', edge: '#a02820', ring: '#c06050', value: 5 },
  { color: '#38a860', edge: '#207038', ring: '#58c880', value: 25 },
  { color: '#1a1a28', edge: '#0a0a14', ring: '#4a4a60', value: 100 },
  { color: '#6a28a8', edge: '#401868', ring: '#9058c8', value: 500 },
];

const TIERS = [
  { min: 0,    count: 5,  scale: 1.0, label: '起步' },
  { min: 100,  count: 12, scale: 1.1, label: '小有积蓄' },
  { min: 500,  count: 22, scale: 1.2, label: '筹码堆' },
  { min: 1000, count: 35, scale: 1.3, label: '筹码山' },
  { min: 5000, count: 55, scale: 1.4, label: '筹码帝国' },
];

function tierOf(chips) { let t = TIERS[0]; for (const s of TIERS) if (chips >= s.min) t = s; return t; }

/** 根据余额选面额分布 */
function pickDenoms(chips) {
  const out = [];
  const available = DENOMS.filter(d => d.value <= Math.max(1, chips / 3));
  if (!available.length) available.push(DENOMS[0]);
  return available;
}

/** 散堆筹码：每枚随机偏移+旋转，堆成金字塔形 */
function scatterChips(count, scale, denoms) {
  let els = '';
  const R = 12 * scale;  // 筹码半径
  const cx = 50, baseY = 90;

  // 按层次堆：底层宽 → 上层窄
  const rows = Math.ceil(Math.sqrt(count));
  let idx = 0;
  for (let row = 0; row < rows && idx < count; row++) {
    const chipsInRow = Math.min(rows - row + 2, count - idx);
    const rowWidth = chipsInRow * R * 1.6;
    const startX = cx - rowWidth / 2;
    for (let col = 0; col < chipsInRow && idx < count; col++, idx++) {
      const d = denoms[idx % denoms.length];
      // 随机微偏移（模拟自然堆放）
      const jitterX = (Math.random() - 0.5) * R * 0.5;
      const jitterY = (Math.random() - 0.5) * R * 0.3;
      const x = startX + col * R * 1.6 + R + jitterX;
      const y = baseY - row * R * 0.7 + jitterY;
      const tilt = (Math.random() - 0.5) * 15;  // -7.5°~7.5° 微倾

      els += `
        <g transform="translate(${x} ${y}) rotate(${tilt})">
          <ellipse cx="0" cy="3" rx="${R}" ry="${R * 0.45}" fill="${d.edge}" opacity="0.8"/>
          <ellipse cx="0" cy="0" rx="${R}" ry="${R * 0.45}" fill="${d.color}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
          <ellipse cx="0" cy="0" rx="${R * 0.7}" ry="${R * 0.32}" fill="none" stroke="${d.ring}" stroke-width="1.5" stroke-dasharray="3 2"/>
          <text x="0" y="4.5" text-anchor="middle" font-size="${R * 0.55}" font-weight="900" fill="${d.edge}" opacity="0.6">${d.value}</text>
          <ellipse cx="${-R * 0.3}" cy="${-R * 0.12}" rx="${R * 0.3}" ry="${R * 0.1}" fill="rgba(255,255,255,0.15)"/>
        </g>`;
    }
  }
  return els;
}

export function renderChipPile() {
  const chips = getChips();
  const t = tierOf(chips);
  const denoms = pickDenoms(chips);
  const w = Math.max(120, t.count * 6);
  const h = 105;

  const chipsSVG = scatterChips(t.count, t.scale, denoms);

  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="chip-pile-svg">
    <defs>
      <filter id="pileShadow"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000" flood-opacity="0.45"/></filter>
    </defs>
    <!-- 桌面阴影 -->
    <ellipse cx="${w/2}" cy="${h-6}" rx="${w/2 - 10}" ry="6" fill="rgba(0,0,0,0.4)"/>
    <!-- 筹码散堆 -->
    <g filter="url(#pileShadow)">${chipsSVG}</g>
    <!-- 余额标签 -->
    <text x="${w/2}" y="${h - 2}" text-anchor="middle" font-size="11" font-weight="800" fill="rgba(240,192,96,0.8)">🪙 ${chips} · ${t.label}</text>
  </svg>`;
}
