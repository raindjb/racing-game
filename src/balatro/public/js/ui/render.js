// ui/render.js — 主渲染器：差异更新，订阅引擎事件；含基础浮层（盲注选择/结算/商店占位/结束）
import { G, PHASES, bus, selectedCards } from '../state.js';
import * as round from '../round.js';
import { evalHand } from '../hand-eval.js';
import { HAND_TYPE_MAP } from '../data/card-data.js';
import { BLINDS } from '../data/blinds.js';
import { blindTarget } from '../data/blinds.js';
import { cardEl, releaseCard } from './card-dom.js';
import { layoutHand, withFlip } from './hand-layout.js';
import { consumeSuppressedClick } from './drag.js';

const $ = id => document.getElementById(id);
let els = {};

/** 出牌（按钮/键盘共用）：非阻塞结算 + 动画后落地 */
export function playAction() {
  if (round.playSelected({ instant: false })) scheduleResolve();
}

export function initRender() {
  els = {
    hand: $('hand-area'), played: $('played-zone'), overlay: $('overlay-root'),
    play: $('btn-play'), discard: $('btn-discard'),
  };

  // 手牌点击选牌（事件委托；拖拽结束的 click 被吞掉）
  els.hand.addEventListener('click', e => {
    if (consumeSuppressedClick()) return;
    const cardDiv = e.target.closest('.card');
    if (cardDiv) round.toggleSelect(Number(cardDiv.dataset.cid));
  });
  els.play.addEventListener('click', playAction);
  els.discard.addEventListener('click', () => round.discardSelected());
  $('btn-sort-rank').addEventListener('click', () => round.sortHand('rank'));
  $('btn-sort-suit').addEventListener('click', () => round.sortHand('suit'));

  // 引擎事件
  bus.on('phase', onPhase);
  bus.on('select:change', () => { syncSelection(); syncPreview(); syncButtons(); });
  bus.on('hand:sorted', () => syncHand(true));
  bus.on('hand:reordered', () => {});   // 拖拽已实时布局，无需重排
  bus.on('hand:discarded', () => { syncHand(true); syncSidebar(); syncButtons(); });
  bus.on('hand:resolved', () => { syncPlayed(); syncHand(true); syncSidebar(); syncButtons(); });
  bus.on('hand:played', onHandPlayed);
  bus.on('boss:hook', () => syncHand(true));
  bus.on('cards:destroyed', ({ cards }) => cards.forEach(c => releaseCard(c.id)));
  bus.on('ui:reject', ({ reason }) => flashMessage(reason));

  window.addEventListener('resize', () => syncHand(false));
}

function onPhase({ phase }) {
  switch (phase) {
    case PHASES.BLIND_SELECT: showBlindSelect(); break;
    case PHASES.PLAYING: hideOverlay(); syncAll(); break;
    case PHASES.ROUND_END: showRoundEnd(); break;
    case PHASES.SHOP: showShopPlaceholder(); break;   // Task 08 接管
    case PHASES.GAME_OVER: showGameEnd(false); break;
    case PHASES.WIN: showGameEnd(true); break;
  }
}

// ===== 主区域同步 =====

export function syncAll() {
  syncHand(false); syncPlayed(); syncSidebar(); syncSelection(); syncPreview(); syncButtons();
}

function syncHand(flip) {
  const apply = () => {
    // 协调子节点顺序与 G.hand 一致（appendChild 移动既有节点，不重建）
    for (const card of G.hand) els.hand.appendChild(cardEl(card));
    for (const el of [...els.hand.children]) {
      if (!G.hand.some(c => c.id === Number(el.dataset.cid))) el.remove();
    }
    layoutHand(els.hand, G.hand, new Set(G.selected));
  };
  flip ? withFlip(els.hand, apply) : apply();
  syncDeckBadge();
}

function syncPlayed() {
  els.played.innerHTML = '';
  for (const card of G.playedZone) {
    const el = cardEl(card);
    el.classList.add('static');
    el.classList.remove('selected');
    el.style.removeProperty('--tx'); el.style.removeProperty('--ty'); el.style.removeProperty('--rot');
    els.played.appendChild(el);
  }
}

function syncSelection() {
  for (const el of els.hand.children) {
    el.classList.toggle('selected', G.selected.includes(Number(el.dataset.cid)));
  }
  layoutHand(els.hand, G.hand, new Set(G.selected));
}

/** 选牌实时预览：手型名 + 基础 筹码×倍率（含等级） */
function syncPreview() {
  const sel = selectedCards();
  if (!sel.length) {
    $('hand-type-label').textContent = '—';
    $('calc-chips').textContent = '0'; $('calc-mult').textContent = '0';
    return;
  }
  const ev = evalHand(sel);
  const ht = HAND_TYPE_MAP[ev.handType];
  const lv = G.handLevels[ev.handType] ?? 1;
  $('hand-type-label').textContent = `${ev.zh} Lv.${lv}`;
  $('calc-chips').textContent = ht.chips + ht.lvChips * (lv - 1);
  $('calc-mult').textContent = ht.mult + ht.lvMult * (lv - 1);
}

function syncSidebar() {
  $('ante-num').innerHTML = `${G.ante}<span class="dim">/8</span>`;
  $('round-num').textContent = G.round;
  $('round-score').textContent = G.roundScore.toLocaleString();
  $('hands-left').textContent = G.handsLeft;
  $('discards-left').textContent = G.discardsLeft;
  $('money').textContent = `$${G.money}`;
  $('target-score').textContent = G.target.toLocaleString();

  const b = BLINDS[G.blindIndex];
  $('blind-name').textContent = G.blindIndex === 2 && G.boss ? G.boss.zh : b.zh;
  $('blind-reward').textContent = `$${b.reward}`;
  const icon = $('blind-icon');
  icon.className = ['small', 'big', 'boss'][G.blindIndex] ?? 'small';
  icon.textContent = G.blindIndex === 2 ? '☠' : b.icon;
}

function syncDeckBadge() {
  $('deck-count').textContent = G.deck.length;
}

function syncButtons() {
  const playing = G.phase === PHASES.PLAYING;
  els.play.disabled = !playing || G.selected.length === 0 || G.handsLeft <= 0;
  els.discard.disabled = !playing || G.selected.length === 0 || G.discardsLeft <= 0;
}

// ===== 结算表现（Task 10 升级为逐步跳分） =====

function onHandPlayed({ result, eval: ev }) {
  syncHand(true); syncPlayed(); syncSidebar(); syncButtons();
  $('hand-type-label').textContent = ev.zh;
  $('calc-chips').textContent = result.chips;
  $('calc-mult').textContent = result.mult;
  const pop = $('score-pop');
  pop.textContent = `+${result.score.toLocaleString()}`;
  pop.classList.add('on');
}

let resolveTimer = null;
function scheduleResolve() {
  clearTimeout(resolveTimer);
  resolveTimer = setTimeout(() => {
    $('score-pop').classList.remove('on');
    round.resolveAfterScoring();
  }, 1100);
}

function flashMessage(text) {
  const el = document.createElement('div');
  el.className = 'flash-msg';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

// ===== 浮层 =====

function showOverlay(html) {
  els.overlay.innerHTML = `<div class="overlay-backdrop">${html}</div>`;
}
function hideOverlay() { els.overlay.innerHTML = ''; }

function showBlindSelect() {
  const boss = G.upcomingBoss;
  const cardsHtml = BLINDS.map((b, i) => {
    const target = blindTarget(G.ante, i, i === 2 ? boss : null).toLocaleString();
    const cur = i === G.blindIndex ? 'current' : (i < G.blindIndex ? 'done' : '');
    return `<div class="blind-card ${cur}">
      <div class="bc-icon ${['small', 'big', 'boss'][i]}">${i === 2 ? '☠' : b.icon}</div>
      <div class="bc-name">${i === 2 && boss ? boss.zh : b.zh}</div>
      <div class="bc-target">至少 ${target}</div>
      <div class="bc-reward">奖励 $${b.reward}</div>
      ${i === 2 && boss ? `<div class="bc-boss-desc">⚠ ${boss.desc}</div>` : ''}
    </div>`;
  }).join('');
  showOverlay(`
    <div class="panel blind-select">
      <h1>🃏 小丑牌</h1>
      <div class="panel-sub">ANTE ${G.ante} / 8 · 种子 ${G.seed}</div>
      <div class="blind-cards">${cardsHtml}</div>
      <div class="panel-actions">
        <button class="btn btn-play" id="ov-start">${G.blindIndex === 2 ? '挑战 Boss' : '开始盲注'}</button>
        ${G.blindIndex < 2 ? '<button class="btn btn-ghost" id="ov-skip">跳过盲注</button>' : ''}
      </div>
    </div>`);
  $('ov-start').addEventListener('click', () => round.startBlind());
  $('ov-skip')?.addEventListener('click', () => round.skipBlind());
}

function showRoundEnd() {
  const c = G.lastCashout;
  const row = (label, v) => v ? `<div class="cash-row"><span>${label}</span><b>+$${v}</b></div>` : '';
  showOverlay(`
    <div class="panel round-end">
      <h2>盲注通过!</h2>
      ${row('盲注奖励', c.reward)}${row('利息', c.interest)}${row('剩余出牌', c.handsBonus)}
      ${row('小丑牌', c.jokerMoney)}${row('黄金牌', c.goldCards)}
      <div class="cash-total">共 +$${c.total}</div>
      <button class="btn btn-shop-go" id="ov-shop">进入商店</button>
    </div>`);
  $('ov-shop').addEventListener('click', () => round.leaveRoundEnd());
}

function showShopPlaceholder() {
  // Task 08 用完整商店渲染替换本函数
  showOverlay(`
    <div class="panel shop-panel">
      <h2>🏪 商店</h2>
      <div class="panel-sub">建设中（Task 08）· 资金 $${G.money}</div>
      <button class="btn btn-play" id="ov-next">继续 → 下一盲注</button>
    </div>`);
  $('ov-next').addEventListener('click', () => round.leaveShop());
}

function showGameEnd(won) {
  showOverlay(`
    <div class="panel game-end ${won ? 'win' : 'lose'}">
      <h1>${won ? '🏆 通关!' : '游戏结束'}</h1>
      <div class="panel-sub">
        到达 ANTE ${Math.min(G.ante, 8)} · 回合 ${G.round} · 最佳一手 ${G.stats.bestHandScore.toLocaleString()} · $${G.money}
      </div>
      <button class="btn btn-play" id="ov-restart">再来一局</button>
    </div>`);
  $('ov-restart').addEventListener('click', () => round.startRun({}));
}
