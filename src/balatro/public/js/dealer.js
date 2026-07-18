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
  const S  = bossMode ? '#4a2832' : '#e6c49c';
  const SD = bossMode ? '#28141a' : '#c0906c';
  const SH = bossMode ? '#5c3642' : '#f8e4cc';
  const J  = bossMode ? '#120810' : '#1a1828';
  const JL = bossMode ? '#1e1018' : '#282840';
  const V  = bossMode ? '#301020' : '#24181a';
  const SK = bossMode ? '#140808' : '#f2ece4';
  const BW = bossMode ? '#500018' : '#700020';
  const HC = bossMode ? '#0a0608' : '#141018';
  const HB = bossMode ? '#380014' : '#5a0028';
  const E  = bossMode ? '#ff2040' : '#151518';
  const EG = bossMode ? '#ff0' : '#fff';
  const hairDark = bossMode ? '#040408' : '#0c0a10';

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

  return `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="sg" cx="0.45" cy="0.35" r="0.65">
        <stop offset="0%" stop-color="${SH}"/><stop offset="45%" stop-color="${S}"/><stop offset="100%" stop-color="${SD}"/>
      </radialGradient>
      <radialGradient id="fh" cx="0.5" cy="0.2" r="0.7">
        <stop offset="0%" stop-color="rgba(255,255,255,0.12)"/><stop offset="100%" stop-color="rgba(0,0,0,0.0)"/>
      </radialGradient>
      <linearGradient id="jg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${JL}"/><stop offset="100%" stop-color="${J}"/>
      </linearGradient>
      <linearGradient id="rl" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgba(255,255,255,0.10)"/><stop offset="30%" stop-color="rgba(255,255,255,0.02)"/><stop offset="60%" stop-color="rgba(0,0,0,0.0)"/><stop offset="100%" stop-color="rgba(0,0,0,0.22)"/>
      </linearGradient>
    </defs>

    <!-- 背景阴影 -->
    <ellipse cx="100" cy="260" rx="70" ry="14" fill="rgba(0,0,0,0.3)"/>

    <!-- 礼帽 -->
    <ellipse cx="100" cy="26" rx="52" ry="16" fill="${HC}"/>
    <rect x="64" y="4" width="72" height="28" rx="5" fill="${HC}"/>
    <rect x="64" y="4" width="72" height="5" rx="2.5" fill="rgba(255,255,255,0.10)"/>
    <path d="M64 8 L136 8" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
    <rect x="66" y="22" width="68" height="5" rx="2.5" fill="${HB}"/>
    <rect x="66" y="22" width="68" height="2" fill="rgba(255,255,255,0.06)"/>
    ${bossMode ? `<ellipse cx="100" cy="26" rx="54" ry="18" fill="none" stroke="#ff2040" stroke-width="0.7" opacity="0.25"/>` : ''}

    <!-- 头发 -->
    <path d="M54 42 Q48 70 56 82 L60 78 Q56 64 58 48 Z" fill="${hairDark}" opacity="0.9"/>
    <path d="M146 42 Q152 70 144 82 L140 78 Q144 64 142 48 Z" fill="${hairDark}" opacity="0.9"/>
    <path d="M54 42 Q56 68 62 78 Q78 72 100 68 Q122 72 138 78 Q144 68 146 42 Z" fill="${hairDark}" opacity="0.85"/>
    <path d="M68 50 Q80 46 100 44 Q120 46 132 50" stroke="rgba(255,255,255,0.04)" stroke-width="1.5" fill="none"/>

    <!-- 脖子 -->
    <rect x="88" y="128" width="24" height="30" rx="8" fill="${S}"/>
    <rect x="88" y="130" width="7" height="26" rx="3" fill="${SD}" opacity="0.35"/>
    <path d="M88 138 Q84 142 86 150" stroke="${SD}" stroke-width="2" fill="none" opacity="0.3"/>
    <path d="M112 138 Q116 142 114 150" stroke="${SD}" stroke-width="2" fill="none" opacity="0.3"/>

    <!-- 脸 -->
    <path d="M56 108 Q56 56 100 54 Q144 56 144 108 Q144 152 110 158 Q100 162 90 158 Q56 152 56 108 Z" fill="url(#sg)"/>
    <path d="M56 108 Q56 56 100 54 Q144 56 144 108 Q144 152 110 158 Q100 162 90 158 Q56 152 56 108 Z" fill="url(#rl)" opacity="0.6"/>
    <path d="M56 108 Q56 56 100 54 Q144 56 144 108 Q144 152 110 158 Q100 162 90 158 Q56 152 56 108 Z" fill="url(#fh)" opacity="0.5"/>

    <!-- 颧骨阴影 -->
    <ellipse cx="78" cy="115" rx="14" ry="8" fill="${SD}" opacity="0.12"/>
    <ellipse cx="122" cy="115" rx="14" ry="8" fill="${SD}" opacity="0.12"/>
    <!-- 下巴阴影 -->
    <path d="M80 148 Q100 158 120 148" fill="none" stroke="${SD}" stroke-width="3" opacity="0.2"/>

    ${bossMode ? cracks() : ''}
    ${bossMode ? horns() : ''}

    <!-- 眼睛 -->
    ${eyePair(82, 100, E, EG, bossMode)}
    ${eyePair(118, 100, E, EG, bossMode)}

    <!-- 眉毛 -->
    <g opacity="0.9">
      <path d="M70 93 Q82 85 96 91" fill="none" stroke="${bossMode ? '#ff2040' : '#0c0604'}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M104 91 Q118 85 130 93" fill="none" stroke="${bossMode ? '#ff2040' : '#0c0604'}" stroke-width="3.2" stroke-linecap="round"/>
    </g>

    <!-- 鼻子 -->
    <path d="M96 108 Q100 103 104 108" fill="none" stroke="${SD}" stroke-width="1.6" opacity="0.6"/>
    <ellipse cx="100" cy="112" rx="7" ry="4.5" fill="${SD}" opacity="0.25"/>
    <circle cx="96" cy="118" r="2" fill="${SD}" opacity="0.4"/>
    <circle cx="104" cy="118" r="2" fill="${SD}" opacity="0.4"/>
    <path d="M98 120 L100 124 L102 120" fill="none" stroke="${SD}" stroke-width="1" opacity="0.35"/>

    <!-- 嘴 -->
    <path d="M84 132 Q92 128 100 130 Q108 128 116 132" fill="none" stroke="${SD}" stroke-width="1.5" opacity="0.6"/>
    <path d="M86 132 Q100 142 114 132" fill="none" stroke="${bossMode ? '#ff2040' : '#4a2210'}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M88 133 Q100 135 112 133" fill="none" stroke="${bossMode ? '#ff2040' : '#7a3a20'}" stroke-width="1" opacity="0.4"/>

    <!-- 胡渣阴影 -->
    <ellipse cx="100" cy="135" rx="18" ry="10" fill="${hairDark}" opacity="0.06"/>
    <ellipse cx="100" cy="148" rx="16" ry="5" fill="${hairDark}" opacity="0.04"/>

    <!-- 西装 -->
    <path d="M44 155 Q66 136 88 148 L100 168 L112 148 Q134 136 156 155 L160 250 L140 250 L116 182 L110 188 L100 175 L90 188 L84 182 L60 250 L40 250 Z" fill="url(#jg)"/>
    <!-- 翻领 -->
    <path d="M44 155 Q72 140 88 148 L82 188 L60 200 Q52 190 44 180 Z" fill="${V}" opacity="0.55"/>
    <path d="M156 155 Q128 140 112 148 L118 188 L140 200 Q148 190 156 180 Z" fill="${V}" opacity="0.55"/>
    <!-- 衬衫 -->
    <path d="M86 148 L100 168 L114 148 L100 185 Z" fill="${SK}" opacity="0.92"/>
    <!-- 领结 -->
    <path d="M92 155 L100 164 L108 155 L104 148 L96 148 Z" fill="${BW}"/>
    <circle cx="100" cy="159" r="3.5" fill="${BW}"/>
    <!-- 纽扣 -->
    <circle cx="100" cy="198" r="3" fill="rgba(255,255,255,0.15)"/>
    <circle cx="100" cy="220" r="3" fill="rgba(255,255,255,0.10)"/>

    <!-- 右臂+持牌 -->
    <path d="M150 165 Q170 178 178 218 L184 218 Q174 182 162 172 Z" fill="url(#jg)"/>
    <rect x="172" y="208" width="18" height="25" rx="2.5" fill="#f8f4ec" stroke="${bossMode ? '#ff2040' : '#c8c0a8'}" stroke-width="0.8"/>
    <rect x="174" y="210" width="14" height="21" rx="1.5" fill="none" stroke="${bossMode ? '#ff2040' : '#d8d0c0'}" stroke-width="0.5"/>
    <text x="181" y="226" text-anchor="middle" font-size="8" fill="${bossMode ? '#ff2040' : '#c03028'}" font-family="serif">♥</text>

    ${bossMode ? bossAura() : ''}
  </svg>`;
}

function eyePair(cx, cy, eyeColor, glowColor, boss) {
  return `<g>
    <ellipse cx="${cx}" cy="${cy}" rx="10.5" ry="8" fill="#fff" opacity="0.92"/>
    <path d="M${cx-10} ${cy} Q${cx} ${cy-8} ${cx+10} ${cy}" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="5.5" fill="${eyeColor}"/>
    <circle cx="${cx}" cy="${cy}" r="4" fill="${eyeColor}" opacity="0.8"/>
    <circle cx="${cx-1.5}" cy="${cy-1.5}" r="2.4" fill="${glowColor}" opacity="0.95"/>
    <circle cx="${cx+1}" cy="${cy+1.5}" r="1" fill="${glowColor}" opacity="0.6"/>
    <path d="M${cx-12} ${cy+4} Q${cx} ${cy+12} ${cx+12} ${cy+4}" fill="none" stroke="${SD}" stroke-width="0.8" opacity="0.3"/>
    ${boss ? `<line x1="${cx-8}" y1="${cy-4}" x2="${cx+8}" y2="${cy+4}" stroke="#ff2040" stroke-width="0.6" opacity="0.5"/>` : ''}
  </g>`;
}

function cracks() {
  return `<g opacity="0.55">
    <line x1="78" y1="60" x2="88" y2="95" stroke="#400010" stroke-width="1.8"/>
    <line x1="130" y1="52" x2="124" y2="84" stroke="#400010" stroke-width="1.4"/>
    <line x1="100" y1="50" x2="100" y2="62" stroke="#400010" stroke-width="1.2"/>
    <line x1="65" y1="125" x2="85" y2="140" stroke="#400010" stroke-width="1"/>
    <circle cx="72" cy="115" r="1.8" fill="#ff2040" opacity="0.5"/>
    <circle cx="135" cy="105" r="1.5" fill="#ff2040" opacity="0.4"/>
    <circle cx="90" cy="145" r="1.2" fill="#ff2040" opacity="0.35"/>
  </g>`;
}

function horns() {
  return `<g>
    <path d="M76 48 Q68 12 58 -8 Q70 8 80 38 Z" fill="#1a0a12"/>
    <path d="M76 48 Q68 12 58 -8 Q66 14 78 40 Z" fill="#3a1020" opacity="0.5"/>
    <path d="M124 48 Q132 12 142 -8 Q130 8 120 38 Z" fill="#1a0a12"/>
    <path d="M124 48 Q132 12 142 -8 Q134 14 122 40 Z" fill="#3a1020" opacity="0.5"/>
  </g>`;
}

function bossAura() {
  return `<ellipse cx="100" cy="145" rx="76" ry="105" fill="none" stroke="#ff2040" stroke-width="1.4" opacity="0.22">
    <animate attributeName="rx" values="76;84;76" dur="2s" repeatCount="indefinite"/>
    <animate attributeName="ry" values="105;116;105" dur="2s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.22;0.40;0.22" dur="2s" repeatCount="indefinite"/>
  </ellipse>`;
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
