// svg/card-face.js — 52 张牌面 + 牌背 程序化 SVG 生成（原创矢量，无外部素材）
// viewBox 0 0 100 140；花色用 <path> 绘制（不用 Unicode，跨平台一致）
import { SUIT_INFO, RANK_INFO } from '../data/card-data.js';

const COLORS = { red: '#d13b30', black: '#2b2b33' };

/** 花色矢量图形（居中于原点，约 24×24），返回 <g> 字符串 */
function suitShape(suit, x, y, scale, color) {
  const heart = `<path d="M0 12 L-9 2 A5.5 5.5 0 1 1 0 -4 A5.5 5.5 0 1 1 9 2 Z" fill="${color}"/>`;
  let inner;
  switch (suit) {
    case 'hearts': inner = heart; break;
    case 'diamonds':
      inner = `<path d="M0 -12 L8.5 0 L0 12 L-8.5 0 Z" fill="${color}"/>`; break;
    case 'spades':
      inner = `<g><g transform="rotate(180) translate(0 -1)">${heart}</g>` +
              `<path d="M0 3 C1 8 3 10.5 5.5 13 L-5.5 13 C-3 10.5 -1 8 0 3 Z" fill="${color}"/></g>`;
      break;
    case 'clubs':
      inner = `<g><circle cx="0" cy="-6.5" r="5.4" fill="${color}"/>` +
              `<circle cx="-5.6" cy="1.8" r="5.4" fill="${color}"/>` +
              `<circle cx="5.6" cy="1.8" r="5.4" fill="${color}"/>` +
              `<path d="M0 1 C1 7 3 10.5 5.5 13 L-5.5 13 C-3 10.5 -1 7 0 1 Z" fill="${color}"/></g>`;
      break;
  }
  return `<g transform="translate(${x} ${y}) scale(${scale})">${inner}</g>`;
}

// 2-10 点阵布局：列 L=33 C=50 R=67；上下半区 y>70 的点倒转
const PIPS = {
  '2':  [[50, 36], [50, 104]],
  '3':  [[50, 36], [50, 70], [50, 104]],
  '4':  [[33, 36], [67, 36], [33, 104], [67, 104]],
  '5':  [[33, 36], [67, 36], [50, 70], [33, 104], [67, 104]],
  '6':  [[33, 36], [67, 36], [33, 70], [67, 70], [33, 104], [67, 104]],
  '7':  [[33, 36], [67, 36], [50, 52], [33, 70], [67, 70], [33, 104], [67, 104]],
  '8':  [[33, 36], [67, 36], [50, 52], [33, 70], [67, 70], [50, 88], [33, 104], [67, 104]],
  '9':  [[33, 36], [67, 36], [33, 58], [67, 58], [50, 70], [33, 82], [67, 82], [33, 104], [67, 104]],
  '10': [[33, 36], [67, 36], [50, 47], [33, 58], [67, 58], [33, 82], [67, 82], [50, 93], [33, 104], [67, 104]],
};

/** 人物牌原创图案（抽象纹章风格） */
function faceArt(rank, color) {
  const frame = `<rect x="24" y="30" width="52" height="80" rx="6" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.35"/>` +
    `<text x="50" y="86" text-anchor="middle" font-size="44" font-weight="900" fill="${color}" opacity="0.14" font-family="Georgia,serif">${rank}</text>`;
  const crown = `<path d="M-16 8 L-16 -3 L-8 3 L0 -9 L8 3 L16 -3 L16 8 Z" fill="${color}"/>` +
    `<rect x="-16" y="8" width="32" height="4" rx="1.5" fill="${color}" opacity="0.75"/>`;
  let motif;
  if (rank === 'J') {
    // 侍从：军刀 + 羽饰
    motif = `<g transform="translate(50 62)">` +
      `<rect x="-2.4" y="-22" width="4.8" height="34" rx="2" fill="${color}" transform="rotate(35)"/>` +
      `<rect x="-11" y="-3" width="22" height="4" rx="2" fill="${color}" transform="rotate(35)"/>` +
      `<circle cx="0" cy="18" r="4.5" fill="${color}" opacity="0.8"/></g>`;
  } else if (rank === 'Q') {
    // 女王：王冠 + 明珠
    motif = `<g transform="translate(50 58)">${crown}` +
      `<circle cx="0" cy="22" r="6" fill="none" stroke="${color}" stroke-width="2.5"/>` +
      `<circle cx="0" cy="22" r="2" fill="${color}"/></g>`;
  } else {
    // 国王：王冠 + 权杖十字
    motif = `<g transform="translate(50 58)">${crown}` +
      `<rect x="-1.8" y="14" width="3.6" height="18" rx="1.5" fill="${color}"/>` +
      `<rect x="-7" y="19" width="14" height="3.4" rx="1.5" fill="${color}"/></g>`;
  }
  return frame + motif;
}

/** 角标（左上 + 右下倒置） */
function corners(rank, suit, color) {
  const w = rank === '10' ? 15 : 11;
  const one = (flip) =>
    `<g transform="${flip ? 'translate(100 140) rotate(180)' : ''}">` +
    `<text x="${6 + w / 2}" y="19" text-anchor="middle" font-size="17" font-weight="800" fill="${color}" font-family="'Segoe UI',sans-serif">${rank}</text>` +
    suitShape(suit, 6 + w / 2, 30, 0.5, color) + `</g>`;
  return one(false) + one(true);
}

const faceCache = new Map();

/** 牌面正面 SVG。石头牌渲染专用面。 */
export function cardFaceSVG(card) {
  if (card.enhancement === 'stone') return stoneFaceSVG();
  const key = `${card.suit}-${card.rank}`;
  if (faceCache.has(key)) return faceCache.get(key);

  const color = COLORS[SUIT_INFO[card.suit].color];
  let body;
  if (RANK_INFO[card.rank].face) {
    body = faceArt(card.rank, color);
  } else if (card.rank === 'A') {
    body = suitShape(card.suit, 50, 70, 1.9, color);
  } else {
    body = PIPS[card.rank].map(([x, y]) =>
      suitShape(card.suit, x, y, 0.72, color) // 下半区倒置
        .replace('scale(0.72)', y > 70 ? 'scale(0.72) rotate(180)' : 'scale(0.72)')
    ).join('');
  }

  const svg =
    `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="1" y="1" width="98" height="138" rx="9" fill="#f5f1e6"/>` +
    `<rect x="1" y="1" width="98" height="138" rx="9" fill="none" stroke="#c9c0ab" stroke-width="2"/>` +
    corners(card.rank, card.suit, color) + body + `</svg>`;
  faceCache.set(key, svg);
  return svg;
}

/** 石头牌面 */
function stoneFaceSVG() {
  if (faceCache.has('__stone')) return faceCache.get('__stone');
  const svg =
    `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="1" y="1" width="98" height="138" rx="9" fill="#6e6e78"/>` +
    `<rect x="1" y="1" width="98" height="138" rx="9" fill="none" stroke="#4c4c55" stroke-width="3"/>` +
    `<ellipse cx="50" cy="70" rx="26" ry="22" fill="#8a8a94"/>` +
    `<ellipse cx="43" cy="62" rx="8" ry="6" fill="#a0a0aa" opacity="0.8"/>` +
    `<text x="50" y="122" text-anchor="middle" font-size="13" font-weight="700" fill="#d9d9e0">+50</text></svg>`;
  faceCache.set('__stone', svg);
  return svg;
}

/** 牌背（背面朝上/牌堆） */
export function cardBackSVG() {
  if (faceCache.has('__back')) return faceCache.get('__back');
  let lattice = '';
  for (let x = 10; x <= 90; x += 16) {
    for (let y = 12; y <= 128; y += 16) {
      lattice += `<path d="M${x} ${y - 5} L${x + 5} ${y} L${x} ${y + 5} L${x - 5} ${y} Z" fill="#3d5a96" opacity="0.55"/>`;
    }
  }
  const svg =
    `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="1" y="1" width="98" height="138" rx="9" fill="#22335c"/>` +
    lattice +
    `<rect x="6" y="6" width="88" height="128" rx="6" fill="none" stroke="#d4a843" stroke-width="2" opacity="0.7"/>` +
    `<circle cx="50" cy="70" r="15" fill="#22335c" stroke="#d4a843" stroke-width="2"/>` +
    `<text x="50" y="77" text-anchor="middle" font-size="18" fill="#d4a843">♛</text></svg>`;
  faceCache.set('__back', svg);
  return svg;
}
