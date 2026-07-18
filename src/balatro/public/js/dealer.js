// dealer.js — 发牌员角色 v2：中央背景半身像 + 精致 SVG + 对话气泡 + Boss 崩坏
import { bus, G, PHASES } from './state.js';
import { ac } from './audio/sfx.js';

// ===== 对话库 =====
const LINES = {
  hand_played: [
    ['high_card',    [['高牌？', 'neutral'], ['就这？', 'smirk'], ['勉强拿分吧', 'neutral']]],
    ['pair',         [['一对！', 'happy'], ['小对子，还行', 'neutral'], ['对子也敢出？', 'smirk']]],
    ['two_pair',     [['两对，不错', 'happy'], ['稳步前进', 'neutral']]],
    ['three_of_a_kind', [['三条！漂亮', 'happy'], ['三条来咯', 'excited']]],
    ['straight',     [['顺子！一气呵成', 'excited'], ['连成一线！', 'excited']]],
    ['flush',        [['同花！漂亮', 'excited'], ['全是同色！', 'happy'], ['同花顺眼', 'neutral']]],
    ['full_house',   [['葫芦！大牌！', 'excited'], ['满堂红！', 'excited']]],
    ['four_of_a_kind', [['四条！！！', 'amazed'], ['四张一样的！', 'amazed']]],
    ['straight_flush',[['同花顺！！！', 'amazed'], ['你这运气绝了！', 'amazed']]],
    ['five_of_a_kind',[['五……五条？！', 'shocked'], ['作弊了吧！', 'shocked']]],
    ['flush_house',  [['同花葫芦？！', 'shocked'], ['神仙牌来了！', 'shocked']]],
    ['flush_five',   [['同花五条！！!', 'shocked'], ['不可能！', 'shocked']]],
  ],
  score: [
    ['big',  [['大分数！', 'amazed'], ['这手值钱！', 'excited'], ['钱包鼓了！', 'happy']]],
    ['mid',  [['还行还行', 'neutral'], ['够过关了', 'neutral']]],
    ['low',  [['有点悬啊', 'worried'], ['这点分不太够', 'worried'], ['再想想？', 'smirk']]],
  ],
  round_won: [['漂亮！', 'happy'], ['一回合拿下！', 'excited'], ['稳！', 'neutral']],
  round_lost: [['可惜了', 'sad'], ['运气不太好', 'worried'], ['下次加油', 'sad']],
  run_won: [['通关了！！！', 'shocked'], ['你是传奇！', 'amazed'], ['不可思议', 'shocked']],
  run_lost: [['游戏结束', 'sad'], ['下次再来', 'neutral'], ['可惜可惜', 'sad']],
  shop_enter: [['看看有什么好东西', 'neutral'], ['逛街时间到', 'happy'], ['花钱要谨慎', 'smirk']],
  shop_buy: [['好眼光！', 'happy'], ['值！', 'excited'], ['这笔交易不错', 'neutral']],
  shop_skip: [['再看看别的？', 'neutral'], ['不急不急', 'neutral']],
  money_low: [['钱不多了', 'worried'], ['省着点花', 'neutral']],
  money_high: [['财大气粗！', 'happy'], ['有钱任性！', 'excited']],
  joker_bought: [['新伙伴来了！', 'happy'], ['他会帮你的', 'neutral'], ['有趣的组合', 'smirk']],
  joker_sold: [['再见老朋友', 'sad'], ['卖了就卖了', 'neutral']],
  blind_small: [['小盲注，轻松', 'neutral'], ['开局热身', 'neutral'], ['先试试水', 'neutral']],
  blind_big: [['大盲注来了', 'neutral'], ['认真点打', 'neutral']],
  boss_enter: [
    ['他来了……', 'boss'], ['小心这家伙……', 'boss'], ['不太对劲……', 'boss'],
    ['嘿嘿嘿嘿……', 'boss'], ['你觉得你能赢？', 'boss'], ['放弃吧……', 'boss'],
    ['黑暗降临……', 'boss'], ['我看见了你的恐惧', 'boss'],
  ],
  idle: [['嗯……', 'neutral'], ['下一手怎么打？', 'neutral'], ['仔细想想', 'neutral']],
};

// ===== 精致 SVG 半身像（viewBox 0 0 200 280） =====
function renderPortrait(bossMode) {
  // 颜色
  const skin = bossMode ? '#4a2a30' : '#e8c8a0';
  const skinShadow = bossMode ? '#2a1418' : '#c49870';
  const skinHighlight = bossMode ? '#5a3840' : '#f4dcc0';
  const jacket = bossMode ? '#1a0a10' : '#1a1a24';
  const vest = bossMode ? '#301020' : '#3a2a28';
  const shirt = bossMode ? '#201010' : '#e8e0d8';
  const tie = bossMode ? '#600020' : '#900030';
  const hair = bossMode ? '#0a0808' : '#2a1a10';
  const eye = bossMode ? '#ff2040' : '#1a1a1a';
  const eyeGlow = bossMode ? '#ff0' : '#fff';

  // Boss 裂纹
  const cracks = bossMode ? `
    <line x1="75" y1="50" x2="85" y2="90" stroke="#600010" stroke-width="1.5" opacity="0.7"/>
    <line x1="125" y1="40" x2="120" y2="80" stroke="#600010" stroke-width="1.2" opacity="0.6"/>
    <line x1="100" y1="35" x2="100" y2="55" stroke="#600010" stroke-width="1" opacity="0.5"/>
    <line x1="60" y1="120" x2="90" y2="135" stroke="#600010" stroke-width="1.3" opacity="0.5"/>
    <circle cx="70" cy="110" r="2" fill="#ff2040" opacity="0.4"/>
    <circle cx="130" cy="100" r="1.5" fill="#ff2040" opacity="0.35"/>
  ` : '';

  // Boss 角
  const horns = bossMode ? `
    <path d="M78 40 Q72 10 68 -5 Q76 8 82 30 Z" fill="#2a1018"/>
    <path d="M122 40 Q128 10 132 -5 Q124 8 118 30 Z" fill="#2a1018"/>
    <path d="M78 40 Q72 10 68 -5 Q74 12 80 32 Z" fill="#4a1828" opacity="0.5"/>
    <path d="M122 40 Q128 10 132 -5 Q126 12 120 32 Z" fill="#4a1828" opacity="0.5"/>
  ` : '';

  return `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg" class="dealer-portrait">
    <defs>
      <radialGradient id="skinGrad" cx="0.5" cy="0.4" r="0.6">
        <stop offset="0%" stop-color="${skinHighlight}"/>
        <stop offset="60%" stop-color="${skin}"/>
        <stop offset="100%" stop-color="${skinShadow}"/>
      </radialGradient>
      <linearGradient id="jacketGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${jacket}"/>
        <stop offset="100%" stop-color="#0a0a14"/>
      </linearGradient>
      <filter id="dropShadow">
        <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.5"/>
      </filter>
    </defs>

    <!-- 头发 -->
    <ellipse cx="100" cy="60" rx="46" ry="48" fill="${hair}"/>
    ${bossMode ? `<ellipse cx="100" cy="58" rx="44" ry="46" fill="none" stroke="#ff2040" stroke-width="0.6" opacity="0.3"/>` : ''}
    <path d="M54 62 Q50 100 58 110 Q56 104 58 85 Z" fill="${hair}" opacity="0.9"/>
    <path d="M146 62 Q150 100 142 110 Q144 104 142 85 Z" fill="${hair}" opacity="0.9"/>

    <!-- 脖子 -->
    <rect x="88" y="130" width="24" height="25" rx="6" fill="${skin}"/>
    <rect x="90" y="132" width="6" height="22" rx="2" fill="${skinShadow}" opacity="0.4"/>

    <!-- 脸 -->
    <ellipse cx="100" cy="105" rx="42" ry="54" fill="url(#skinGrad)"/>
    ${cracks}
    ${horns}

    <!-- 眼睛 -->
    <g>
      <!-- 眼白 -->
      <ellipse cx="85" cy="100" rx="9" ry="7" fill="#fff" opacity="0.9"/>
      <ellipse cx="115" cy="100" rx="9" ry="7" fill="#fff" opacity="0.9"/>
      <!-- 瞳孔 -->
      <circle cx="85" cy="100" r="4.5" fill="${eye}"/>
      <circle cx="115" cy="100" r="4.5" fill="${eye}"/>
      <!-- 高光 -->
      <circle cx="83" cy="98" r="2" fill="${eyeGlow}"/>
      <circle cx="113" cy="98" r="2" fill="${eyeGlow}"/>
      <!-- Boss 血丝 -->
      ${bossMode ? `
        <line x1="79" y1="96" x2="91" y2="103" stroke="#ff2040" stroke-width="0.6" opacity="0.6"/>
        <line x1="109" y1="96" x2="121" y2="103" stroke="#ff2040" stroke-width="0.6" opacity="0.6"/>
      ` : ''}
    </g>

    <!-- 眉毛 -->
    <path d="M74 91 Q85 86 96 92" fill="none" stroke="${bossMode ? '#ff2040' : '#2a1a10'}" stroke-width="3" stroke-linecap="round"/>
    <path d="M104 92 Q115 86 126 91" fill="none" stroke="${bossMode ? '#ff2040' : '#2a1a10'}" stroke-width="3" stroke-linecap="round"/>

    <!-- 鼻子 -->
    <path d="M98 108 Q100 104 102 108 Q101 118 98 122 Q101 116 100 114 Z" fill="${skinShadow}" opacity="0.5"/>
    <ellipse cx="100" cy="108" rx="6" ry="4" fill="none" stroke="${skinShadow}" stroke-width="1.2" opacity="0.4"/>

    <!-- 嘴 -->
    <path d="M86 128 Q100 136 114 128" fill="none" stroke="${bossMode ? '#ff2040' : '#6a3a20'}" stroke-width="2.5" stroke-linecap="round"/>
    ${bossMode ? `<path d="M86 128 Q100 140 114 128" fill="none" stroke="#ff2040" stroke-width="1.5" opacity="0.6"/>` : ''}

    <!-- 下巴阴影 -->
    <ellipse cx="100" cy="148" rx="24" ry="6" fill="${skinShadow}" opacity="0.3"/>

    <!-- 衣领 + 西装 -->
    <path d="M54 155 Q70 140 88 148 L100 160 L112 148 Q130 140 146 155 L156 200 L136 200 L116 170 L110 175 L100 165 L90 175 L84 170 L64 200 L44 200 Z" fill="url(#jacketGrad)"/>
    <!-- 衬衫 -->
    <path d="M88 148 L100 160 L112 148 L100 170 Z" fill="${shirt}" opacity="0.9"/>
    <!-- 领带 -->
    <path d="M96 150 L100 170 L104 150 Z" fill="${tie}"/>
    <!-- 西装翻领 -->
    <path d="M54 155 Q75 142 88 148 L84 170 L64 200 Z" fill="${vest}" opacity="0.7"/>
    <path d="M146 155 Q125 142 112 148 L116 170 L136 200 Z" fill="${vest}" opacity="0.7"/>
    <!-- 西装纽扣 -->
    <circle cx="100" cy="185" r="2.5" fill="${bossMode ? '#ff2040' : '#d4a843'}" opacity="0.6"/>
    <circle cx="100" cy="200" r="2.5" fill="${bossMode ? '#ff2040' : '#d4a843'}" opacity="0.4"/>

    <!-- Boss 诡异光环 -->
    ${bossMode ? `
      <ellipse cx="100" cy="140" rx="70" ry="90" fill="none" stroke="#ff2040" stroke-width="1.5" opacity="0.25">
        <animate attributeName="rx" values="70;75;70" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="ry" values="90;96;90" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.25;0.40;0.25" dur="2s" repeatCount="indefinite"/>
      </ellipse>
    ` : ''}
  </svg>`;
}

// ===== 表情映射 → 嘴形/眼形调整 =====
const MOOD_FACE = {
  neutral: `<path d="M86 128 Q100 136 114 128" fill="none" stroke="#6a3a20" stroke-width="2.5" stroke-linecap="round"/>`,
  happy:   `<path d="M84 124 Q100 140 116 124" fill="none" stroke="#6a3a20" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="100" cy="132" rx="3" ry="1.5" fill="#fff" opacity="0.3"/>`,
  excited: `<ellipse cx="100" cy="130" rx="7" ry="5" fill="#3a1a10"/>`,
  amazed:  `<ellipse cx="100" cy="130" rx="9" ry="6" fill="#2a1a1a"/>`,
  smirk:   `<path d="M82 126 Q95 130 116 120" fill="none" stroke="#6a3a20" stroke-width="2.5" stroke-linecap="round"/>`,
  worried: `<path d="M86 130 Q100 122 114 130" fill="none" stroke="#6a3a20" stroke-width="2.5" stroke-linecap="round"/>`,
  sad:     `<path d="M84 132 Q100 122 116 132" fill="none" stroke="#6a3a20" stroke-width="2.5" stroke-linecap="round"/>`,
  shocked: `<ellipse cx="100" cy="130" rx="10" ry="7" fill="#2a1a1a"/>`,
  boss:    `<path d="M82 124 Q100 144 118 124" fill="none" stroke="#ff2040" stroke-width="3" stroke-linecap="round"/><path d="M84 128 Q100 136 116 128" stroke="#ff2040" stroke-width="0.8" opacity="0.5"/>`,
};

let container = null, faceEl = null, bubble = null, bubbleTimer = null;
let voiceGain = null, idleTimer = null;

export function initDealer() {
  container = document.createElement('div');
  container.id = 'dealer';
  container.innerHTML = `
    <div id="dealer-bubble" class="dealer-bubble"></div>
    <div id="dealer-face">${renderPortrait(false)}</div>
  `;
  document.getElementById('play-area')?.appendChild(container);
  bubble = document.getElementById('dealer-bubble');
  faceEl = document.getElementById('dealer-face');

  bus.on('hand:played', onHandPlayed);
  bus.on('round:won', () => say(LINES.round_won));
  bus.on('run:won', () => say(LINES.run_won));
  bus.on('run:lost', () => say(LINES.run_lost));
  bus.on('shop:enter', () => say(LINES.shop_enter));
  bus.on('jokers:change', () => { if (G.phase === PHASES.SHOP) say(LINES.joker_bought); });
  bus.on('blind:start', ({ boss }) => {
    if (boss) {
      faceEl.innerHTML = renderPortrait(true);
      say(LINES.boss_enter);
    } else {
      faceEl.innerHTML = renderPortrait(false);
    }
  });
  bus.on('phase', ({ phase }) => {
    if (phase === PHASES.BLIND_SELECT && G.blindIndex === 0) faceEl.innerHTML = renderPortrait(false);
    if (phase === PHASES.PLAYING && !idleTimer) startIdle();
    if (phase !== PHASES.PLAYING) stopIdle();
  });
  container.addEventListener('click', () => say(LINES.idle));
}

function onHandPlayed({ result }) {
  const handLine = LINES.hand_played.find(([id]) => id === result.handType);
  if (handLine) say(handLine[1]);
  const target = G.target;
  if (result.score >= target * 2) say(LINES.score.find(([t]) => t === 'big')[1]);
  else if (result.score >= target * 0.5) say(LINES.score.find(([t]) => t === 'mid')[1]);
  else say(LINES.score.find(([t]) => t === 'low')[1]);
  if (G.money <= 3) say(LINES.money_low);
  if (G.money >= 25) say(LINES.money_high);
}

function startIdle() { stopIdle(); idleTimer = setInterval(() => { if (Math.random() < 0.12) say(LINES.idle); }, 18000); }
function stopIdle() { clearInterval(idleTimer); idleTimer = null; }

function say(lineList) {
  if (!lineList?.length) return;
  const [text] = lineList[Math.floor(Math.random() * lineList.length)];
  showBubble(text);
  speak(text);
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble?.classList.remove('show'), 3400);
}

function showBubble(text) {
  if (!bubble) return;
  bubble.textContent = text;
  bubble.classList.add('show');
}

// ===== 语调合成 =====
function speak(text) {
  try {
    const c = ac();
    if (!voiceGain) { voiceGain = c.createGain(); voiceGain.gain.value = 0.05; voiceGain.connect(c.destination); }
    const t = c.currentTime;
    const dur = Math.min(1.4, text.length * 0.06);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    const mid = t + dur * 0.35;
    o.frequency.linearRampToValueAtTime(300 + (Math.random() - 0.5) * 80, mid);
    o.frequency.linearRampToValueAtTime(160 + (Math.random() - 0.5) * 50, t + dur);
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 550; f1.Q.value = 9;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1300; f2.Q.value = 7;
    const f3 = c.createBiquadFilter(); f3.type = 'bandpass'; f3.frequency.value = 2200; f3.Q.value = 5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.7, t + 0.02);
    g.gain.setValueAtTime(0.6, mid); g.gain.linearRampToValueAtTime(0.001, t + dur + 0.04);
    o.connect(f1); f1.connect(f2); f2.connect(f3); f3.connect(g); g.connect(voiceGain);
    o.start(t); o.stop(t + dur + 0.06);
  } catch (e) {}
}
