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
  const skin = bossMode ? '#4a2a30' : '#e8c8a0';
  const skinShadow = bossMode ? '#2a1418' : '#c49870';
  const skinHighlight = bossMode ? '#5a3840' : '#f4dcc0';
  const jacket = bossMode ? '#1a0a10' : '#181825';
  const vest = bossMode ? '#301020' : '#2a1a20';
  const shirt = bossMode ? '#201010' : '#f0e8e0';
  const tie = bossMode ? '#600020' : '#800028';
  const hatC = bossMode ? '#0a0808' : '#1a1418';
  const hatBand = bossMode ? '#400018' : '#600028';
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
      <radialGradient id="sg" cx="0.45" cy="0.35" r="0.65">
        <stop offset="0%" stop-color="${skinHighlight}"/><stop offset="55%" stop-color="${skin}"/><stop offset="100%" stop-color="${skinShadow}"/>
      </radialGradient>
      <linearGradient id="jg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${jacket}"/><stop offset="100%" stop-color="#0a0a14"/>
      </linearGradient>
      <linearGradient id="rim" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgba(255,255,255,0.08)"/><stop offset="50%" stop-color="rgba(255,255,255,0)"/><stop offset="100%" stop-color="rgba(0,0,0,0.2)"/>
      </linearGradient>
    </defs>

    <!-- 礼帽 -->
    <ellipse cx="100" cy="28" rx="50" ry="18" fill="${hatC}"/>
    <rect x="66" y="6" width="68" height="28" rx="5" fill="${hatC}"/>
    <rect x="66" y="6" width="68" height="6" rx="3" fill="rgba(255,255,255,0.08)"/>
    <rect x="68" y="22" width="64" height="6" fill="${hatBand}"/>
    ${bossMode ? `<ellipse cx="100" cy="28" rx="52" ry="20" fill="none" stroke="#ff2040" stroke-width="0.8" opacity="0.3"/>` : ''}

    <!-- 头发（帽檐下） -->
    <path d="M56 40 Q58 62 60 80 Q80 72 100 68 Q120 72 140 80 Q142 62 144 40 Z" fill="#1a1010" opacity="0.85"/>

    <!-- 脖子 -->
    <rect x="88" y="130" width="24" height="28" rx="7" fill="${skin}"/>
    <rect x="88" y="132" width="8" height="24" rx="3" fill="${skinShadow}" opacity="0.3"/>

    <!-- 脸（更棱角的椭圆） -->
    <path d="M58 105 Q58 60 100 58 Q142 60 142 105 Q142 150 110 156 Q100 160 90 156 Q58 150 58 105 Z" fill="url(#sg)"/>
    <rect x="58" y="58" width="84" height="98" rx="42" fill="url(#rim)" opacity="0.5"/>

    ${cracks}${horns}

    <!-- 眼睛（更深邃） -->
    <ellipse cx="84" cy="102" rx="10" ry="7.5" fill="#fff" opacity="0.9"/>
    <ellipse cx="116" cy="102" rx="10" ry="7.5" fill="#fff" opacity="0.9"/>
    <circle cx="84" cy="102" r="5" fill="${eye}"/>
    <circle cx="116" cy="102" r="5" fill="${eye}"/>
    <circle cx="82" cy="100" r="2.2" fill="${eyeGlow}"/>
    <circle cx="114" cy="100" r="2.2" fill="${eyeGlow}"/>
    ${bossMode ? `<line x1="78" y1="98" x2="90" y2="106" stroke="#ff2040" stroke-width="0.7" opacity="0.6"/><line x1="110" y1="98" x2="122" y2="106" stroke="#ff2040" stroke-width="0.7" opacity="0.6"/>` : ''}
    <!-- 下眼睑阴影 -->
    <path d="M75 108 Q84 112 93 108" fill="none" stroke="${skinShadow}" stroke-width="1" opacity="0.4"/>
    <path d="M107 108 Q116 112 125 108" fill="none" stroke="${skinShadow}" stroke-width="1" opacity="0.4"/>

    <!-- 眉毛（更粗犷） -->
    <path d="M72 93 Q84 87 98 93" fill="none" stroke="${bossMode ? '#ff2040' : '#1a0a08'}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M102 93 Q116 87 128 93" fill="none" stroke="${bossMode ? '#ff2040' : '#1a0a08'}" stroke-width="3.5" stroke-linecap="round"/>

    <!-- 鼻子（更立体） -->
    <path d="M96 110 Q100 106 104 110 Q104 120 98 124 Q100 117 100 114 Z" fill="${skinShadow}" opacity="0.55"/>
    <path d="M90 118 Q100 108 110 118" fill="none" stroke="${skinShadow}" stroke-width="1.3" opacity="0.35"/>

    <!-- 嘴（更清晰唇形） -->
    <path d="M86 132 Q100 142 114 132" fill="none" stroke="${bossMode ? '#ff2040' : '#5a2a18'}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M88 132 Q100 134 112 132" fill="none" stroke="${bossMode ? '#ff2040' : '#8a4a30'}" stroke-width="1.2" opacity="0.5"/>
    ${bossMode ? `<path d="M86 132 Q100 148 114 132" fill="none" stroke="#ff2040" stroke-width="1.8" opacity="0.5"/>` : ''}

    <!-- 下巴 -->
    <ellipse cx="100" cy="150" rx="20" ry="5" fill="${skinShadow}" opacity="0.25"/>

    <!-- 衣领 + 西装（更锐利剪裁） -->
    <path d="M52 158 Q72 142 88 150 L100 164 L112 150 Q128 142 148 158 L160 240 L140 240 L118 180 L110 185 L100 172 L90 185 L82 180 L60 240 L40 240 Z" fill="url(#jg)"/>
    <!-- 衬衫 + 领结 -->
    <path d="M88 150 L100 164 L112 150 L100 175 Z" fill="${shirt}" opacity="0.95"/>
    <path d="M94 154 L100 162 L106 154 L102 148 L98 148 Z" fill="${tie}"/>
    <!-- 翻领 -->
    <path d="M52 158 Q78 144 88 150 L82 180 L60 190 Z" fill="${vest}" opacity="0.6"/>
    <path d="M148 158 Q122 144 112 150 L118 180 L140 190 Z" fill="${vest}" opacity="0.6"/>
    <!-- 左臂（持牌手） -->
    <path d="M148 170 Q168 180 175 210 L180 210 Q172 185 160 175 Z" fill="url(#jg)"/>
    <!-- 手持卡牌 -->
    <rect x="170" y="200" width="16" height="22" rx="2" fill="#f5f1e6" stroke="${bossMode ? '#ff2040' : '#c9c0ab'}" stroke-width="0.8"/>
    <text x="178" y="215" text-anchor="middle" font-size="7" fill="${bossMode ? '#ff2040' : '#d13b30'}">♥</text>
    <!-- 纽扣 -->
    <circle cx="100" cy="195" r="2.8" fill="${bossMode ? '#ff2040' : '#d4a843'}" opacity="0.5"/>
    <circle cx="100" cy="215" r="2.8" fill="${bossMode ? '#ff2040' : '#d4a843'}" opacity="0.35"/>

    ${bossMode ? `<ellipse cx="100" cy="145" rx="72" ry="100" fill="none" stroke="#ff2040" stroke-width="1.5" opacity="0.25"><animate attributeName="rx" values="72;78;72" dur="2s" repeatCount="indefinite"/><animate attributeName="ry" values="100;108;100" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.25;0.42;0.25" dur="2s" repeatCount="indefinite"/></ellipse>
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
