// dealer.js — 发牌员角色：SVG 头像 + 对话系统 + 语调合成 + Boss 崩坏
import { bus, G, PHASES } from './state.js';
import { ac } from './audio/sfx.js';

// ===== 对话库 =====
const LINES = {
  // 打出手型
  hand_played: [
    ['high_card',    [['高牌？', 'neutral'], ['就这？', 'smirk'], ['勉强拿分吧', 'neutral']]],
    ['pair',         [['一对！', 'happy'], ['小对子，还行', 'neutral'], ['对子也敢出？', 'smirk']]],
    ['two_pair',     [['两对，不错', 'happy'], ['稳步前进', 'neutral']]],
    ['three_of_a_kind', [['三条！漂亮', 'happy'], ['三条来咯', 'excited']]],
    ['straight',     [['顺子！', 'excited'], ['一气呵成！', 'excited']]],
    ['flush',        [['同花！', 'excited'], ['全是♥', 'happy'], ['同花顺眼', 'neutral']]],
    ['full_house',   [['葫芦！大牌！', 'excited'], ['满堂红！', 'excited']]],
    ['four_of_a_kind', [['四条！！！', 'amazed'], ['四张一样的！', 'amazed']]],
    ['straight_flush',[['同花顺！！！', 'amazed'], ['你疯了吧！', 'amazed']]],
    ['five_of_a_kind',[['五……五条？！', 'shocked'], ['作弊了吧！', 'shocked']]],
    ['flush_house',  [['同花葫芦？！', 'shocked'], ['这是什么神仙牌！', 'shocked']]],
    ['flush_five',   [['同花五条！！!', 'shocked'], ['不可能！不可能！', 'shocked']]],
  ],
  // 得分高低
  score: [
    ['big',  [['大分数！', 'amazed'], ['这手值钱！', 'excited'], ['钱包鼓了！', 'happy']]],
    ['mid',  [['还行还行', 'neutral'], ['够过关了', 'neutral']]],
    ['low',  [['有点悬啊', 'worried'], ['这点分不太够', 'worried'], ['再想想？', 'smirk']]],
  ],
  // 通关 / 失败
  round_won: [['漂亮！', 'happy'], ['一回合拿下！', 'excited'], ['稳！', 'neutral']],
  round_lost: [['可惜了', 'sad'], ['运气不太好', 'worried'], ['下次加油', 'sad']],
  run_won: [['通关了！！！', 'shocked'], ['你是传奇！', 'amazed'], ['不可思议', 'shocked']],
  run_lost: [['游戏结束', 'sad'], ['下次再来', 'neutral'], ['可惜可惜', 'sad']],
  // 商店
  shop_enter: [['看看有什么好东西', 'neutral'], ['逛街时间到', 'happy'], ['花钱要谨慎', 'smirk']],
  shop_buy: [['好眼光！', 'happy'], ['值！', 'excited'], ['这笔交易不错', 'neutral']],
  shop_skip: [['再看看别的？', 'neutral'], ['不急不急', 'neutral']],
  // 资金
  money_low: [['钱不多了', 'worried'], ['省着点花', 'neutral']],
  money_high: [['财大气粗！', 'happy'], ['有钱任性！', 'excited']],
  // Joker 相关
  joker_bought: [['新伙伴来了！', 'happy'], ['他会帮你的', 'neutral'], ['有趣的组合', 'smirk']],
  joker_sold: [['再见老朋友', 'sad'], ['卖了就卖了', 'neutral']],
  // Boss
  boss_enter: [['他来了……', 'boss'], ['小心这家伙', 'boss'], ['不太对劲……', 'boss'], ['嘿嘿嘿嘿……', 'boss'], ['你觉得你能赢？', 'boss'], ['放弃吧……', 'boss']],
  // 通用
  idle: [['嗯……', 'neutral'], ['下一手怎么打？', 'neutral'], ['仔细想想', 'neutral']],
};

// 表情映射
const EXPRESSIONS = {
  neutral:  { eyes: 'normal', mouth: 'flat',   brow: 'flat' },
  happy:    { eyes: 'happy',  mouth: 'smile',  brow: 'raised' },
  excited:  { eyes: 'wide',   mouth: 'open',   brow: 'raised' },
  amazed:   { eyes: 'wide',   mouth: 'bigO',   brow: 'high' },
  smirk:    { eyes: 'half',   mouth: 'smirk',  brow: 'asym' },
  worried:  { eyes: 'normal', mouth: 'frown',  brow: 'worried' },
  sad:      { eyes: 'sad',    mouth: 'frown',  brow: 'sad' },
  shocked:  { eyes: 'xsmall', mouth: 'bigO',   brow: 'high' },
  boss:     { eyes: 'crack',  mouth: 'grin',   brow: 'evil' },
};

let container = null;
let bubble = null;
let bubbleTimer = null;
let faceEl = null;
let dealerGain = null;
let lastPhase = null;
let idleTimer = null;

export function initDealer() {
  // 创建发牌员容器
  container = document.createElement('div');
  container.id = 'dealer';
  container.innerHTML = `
    <div id="dealer-bubble" class="dealer-bubble"></div>
    <div id="dealer-face">${renderFace('neutral')}</div>
  `;
  document.getElementById('board')?.appendChild(container);

  bubble = document.getElementById('dealer-bubble');
  faceEl = document.getElementById('dealer-face');

  // 事件监听
  bus.on('hand:played', onHandPlayed);
  bus.on('phase', ({ phase }) => {
    // 浮层遮罩时隐藏发牌员（z-index 低于 overlay-backdrop 的 300）
    if (phase === PHASES.MENU || phase === PHASES.BLIND_SELECT || phase === PHASES.SHOP ||
        phase === PHASES.BOOSTER || phase === PHASES.ROUND_END || phase === PHASES.GAME_OVER || phase === PHASES.WIN) {
      container.style.zIndex = '5';
    } else {
      container.style.zIndex = '10';
    }
  });
  bus.on('round:won', () => say(LINES.round_won));
  bus.on('run:won', () => { say(LINES.run_won); setExpression('amazed'); });
  bus.on('run:lost', () => { say(LINES.run_lost); setExpression('sad'); });
  bus.on('shop:enter', () => say(LINES.shop_enter));
  bus.on('jokers:change', () => {
    if (G.phase === PHASES.SHOP) say(LINES.joker_bought);
  });
  bus.on('blind:start', ({ boss }) => {
    if (boss) {
      setExpression('boss');
      say(LINES.boss_enter);
    } else {
      setExpression('neutral');
    }
  });
  bus.on('phase', ({ phase }) => {
    if (phase === PHASES.BLIND_SELECT && lastPhase === PHASES.BOSS) {
      setExpression('neutral');  // Boss 结束恢复
    }
    if (phase === PHASES.PLAYING && !idleTimer) {
      startIdle();
    }
    if (phase !== PHASES.PLAYING) {
      stopIdle();
    }
    lastPhase = phase;
  });

  // 点击发牌员随机对话
  container.addEventListener('click', () => say(LINES.idle));
}

function onHandPlayed({ result }) {
  const handLine = LINES.hand_played.find(([id]) => id === result.handType);
  if (handLine) say(handLine[1]);
  // 分数反应
  const ante = G.ante;
  const target = G.target;
  if (result.score >= target * 2) say(LINES.score.find(([t]) => t === 'big')[1]);
  else if (result.score >= target * 0.5) say(LINES.score.find(([t]) => t === 'mid')[1]);
  else say(LINES.score.find(([t]) => t === 'low')[1]);
  // 资金反应
  if (G.money <= 3) say(LINES.money_low);
  if (G.money >= 25) say(LINES.money_high);
}

function startIdle() {
  stopIdle();
  idleTimer = setInterval(() => {
    if (Math.random() < 0.15) say(LINES.idle);
  }, 15000);
}
function stopIdle() { clearInterval(idleTimer); idleTimer = null; }

// ===== 对话显示 =====
function say(lineList) {
  if (!lineList?.length) return;
  const [text, expr] = lineList[Math.floor(Math.random() * lineList.length)];
  showBubble(text);
  setExpression(expr);
  speak(text);
  // 表情持续 3 秒后恢复
  clearTimeout(bubbleTimer);
  if (expr !== 'boss') {
    bubbleTimer = setTimeout(() => setExpression('neutral'), 3000);
  }
}

function showBubble(text) {
  if (!bubble) return;
  bubble.textContent = text;
  bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 3200);
}

// ===== SVG 面部渲染 =====
function renderFace(exprKey) {
  const e = EXPRESSIONS[exprKey] ?? EXPRESSIONS.neutral;
  const isBoss = exprKey === 'boss';
  const skinColor = isBoss ? '#4a3038' : '#d4a574';
  const hairColor = isBoss ? '#1a0a10' : '#3a2010';

  // 眼睛
  let eyes;
  switch (e.eyes) {
    case 'normal': eyes = `<ellipse cx="31" cy="52" rx="5" ry="6" fill="#1a1a1a"/><ellipse cx="68" cy="52" rx="5" ry="6" fill="#1a1a1a"/><circle cx="33" cy="50" r="1.8" fill="#fff"/><circle cx="70" cy="50" r="1.8" fill="#fff"/>`; break;
    case 'happy':  eyes = `<path d="M26 52 Q31 46 36 52" fill="none" stroke="#1a1a1a" stroke-width="2.6"/><path d="M63 52 Q68 46 73 52" fill="none" stroke="#1a1a1a" stroke-width="2.6"/>`; break;
    case 'wide':   eyes = `<circle cx="31" cy="52" r="7" fill="#1a1a1a"/><circle cx="68" cy="52" r="7" fill="#1a1a1a"/><circle cx="33" cy="50" r="2.6" fill="#fff"/><circle cx="70" cy="50" r="2.6" fill="#fff"/>`; break;
    case 'half':   eyes = `<ellipse cx="31" cy="52" rx="5" ry="3.5" fill="#1a1a1a"/><ellipse cx="68" cy="52" rx="5" ry="3.5" fill="#1a1a1a"/>`; break;
    case 'sad':    eyes = `<ellipse cx="31" cy="53" rx="4" ry="5" fill="#1a1a1a"/><ellipse cx="68" cy="53" rx="4" ry="5" fill="#1a1a1a"/>`; break;
    case 'xsmall': eyes = `<circle cx="31" cy="52" r="2.5" fill="#1a1a1a"/><circle cx="68" cy="52" r="2.5" fill="#1a1a1a"/>`; break;
    case 'crack':  eyes = `<ellipse cx="31" cy="52" rx="6" ry="7" fill="#ff2040"/><ellipse cx="68" cy="52" rx="6" ry="7" fill="#ff2040"/><circle cx="31" cy="52" r="1.5" fill="#ff0"/><circle cx="68" cy="52" r="1.5" fill="#ff0"/><line x1="24" y1="48" x2="38" y2="56" stroke="#1a0000" stroke-width="1.2"/><line x1="61" y1="48" x2="75" y2="56" stroke="#1a0000" stroke-width="1.2"/>`; break;
  }

  // 嘴
  let mouth;
  switch (e.mouth) {
    case 'flat':  mouth = `<line x1="38" y1="72" x2="61" y2="72" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round"/>`; break;
    case 'smile': mouth = `<path d="M38 72 Q49.5 82 61 72" fill="none" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round"/>`; break;
    case 'open':  mouth = `<ellipse cx="49.5" cy="74" rx="6" ry="5" fill="#2a1a1a"/>`; break;
    case 'frown': mouth = `<path d="M38 78 Q49.5 70 61 78" fill="none" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round"/>`; break;
    case 'smirk': mouth = `<path d="M38 72 Q49 78 61 69" fill="none" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round"/>`; break;
    case 'bigO':  mouth = `<ellipse cx="49.5" cy="73" rx="8" ry="7" fill="#2a1a1a"/>`; break;
    case 'grin':  mouth = `<path d="M34 68 Q49.5 86 65 68" fill="none" stroke="#ff2040" stroke-width="2.5" stroke-linecap="round"/><line x1="36" y1="72" x2="63" y2="72" stroke="#ff2040" stroke-width="0.8" opacity="0.5"/>`; break;
  }

  // 眉毛
  let brows;
  switch (e.brow) {
    case 'flat':   brows = `<line x1="25" y1="43" x2="37" y2="43" stroke="#2a1a10" stroke-width="2.2"/><line x1="62" y1="43" x2="74" y2="43" stroke="#2a1a10" stroke-width="2.2"/>`; break;
    case 'raised': brows = `<line x1="25" y1="41" x2="37" y2="42" stroke="#2a1a10" stroke-width="2.2"/><line x1="62" y1="42" x2="74" y2="41" stroke="#2a1a10" stroke-width="2.2"/>`; break;
    case 'high':   brows = `<path d="M25 39 Q31 36 37 39" fill="none" stroke="#2a1a10" stroke-width="2.2"/><path d="M62 39 Q68 36 74 39" fill="none" stroke="#2a1a10" stroke-width="2.2"/>`; break;
    case 'asym':   brows = `<line x1="25" y1="42" x2="37" y2="41" stroke="#2a1a10" stroke-width="2.2"/><line x1="62" y1="44" x2="74" y2="42" stroke="#2a1a10" stroke-width="2.2"/>`; break;
    case 'worried': brows = `<line x1="26" y1="45" x2="37" y2="42" stroke="#2a1a10" stroke-width="2.2"/><line x1="62" y1="42" x2="73" y2="45" stroke="#2a1a10" stroke-width="2.2"/>`; break;
    case 'sad':     brows = `<line x1="26" y1="45" x2="37" y2="44" stroke="#2a1a10" stroke-width="2.2"/><line x1="62" y1="44" x2="73" y2="45" stroke="#2a1a10" stroke-width="2.2"/>`; break;
    case 'evil':    brows = `<line x1="23" y1="41" x2="40" y2="45" stroke="#2a1a10" stroke-width="2.8"/><line x1="59" y1="45" x2="76" y2="41" stroke="#2a1a10" stroke-width="2.8"/>`; break;
  }

  // Boss 裂纹+血迹
  const bossCracks = isBoss ? `
    <line x1="20" y1="15" x2="30" y2="35" stroke="#1a0000" stroke-width="1.5" opacity="0.6"/>
    <line x1="55" y1="10" x2="50" y2="30" stroke="#1a0000" stroke-width="1.2" opacity="0.5"/>
    <line x1="40" y1="5" x2="42" y2="22" stroke="#1a0000" stroke-width="1" opacity="0.5"/>
    <path d="M15 60 L18 58 L17 62 Z" fill="#ff2040" opacity="0.5"/>
  ` : '';

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="dealer-svg">
    <defs><radialGradient id="ds" cx="0.5" cy="0.45" r="0.55">
      <stop offset="0" stop-color="${skinColor}"/><stop offset="1" stop-color="${isBoss ? '#2a1820' : '#b8845c'}"/>
    </radialGradient></defs>
    <!-- 头发 -->
    <ellipse cx="50" cy="24" rx="34" ry="26" fill="${hairColor}"/>
    ${isBoss ? '<ellipse cx="50" cy="22" rx="32" ry="24" fill="none" stroke="#ff2040" stroke-width="0.8" opacity="0.4"/>' : ''}
    <!-- 脸 -->
    <ellipse cx="50" cy="54" rx="28" ry="30" fill="url(#ds)"/>
    ${bossCracks}
    <!-- 耳朵 -->
    <ellipse cx="20" cy="52" rx="6" ry="9" fill="${skinColor}"/>
    <ellipse cx="80" cy="52" rx="6" ry="9" fill="${skinColor}"/>
    ${eyes}
    ${brows}
    <!-- 鼻子 -->
    <ellipse cx="49.5" cy="63" rx="4" ry="3.2" fill="${isBoss ? '#3a2028' : '#c49464'}"/>
    ${mouth}
    <!-- Boss 角 -->
    ${isBoss ? `<path d="M28 20 L22 2 L32 12 Z" fill="#3a1010"/><path d="M72 20 L78 2 L68 12 Z" fill="#3a1010"/>` : ''}
    <!-- 衣领 -->
    <path d="M28 84 L22 96 L50 88 L78 96 L72 84" fill="${isBoss ? '#2a1020' : '#4a2a18'}"/>
    <rect x="22" y="75" width="56" height="11" rx="5" fill="${isBoss ? '#301828' : '#5a3a24'}"/>
  </svg>`;
}

function setExpression(key) {
  if (!faceEl) return;
  faceEl.innerHTML = renderFace(key);
}

// ===== 语音合成（程序化“语调”，不录真声） =====
function speak(text) {
  try {
    const c = ac();
    if (!dealerGain) {
      dealerGain = c.createGain();
      dealerGain.gain.value = 0.06;
      dealerGain.connect(c.destination);
    }
    const t = c.currentTime;
    const len = text.length;
    const dur = Math.min(1.2, len * 0.06);  // 每字符 ~60ms

    // 语调：频率在 200-450Hz 之间波动，模拟说话音高
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, t);

    // 根据文本长度模拟自然语调曲线（升→持→降）
    const mid = t + dur * 0.35;
    o.frequency.linearRampToValueAtTime(320 + (Math.random() - 0.5) * 100, mid);
    o.frequency.linearRampToValueAtTime(180 + (Math.random() - 0.5) * 60, t + dur);

    // 共振峰滤波（模拟口腔形状）
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 600; f1.Q.value = 8;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1400; f2.Q.value = 6;
    const f3 = c.createBiquadFilter(); f3.type = 'bandpass'; f3.frequency.value = 2400; f3.Q.value = 4;

    const g = c.createGain();
    // 音量包络：快速起 → 保持 → 渐弱
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.8, t + 0.02);
    g.gain.setValueAtTime(0.7, mid);
    g.gain.linearRampToValueAtTime(0.001, t + dur + 0.04);

    o.connect(f1); f1.connect(f2); f2.connect(f3); f3.connect(g);
    g.connect(dealerGain);
    o.start(t); o.stop(t + dur + 0.05);
  } catch (e) { /* audio unavailable */ }
}
