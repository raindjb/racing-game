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
import { jokerSlotsOf, sellJoker, sellValue } from '../joker-manager.js';
import { jokerArtSVG } from '../svg/joker-art.js';
import { cardFaceSVG } from '../svg/card-face.js';
import { useConsumable, sellConsumable, consumableSlotsOf } from '../consumable-manager.js';
import * as shop from '../shop.js';
import { JOKER_MAP } from '../data/jokers.js';
import { TAROT_MAP } from '../data/tarots.js';
import { PLANET_MAP } from '../data/planets.js';
import { SPECTRAL_MAP } from '../data/spectrals.js';
import { VOUCHER_MAP } from '../data/vouchers.js';
import { tarotIcon, planetIcon, spectralIcon, packIcon, voucherIcon, blindIcon } from '../svg/icons.js';
import { playScoreAnimation } from './score-popup.js';
import { loadSave, fetchStats } from '../save-client.js';

const $ = id => document.getElementById(id);
let els = {};

/** 出牌（按钮/键盘共用）：结算动画由 hand:played 事件驱动 */
export function playAction() {
  round.playSelected({ instant: false });
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
  $('btn-guide')?.addEventListener('click', showGuide);

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
  bus.on('jokers:change', () => { syncJokers(); syncSidebar(); });
  bus.on('consumables:change', () => { syncConsumables(); syncSidebar(); });
  bus.on('consumable:used', ({ msg }) => { flashMessage(msg); syncAll(); });
  bus.on('shop:stock', () => { if (G.phase === PHASES.SHOP) showShop(); });
  bus.on('booster:change', () => { if (G.phase === PHASES.BOOSTER) showBooster(); });
  bus.on("tag:gained", ({ zh, times }) => flashMessage(`获得标签「${zh}」${times > 1 ? " ×2!" : ""}`));

  window.addEventListener('resize', () => syncHand(false));
}

function onPhase({ phase }) {
  switch (phase) {
    case PHASES.MENU: showMainMenu(); break;
    case PHASES.BLIND_SELECT: showBlindSelect(); break;
    case PHASES.PLAYING: hideOverlay(); syncAll(); break;
    case PHASES.ROUND_END: showRoundEnd(); break;
    case PHASES.SHOP: showShop(); break;
    case PHASES.BOOSTER: showBooster(); break;
    case PHASES.GAME_OVER: showGameEnd(false); break;
    case PHASES.WIN: showGameEnd(true); break;
  }
}

// ===== 主区域同步 =====

export function syncAll() {
  syncHand(false); syncPlayed(); syncSidebar(); syncSelection(); syncPreview(); syncButtons();
  syncJokers(); syncConsumables();
}

/** 消耗牌行：点击使用（回合中）、右键出售 $1 */
function syncConsumables() {
  const row = $('consumable-row');
  row.innerHTML = '';
  const slots = consumableSlotsOf(G);
  for (let i = 0; i < slots; i++) {
    const c = G.consumables[i];
    if (!c) {
      const s = document.createElement('div');
      s.className = 'j-slot'; s.textContent = '◇';
      row.appendChild(s);
      continue;
    }
    const el = document.createElement('div');
    el.className = `j-card c-card c-${c.kind}`;
    const kindIcon = { tarot: tarotIcon, planet: planetIcon, spectral: spectralIcon }[c.kind] ?? tarotIcon;
    el.innerHTML =
      `<div class="c-icon">${kindIcon()}</div>` +
      `<div class="j-name">${c.zh}</div><div class="j-desc">${c.desc}</div>` +
      `<div class="sell-tip">点击使用 · 右键卖 $1</div>`;
    el.title = `${c.zh}：${c.desc}`;
    el.addEventListener('click', () => {
      const r = useConsumable(c.uid);
      if (!r.ok) flashMessage(r.msg);
    });
    el.addEventListener('contextmenu', e => { e.preventDefault(); sellConsumable(c.uid); });
    row.appendChild(el);
  }
}

/** Joker 行：实例卡 + 空槽；右键出售 */
const GROWING = new Set(['green_joker', 'ride_the_bus', 'loyalty_card']);
function syncJokers() {
  const row = $('joker-row');
  row.innerHTML = '';
  const slots = jokerSlotsOf(G);
  for (let i = 0; i < slots; i++) {
    const j = G.jokers[i];
    if (!j) {
      const s = document.createElement('div');
      s.className = 'j-slot'; s.textContent = '+';
      row.appendChild(s);
      continue;
    }
    const el = document.createElement('div');
    el.className = `j-card rarity-${j.rarity}`;
    if (j.edition) el.classList.add(`ed-${j.edition}`);
    el.dataset.juid = j.uid;
    el.innerHTML = jokerArtSVG(j.art, j.id) +
      `<div class="j-name">${j.zh}</div><div class="j-desc">${j.desc}</div>` +
      (GROWING.has(j.id) ? `<div class="j-count">${j.state}</div>` : '') +
      `<div class="sell-tip">右键出售 $${sellValue(j)}</div>`;
    el.title = `${j.zh}：${j.desc}`;
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      sellJoker(G, j.uid);
      flashMessage(`出售 ${j.zh} +$${sellValue(j)}`);
    });
    row.appendChild(el);
  }
}

function syncHand(flip) {
  const apply = () => {
    // 协调子节点顺序与 G.hand 一致（appendChild 移动既有节点，不重建）
    for (const card of G.hand) {
      const el = cardEl(card);
      el.classList.remove('static');      // 关键：打出区回收的元素清除流式布局类
      els.hand.appendChild(el);
    }
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
    el.style.removeProperty('transform');   // 清除悬停 3D 残留（removeProperty 而非 ''，避免空内联覆盖）
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
  const ev = evalHand(sel, round.evalOptsFromJokers());
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
  icon.innerHTML = blindIcon(['small', 'big', 'boss'][G.blindIndex] ?? 'small');
}

function syncDeckBadge() {
  $('deck-count').textContent = G.deck.length;
}

function syncButtons() {
  const playing = G.phase === PHASES.PLAYING;
  els.play.disabled = !playing || G.selected.length === 0 || G.handsLeft <= 0;
  els.discard.disabled = !playing || G.selected.length === 0 || G.discardsLeft <= 0;
}

// ===== 结算表现：逐步跳分（steps 重放），完成后落地 =====

function onHandPlayed({ result }) {
  syncHand(true); syncPlayed(); syncSidebar(); syncButtons();
  playScoreAnimation(result, () => {
    round.resolveAfterScoring();
    syncSidebar();
  });
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
    const target = blindTarget(G.ante, i, i === 2 ? boss : null, G.config).toLocaleString();
    const cur = i === G.blindIndex ? 'current' : (i < G.blindIndex ? 'done' : '');
    return `<div class="blind-card ${cur}">
      <div class="bc-icon ${['small', 'big', 'boss'][i]}">${blindIcon(['small', 'big', 'boss'][i])}</div>
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

function showShop() {
  const s = G.shop;
  if (!s) return;
  const slotHTML = (item, i) => {
    if (item.sold) return `<div class="s-item sold">已售出</div>`;
    let body = '';
    if (item.kind === 'joker') {
      const d = JOKER_MAP[item.id];
      body = `<div class="s-art">${jokerArtSVG(d.art, d.id)}</div>` +
        `<div class="s-name">${d.zh}${item.edition ? ' ✦' : ''}</div><div class="s-desc">${d.desc}</div>` +
        `<div class="s-rarity r-${d.rarity}">${{ common: '普通', uncommon: '罕见', rare: '稀有' }[d.rarity]}</div>`;
    } else if (item.kind === 'tarot') {
      const d = TAROT_MAP[item.id];
      body = `<div class="s-icon">${tarotIcon()}</div><div class="s-name">${d.zh}</div><div class="s-desc">${d.desc}</div>`;
    } else if (item.kind === 'spectral') {
      const d = SPECTRAL_MAP[item.id];
      body = `<div class="s-icon">${spectralIcon()}</div><div class="s-name">${d.zh}</div><div class="s-desc">${d.desc}</div>`;
    } else if (item.kind === 'card') {
      body = `<div class="s-cardface">${cardFaceSVG(item.card)}</div>` +
        (item.card.enhancement ? `<div class="s-desc">${item.card.enhancement}</div>` : '');
    } else {
      const d = PLANET_MAP[item.id];
      body = `<div class="s-icon">${planetIcon()}</div><div class="s-name">${d.zh}</div>` +
        `<div class="s-desc">升级「${HAND_TYPE_MAP[d.hand].zh}」等级</div>`;
    }
    return `<div class="s-item" data-slot="${i}">${body}<div class="s-price">$${item.price}</div></div>`;
  };
  const packHTML = (p, i) => {
    if (p.sold) return `<div class="s-item sold">已售出</div>`;
    const d = shop.PACK_MAP[p.id];
    return `<div class="s-item s-pack" data-pack="${i}">
      <div class="s-icon">${packIcon()}</div><div class="s-name">${d.zh}</div>
      <div class="s-desc">${d.desc}</div><div class="s-price">$${p.price}</div></div>`;
  };
  const vCard = (v, domId) => !v ? '' : v.sold ? `<div class="s-item sold">已购</div>` :
    `<div class="s-item s-voucher" id="${domId}">
      <div class="s-icon">${voucherIcon()}</div><div class="s-name">${VOUCHER_MAP[v.id].zh}</div>
      <div class="s-desc">${VOUCHER_MAP[v.id].desc}</div><div class="s-price">$${v.price}</div></div>`;
  const voucherHTML = vCard(s.voucher, 'shop-voucher') + vCard(s.voucher2, 'shop-voucher2');

  showOverlay(`
    <div class="panel shop-panel">
      <h2>🏪 商店</h2>
      <div class="panel-sub">资金 <b class="gold">$${G.money}</b></div>
      <div class="shop-rows">
        <div class="shop-sec"><h3>卡位</h3><div class="shop-row">${s.slots.map(slotHTML).join('')}</div></div>
        <div class="shop-sec"><h3>卡包</h3><div class="shop-row">${s.packs.map(packHTML).join('')}</div></div>
        <div class="shop-sec"><h3>优惠券</h3><div class="shop-row">${voucherHTML}</div></div>
      </div>
      <div class="panel-actions">
        <button class="btn btn-discard" id="shop-reroll">重掷 $${shop.rerollCost()}</button>
        <button class="btn btn-shop-go" id="shop-leave">下一盲注 →</button>
      </div>
    </div>`);

  els.overlay.querySelectorAll('[data-slot]').forEach(el =>
    el.addEventListener('click', () => shop.buySlot(Number(el.dataset.slot))));
  els.overlay.querySelectorAll('[data-pack]').forEach(el =>
    el.addEventListener('click', () => shop.buyPack(Number(el.dataset.pack))));
  $('shop-voucher')?.addEventListener('click', () => shop.buyVoucher('voucher'));
  $('shop-voucher2')?.addEventListener('click', () => shop.buyVoucher('voucher2'));
  $('shop-reroll').addEventListener('click', () => shop.rerollShop());
  $('shop-leave').addEventListener('click', () => round.leaveShop());
}

function showBooster() {
  const b = G.booster;
  if (!b) return;
  const itemHTML = (it, i) => {
    if (it.taken) return `<div class="s-item sold">已选</div>`;
    if (it.kind === 'card') {
      return `<div class="s-item s-boostcard" data-bi="${i}"><div class="s-cardface">${cardFaceSVG(it.card)}</div>
        ${it.card.enhancement ? `<div class="s-desc">${it.card.enhancement}</div>` : ''}</div>`;
    }
    if (it.kind === 'joker') {
      const d = JOKER_MAP[it.id];
      return `<div class="s-item" data-bi="${i}"><div class="s-art">${jokerArtSVG(d.art, d.id)}</div>
        <div class="s-name">${d.zh}</div><div class="s-desc">${d.desc}</div></div>`;
    }
    // 消耗牌（塔罗/星球/幻灵）— 幻灵之前误走 PLANET_MAP 会崩
    const d = { tarot: TAROT_MAP, planet: PLANET_MAP, spectral: SPECTRAL_MAP }[it.kind]?.[it.id];
    const ic = { tarot: tarotIcon, planet: planetIcon, spectral: spectralIcon }[it.kind] ?? tarotIcon;
    return `<div class="s-item" data-bi="${i}">
      <div class="s-icon">${ic()}</div>
      <div class="s-name">${d?.zh ?? it.id}</div><div class="s-desc">${d?.desc ?? ''}</div></div>`;
  };
  showOverlay(`
    <div class="panel shop-panel">
      <h2>🎁 ${b.zh}</h2>
      <div class="panel-sub">选择 ${b.picks} 件</div>
      <div class="shop-row">${b.items.map(itemHTML).join('')}</div>
      <div class="panel-actions"><button class="btn btn-ghost" id="booster-skip">跳过</button></div>
    </div>`);
  els.overlay.querySelectorAll('[data-bi]').forEach(el =>
    el.addEventListener('click', () => shop.pickBoosterItem(Number(el.dataset.bi))));
  $('booster-skip').addEventListener('click', () => shop.closeBooster());
}

function showGameEnd(won) {
  showOverlay(`
    <div class="panel game-end ${won ? 'win' : 'lose'}">
      <h1>${won ? '🏆 通关!' : '游戏结束'}</h1>
      <div class="panel-sub">
        到达 ANTE ${Math.min(G.ante, 8)} · 回合 ${G.round} · 最佳一手 ${G.stats.bestHandScore.toLocaleString()} · $${G.money}
      </div>
      <div class="panel-actions">
        <button class="btn btn-play" id="ov-restart">再来一局</button>
        <button class="btn btn-ghost" id="ov-menu">主菜单</button>
      </div>
    </div>`);
  $('ov-restart').addEventListener('click', () => round.startRun({}));
  $('ov-menu').addEventListener('click', () => round.toMenu());
}

/** 主菜单：新游戏（可指定种子）/ 继续存档 / 战绩 */
export async function showMainMenu() {
  const [save, stats] = await Promise.all([loadSave(), fetchStats()]);
  if (G.phase !== PHASES.MENU) return;   // 异步期间阶段已变

  const statsHtml = stats && stats.games
    ? `<div class="menu-stats">局数 <b>${stats.games}</b> · 胜场 <b>${stats.wins ?? 0}</b> · 最佳一手 <b>${(stats.bestScore ?? 0).toLocaleString()}</b> · 最高底注 <b>${stats.bestAnte ?? 0}</b></div>`
    : '';
  const contHtml = save
    ? `<button class="btn btn-shop-go menu-btn" id="menu-continue"><span>继续 · ANTE ${save.ante} · $${save.money}</span></button>`
    : '';
  // 背景浮动卡牌（四花色 A + 王冠 Joker）
  const floatCards = ['spades', 'hearts', 'clubs', 'diamonds'].map((s, i) =>
    `<div class="mfc mfc-${i}">${cardFaceSVG({ suit: s, rank: 'A' })}</div>`).join('');
  showOverlay(`
    <div class="menu-stage">
      ${floatCards}
      <div class="panel menu-panel">
        <div class="menu-title">
          <svg viewBox="0 0 460 150" class="title-svg">
            <defs>
              <linearGradient id="mtg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#ffe9a8"/>
                <stop offset="0.45" stop-color="#f0c060"/>
                <stop offset="0.55" stop-color="#c89838"/>
                <stop offset="1" stop-color="#f8d888"/>
              </linearGradient>
              <linearGradient id="mtr" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="#ff4c40"/>
                <stop offset="1" stop-color="#c82818"/>
              </linearGradient>
            </defs>
            <g class="t-suit t-s1"><path d="M0 -9 L7 -1 A4.3 4.3 0 1 1 0.8 4 L0 3.2 L-0.8 4 A4.3 4.3 0 1 1 -7 -1 Z M0 2 C0.8 6 2.2 7.8 4 9.7 L-4 9.7 C-2.2 7.8 -0.8 6 0 2 Z" fill="#2b2b33" transform="translate(38 34) scale(1.9)"/></g>
            <g class="t-suit t-s2"><path d="M0 9 L-7 1.5 A4.3 4.3 0 1 1 0 -3 A4.3 4.3 0 1 1 7 1.5 Z" fill="url(#mtr)" transform="translate(422 32) scale(1.9)"/></g>
            <g class="t-suit t-s3"><path d="M0 -9.5 L7 0 L0 9.5 L-7 0 Z" fill="url(#mtr)" transform="translate(30 118) scale(1.9)"/></g>
            <g class="t-suit t-s4"><g transform="translate(430 116) scale(1.9)"><circle cx="0" cy="-4.6" r="3.8" fill="#2b2b33"/><circle cx="-4" cy="1.4" r="3.8" fill="#2b2b33"/><circle cx="4" cy="1.4" r="3.8" fill="#2b2b33"/><path d="M0 0.5 C0.8 5 2.2 7 4 9 L-4 9 C-2.2 7 -0.8 5 0 0.5 Z" fill="#2b2b33"/></g></g>
            <text x="230" y="82" text-anchor="middle" class="t-main">小丑牌</text>
            <text x="230" y="126" text-anchor="middle" class="t-sub">B A L A T R O</text>
          </svg>
        </div>
        ${statsHtml}
        <div class="menu-actions">
          ${contHtml}
          <div class="diff-row" id="diff-select">
            <span class="diff-btn" data-d="beginner">新手</span>
            <span class="diff-btn sel" data-d="easy">简单</span>
            <span class="diff-btn" data-d="normal">标准</span>
          </div>
          <button class="btn btn-play menu-btn" id="menu-new"><span>新 游 戏</span></button>
          <div class="seed-row">
            <input id="menu-seed" maxlength="12" placeholder="自定义种子（可选）" spellcheck="false">
          </div>
        </div>
        <div class="menu-foot">150 小丑 · 28 Boss · 32 优惠券 · 原创程序化美术</div>
      </div>
    </div>`);
  // 视差：鼠标移动时浮动卡牌轻微跟随
  const stage = els.overlay.querySelector('.menu-stage');
  stage.addEventListener('pointermove', e => {
    const dx = (e.clientX / innerWidth - 0.5), dy = (e.clientY / innerHeight - 0.5);
    stage.querySelectorAll('.mfc').forEach((el, i) => {
      const depth = 14 + i * 8;
      el.style.setProperty('--px', `${(-dx * depth).toFixed(1)}px`);
      el.style.setProperty('--py', `${(-dy * depth).toFixed(1)}px`);
    });
  });
  // 难度选择 toggle
  let selDiff = 'easy';
  document.querySelectorAll('.diff-btn').forEach(b =>
    b.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      selDiff = b.dataset.d;
    }));
  $('menu-new').addEventListener('click', () => {
    const seed = $('menu-seed').value.trim().toUpperCase();
    round.startRun(seed ? { seed, difficulty: selDiff } : { difficulty: selDiff });
  });
  $('menu-continue')?.addEventListener('click', () => {
    if (!round.continueRun(save)) {
      flashMessage('存档损坏或版本不符');
      round.toMenu();
    } else {
      syncAll();
    }
  });
}

// ===== 图鉴面板（版本 + 强化） =====
import { EDITIONS, ENHANCEMENTS, SEALS } from '../data/card-data.js';

function showGuide() {
  const edColors = { foil: '#a8d8ff', holographic: '#ff80c0', polychrome: '#e088ff', negative: '#ff8a70' };
  const edIcons = { foil: '✦', holographic: '◇', polychrome: '✧', negative: '⬡' };
  const edCards = Object.entries(EDITIONS).map(([id, e]) =>
    `<div class="gc-item gc-ed" style="--gc-c:${edColors[id]}">
      <div class="gc-icon">${edIcons[id]}</div>
      <div class="gc-name">${e.zh}</div>
      <div class="gc-desc">${e.desc}</div>
    </div>`).join('');

  const enColors = { bonus: '#5a9fd4', mult: '#e05545', wild: '#e8c84a', glass: '#a8e0ff', steel: '#8aa8cc', stone: '#8a8a8a', gold: '#f0c060', lucky: '#68d868' };
  const enIcons = { bonus: '⊕', mult: '＋', wild: '♣', glass: '◇', steel: '◈', stone: '■', gold: '$', lucky: '⚅' };
  const enCards = Object.entries(ENHANCEMENTS).map(([id, e]) =>
    `<div class="gc-item gc-en" style="--gc-c:${enColors[id] ?? '#888'}">
      <div class="gc-icon">${enIcons[id] ?? '?'}</div>
      <div class="gc-name">${e.zh}</div>
      <div class="gc-desc">${e.desc}</div>
    </div>`).join('');

  const seColors = { red: '#ff4c40', gold: '#f0c060', blue: '#5a9fd4', purple: '#b53aff' };
  const seIcons = { red: '●', gold: '●', blue: '●', purple: '●' };
  const seCards = Object.entries(SEALS).map(([id, s]) =>
    `<div class="gc-item gc-se" style="--gc-c:${seColors[id]}">
      <div class="gc-icon">${seIcons[id]}</div>
      <div class="gc-name">${s.zh}</div>
      <div class="gc-desc">${s.desc}</div>
    </div>`).join('');

  showOverlay(`
    <div class="panel guide-panel">
      <h2>📖 图鉴</h2>
      <div class="guide-sec">
        <h3>✦ 版本（出现在卡牌/Joker 上）</h3>
        <div class="guide-grid">${edCards}</div>
      </div>
      <div class="guide-sec">
        <h3>◆ 强化（塔罗牌/幻灵牌赋予）</h3>
        <div class="guide-grid">${enCards}</div>
      </div>
      <div class="guide-sec">
        <h3>● 蜡封（标准包 / 幻灵牌赋予）</h3>
        <div class="guide-grid">${seCards}</div>
      </div>
      <div class="panel-actions">
        <button class="btn btn-ghost" id="guide-close">关闭</button>
      </div>
    </div>`);
  $('guide-close').addEventListener('click', hideOverlay);
}
