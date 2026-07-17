// svg/icons.js — 精细矢量图标库（替换 emoji：塔罗/星球/幻灵/卡包/优惠券/盲注）
// 所有图标 viewBox 0 0 48 48，原创绘制

const cache = new Map();

function wrap(id, inner, defs = '') {
  if (cache.has(id)) return cache.get(id);
  const svg = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" class="vi vi-${id}">` +
    (defs ? `<defs>${defs}</defs>` : '') + inner + `</svg>`;
  cache.set(id, svg);
  return svg;
}

/** 塔罗牌：紫色秘术之眼 + 星月边饰 */
export function tarotIcon() {
  return wrap('tarot', `
    <rect x="8" y="4" width="32" height="40" rx="4" fill="url(#tg)" stroke="#8a5cc8" stroke-width="1.6"/>
    <rect x="11" y="7" width="26" height="34" rx="2.5" fill="none" stroke="#b48ae8" stroke-width="0.8" opacity="0.6"/>
    <path d="M24 15 Q31 21 24 27 Q17 21 24 15 Z" fill="#e8d4ff" opacity="0.95"/>
    <circle cx="24" cy="21" r="2.6" fill="#4a2080"/>
    <circle cx="24.8" cy="20.2" r="0.9" fill="#e8d4ff"/>
    <path d="M15 33 L16 35.2 L18.4 35.5 L16.7 37.1 L17.1 39.4 L15 38.3 L12.9 39.4 L13.3 37.1 L11.6 35.5 L14 35.2 Z" fill="#d4a843" opacity="0.9"/>
    <path d="M34 32 A4.2 4.2 0 1 0 34 40 A3.4 3.4 0 1 1 34 32 Z" fill="#d4a843" opacity="0.9"/>
    <circle cx="24" cy="10.5" r="1.1" fill="#b48ae8"/>
    <circle cx="24" cy="37.5" r="1.1" fill="#b48ae8"/>`,
    `<linearGradient id="tg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#4a2b78"/><stop offset="1" stop-color="#241040"/>
    </linearGradient>`);
}

/** 星球牌：蓝色行星 + 光环 + 卫星 */
export function planetIcon() {
  return wrap('planet', `
    <circle cx="24" cy="24" r="12.5" fill="url(#pg)"/>
    <path d="M13 20 Q19 23.5 26 21.5 Q33 19.5 35 22" fill="none" stroke="#8ec8f0" stroke-width="2" opacity="0.55" stroke-linecap="round"/>
    <path d="M12.5 27 Q20 30 28 28.2 Q33 27 35.4 28.6" fill="none" stroke="#68a8d8" stroke-width="1.6" opacity="0.45" stroke-linecap="round"/>
    <ellipse cx="24" cy="25.5" rx="19" ry="5.5" fill="none" stroke="url(#rg)" stroke-width="2.2" transform="rotate(-16 24 25.5)"/>
    <circle cx="18.5" cy="18.5" r="3.2" fill="#c8e4f8" opacity="0.35"/>
    <circle cx="39" cy="12" r="1.6" fill="#e8f4fc"/>
    <circle cx="8" cy="35" r="1.1" fill="#a8d0e8" opacity="0.8"/>`,
    `<radialGradient id="pg" cx="0.35" cy="0.3" r="1">
      <stop offset="0" stop-color="#5aa8e0"/><stop offset="1" stop-color="#1a3a68"/>
    </radialGradient>
    <linearGradient id="rg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#d4a843"/><stop offset="0.5" stop-color="#f0d488"/><stop offset="1" stop-color="#a87c28"/>
    </linearGradient>`);
}

/** 幻灵牌：青色幽魂 + 飘散粒子 */
export function spectralIcon() {
  return wrap('spectral', `
    <path d="M24 8 C31.5 8 36 14 36 21 L36 34 Q33.5 31.5 31 34 Q28.5 36.5 26 34 Q23.5 31.5 21 34 Q18.5 36.5 16 34 Q13.5 31.5 12 34 L12 21 C12 14 16.5 8 24 8 Z"
      fill="url(#sg)" stroke="#48c8b0" stroke-width="1.4" stroke-opacity="0.6"/>
    <ellipse cx="19" cy="21" rx="2.6" ry="3.4" fill="#0a2820"/>
    <ellipse cx="29" cy="21" rx="2.6" ry="3.4" fill="#0a2820"/>
    <circle cx="19.8" cy="20" r="0.9" fill="#a8f0e0"/>
    <circle cx="29.8" cy="20" r="0.9" fill="#a8f0e0"/>
    <path d="M20.5 28 Q24 30.5 27.5 28" fill="none" stroke="#0a2820" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
    <circle cx="39" cy="14" r="1.5" fill="#68e0c8" opacity="0.7"/>
    <circle cx="41" cy="22" r="1" fill="#68e0c8" opacity="0.5"/>
    <circle cx="7.5" cy="18" r="1.2" fill="#68e0c8" opacity="0.6"/>
    <circle cx="9" cy="27" r="0.8" fill="#68e0c8" opacity="0.4"/>`,
    `<linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#38b09a" stop-opacity="0.95"/><stop offset="1" stop-color="#0e4438" stop-opacity="0.85"/>
    </linearGradient>`);
}

/** 卡包：金边礼盒 + 缎带 + 高光 */
export function packIcon() {
  return wrap('pack', `
    <rect x="8" y="17" width="32" height="24" rx="3" fill="url(#bg1)" stroke="#8a5820" stroke-width="1.4"/>
    <rect x="6" y="11" width="36" height="9" rx="2.5" fill="url(#bg2)" stroke="#8a5820" stroke-width="1.4"/>
    <rect x="21" y="11" width="6" height="30" fill="url(#rb)"/>
    <path d="M24 11 C20 5 13 5.5 13 9 C13 12 19 11.5 24 11 Z" fill="#e05545" stroke="#a03325" stroke-width="1.2"/>
    <path d="M24 11 C28 5 35 5.5 35 9 C35 12 29 11.5 24 11 Z" fill="#e05545" stroke="#a03325" stroke-width="1.2"/>
    <circle cx="24" cy="11" r="2.8" fill="#f0c060" stroke="#a87c28" stroke-width="1"/>
    <rect x="10" y="19" width="8" height="2.2" rx="1.1" fill="#fff" opacity="0.22"/>`,
    `<linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d89838"/><stop offset="1" stop-color="#9a6420"/>
    </linearGradient>
    <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f0b850"/><stop offset="1" stop-color="#c08430"/>
    </linearGradient>
    <linearGradient id="rb" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#c04030"/><stop offset="0.5" stop-color="#f06858"/><stop offset="1" stop-color="#c04030"/>
    </linearGradient>`);
}

/** 优惠券：齿孔票根 + 星标 */
export function voucherIcon() {
  return wrap('voucher', `
    <path d="M6 14 L42 14 Q40 18 42 21 Q44 24 42 27 Q40 30 42 34 L6 34 Q8 30 6 27 Q4 24 6 21 Q8 18 6 14 Z"
      fill="url(#vg)" stroke="#b8862a" stroke-width="1.5"/>
    <line x1="30" y1="15" x2="30" y2="33" stroke="#8a5820" stroke-width="1.3" stroke-dasharray="2.4 2.2"/>
    <path d="M17 19 L18.6 22.4 L22.3 22.8 L19.6 25.3 L20.3 29 L17 27.2 L13.7 29 L14.4 25.3 L11.7 22.8 L15.4 22.4 Z" fill="#5a3810"/>
    <rect x="33" y="20" width="6" height="2" rx="1" fill="#5a3810" opacity="0.8"/>
    <rect x="33" y="24" width="6" height="2" rx="1" fill="#5a3810" opacity="0.6"/>
    <rect x="8" y="16" width="14" height="1.6" rx="0.8" fill="#fff" opacity="0.28"/>`,
    `<linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f0c868"/><stop offset="1" stop-color="#c89838"/>
    </linearGradient>`);
}

/** 盲注图标：small=蓝筹码 big=金筹码 boss=恶魔骷髅 */
export function blindIcon(type) {
  if (type === 'boss') return wrap('boss', `
    <path d="M24 6 C33 6 39 12.5 39 21 C39 26 36.5 29.5 34 31.5 L34 37 L29.5 37 L29.5 40 L18.5 40 L18.5 37 L14 37 L14 31.5 C11.5 29.5 9 26 9 21 C9 12.5 15 6 24 6 Z"
      fill="url(#bsg)" stroke="#5a1018" stroke-width="1.6"/>
    <path d="M12 10 L17 15 L13.5 16.5 Z" fill="#8a2030"/>
    <path d="M36 10 L31 15 L34.5 16.5 Z" fill="#8a2030"/>
    <ellipse cx="18" cy="21" rx="3.4" ry="4" fill="#1a0508"/>
    <ellipse cx="30" cy="21" rx="3.4" ry="4" fill="#1a0508"/>
    <circle cx="18.8" cy="19.8" r="1.2" fill="#ff5040"/>
    <circle cx="30.8" cy="19.8" r="1.2" fill="#ff5040"/>
    <path d="M21 30 L23 27.5 L25 30 L27 27.5" fill="none" stroke="#1a0508" stroke-width="1.6"/>`,
    `<radialGradient id="bsg" cx="0.5" cy="0.35" r="0.9">
      <stop offset="0" stop-color="#c04858"/><stop offset="1" stop-color="#701825"/>
    </radialGradient>`);
  const gold = type === 'big';
  const id = gold ? 'bigb' : 'smallb';
  const c1 = gold ? '#e8b84a' : '#4a90d9', c2 = gold ? '#a0741e' : '#20558a',
        edge = gold ? '#6a4a10' : '#153a5e', notch = gold ? '#f8dc9a' : '#a8d0f0';
  let notches = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * 45) * Math.PI / 180;
    const x1 = 24 + Math.cos(a) * 13.2, y1 = 24 + Math.sin(a) * 13.2;
    const x2 = 24 + Math.cos(a) * 17.5, y2 = 24 + Math.sin(a) * 17.5;
    notches += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${notch}" stroke-width="3.6" stroke-linecap="round"/>`;
  }
  return wrap(id, `
    <circle cx="24" cy="24" r="18" fill="url(#${id}g)" stroke="${edge}" stroke-width="1.8"/>
    ${notches}
    <circle cx="24" cy="24" r="11" fill="none" stroke="${edge}" stroke-width="1.2" opacity="0.7"/>
    <circle cx="24" cy="24" r="8.5" fill="${c1}" opacity="0.3"/>
    <text x="24" y="29" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" font-family="Georgia,serif">${gold ? 'B' : 'S'}</text>
    <ellipse cx="18" cy="16" rx="5" ry="3" fill="#fff" opacity="0.18" transform="rotate(-30 18 16)"/>`,
    `<radialGradient id="${id}g" cx="0.4" cy="0.35" r="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </radialGradient>`);
}
