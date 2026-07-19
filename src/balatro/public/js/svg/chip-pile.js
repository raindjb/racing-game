// svg/chip-pile.js — 左下角 3D 筹码堆（5 档位，高度/颜色随筹码数变化）
import { getChips } from '../upgrades.js';

const TIERS = [
  { min: 0,    w: 80,  h: 50,  chips: 4,  color: '#8a7860', label: '起步' },
  { min: 100,  w: 110, h: 70,  chips: 8,  color: '#a09070', label: '小有积蓄' },
  { min: 500,  w: 140, h: 90,  chips: 14, color: '#c0a860', label: '筹码堆' },
  { min: 1000, w: 170, h: 110, chips: 22, color: '#d4b040', label: '筹码山' },
  { min: 5000, w: 200, h: 140, chips: 34, color: '#f0c030', label: '筹码帝国' },
];

function tierOf(chips) {
  let t = TIERS[0];
  for (const s of TIERS) if (chips >= s.min) t = s;
  return t;
}

export function renderChipPile() {
  const chips = getChips();
  const t = tierOf(chips);
  const cx = 40, cy = t.h - 10;

  // 生成堆叠筹码
  let chipEls = '';
  for (let i = 0; i < t.chips; i++) {
    const yOff = -i * 3.5;  // 每枚筹码叠高 3.5px
    const rx = t.w / 2 - 4;
    const ry = 8;
    const hueShift = i * 2;
    const col = `hsl(${38 + hueShift}, 60%, ${55 - i * 1.2}%)`;
    const edge = `hsl(${38 + hueShift}, 50%, ${35 - i * 1}%)`;

    chipEls += `
      <!-- 筹码侧面（厚度） -->
      <ellipse cx="${cx}" cy="${cy + yOff + 3}" rx="${rx}" ry="${ry}" fill="${edge}"/>
      <!-- 筹码顶面 -->
      <ellipse cx="${cx}" cy="${cy + yOff}" rx="${rx}" ry="${ry}" fill="${col}" stroke="rgba(255,255,255,0.15)" stroke-width="1.2"/>
      <!-- 内圈 -->
      <ellipse cx="${cx}" cy="${cy + yOff}" rx="${rx * 0.7}" ry="${ry * 0.7}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-dasharray="4 2"/>
      <!-- 高光 -->
      <ellipse cx="${cx - rx * 0.3}" cy="${cy + yOff - ry * 0.4}" rx="${rx * 0.35}" ry="${ry * 0.25}" fill="rgba(255,255,255,0.2)"/>
    `;
  }

  // 底座阴影
  const shadowEl = `<ellipse cx="${cx}" cy="${cy + 6}" rx="${t.w / 2 + 6}" ry="10" fill="rgba(0,0,0,0.3)"/>`;

  return `<svg viewBox="0 0 ${t.w + 20} ${t.h + 25}" xmlns="http://www.w3.org/2000/svg" class="chip-pile-svg">
    <defs>
      <filter id="pileGlow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    ${shadowEl}
    ${chipEls}
    <!-- 金额 -->
    <text x="${cx}" y="${cy - 20}" text-anchor="middle" font-size="16" font-weight="900" fill="#f0c060" filter="url(#pileGlow)">
      🪙 ${chips}
    </text>
    <text x="${cx}" y="${t.h + 16}" text-anchor="middle" font-size="9" fill="rgba(200,200,180,0.5)">${t.label}</text>
  </svg>`;
}
