// ui/hand-panel.js — 牌型等级面板（可开合）：12 手型的等级/基础值/已打次数
import { G } from '../state.js';
import { HAND_TYPES } from '../data/card-data.js';

let open = false;

export function initHandPanel() {
  document.getElementById('btn-hand-panel').addEventListener('click', toggle);
  document.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); toggle(); } });
}

function toggle() {
  open = !open;
  let panel = document.getElementById('hand-panel');
  if (!open) { panel?.remove(); return; }
  panel = document.createElement('div');
  panel.id = 'hand-panel';
  const rows = HAND_TYPES.map(h => {
    const lv = G.handLevels[h.id] ?? 1;
    const chips = h.chips + h.lvChips * (lv - 1);
    const mult = h.mult + h.lvMult * (lv - 1);
    const played = G.handPlayed[h.id] ?? 0;
    const locked = h.secret && played === 0;
    return `<div class="hp-row ${locked ? 'locked' : ''}">
      <span class="hp-lv">Lv.${lv}</span>
      <span class="hp-name">${locked ? '？？？' : h.zh}</span>
      <span class="hp-val"><b class="hp-chips">${chips}</b> × <b class="hp-mult">${mult}</b></span>
      <span class="hp-played"># ${played}</span>
    </div>`;
  }).join('');
  panel.innerHTML = `<h3>牌型等级 <span class="hp-tip">Tab 开合</span></h3>${rows}`;
  document.body.appendChild(panel);
}

/** 面板打开时同步刷新 */
export function refreshHandPanel() {
  if (open) { open = false; toggle(); }
}
