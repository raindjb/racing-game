// ui/score-popup.js — 结算逐步跳分：按 steps 日志重放，每步定位来源元素（卡牌/Joker/面板）
import { SFX } from '../audio/sfx.js';
import { floatText, scoreBurst, shakeScreen, SCORE_TIERS } from './notifications.js';

const $ = id => document.getElementById(id);

/**
 * 播放结算动画。steps 来自 scoring.js 的日志。
 * @param {Object} result scoreHand 返回值
 * @param {Function} onDone 动画结束回调（触发 resolveAfterScoring）
 */
export function playScoreAnimation(result, onDone) {
  const steps = result.steps;
  // 动态步长：多步压缩，总时长 ~1.2-2.6s
  const stepMs = Math.max(55, Math.min(170, Math.round(1900 / Math.max(1, steps.length))));
  let chips = 0, mult = 0, i = 0;

  const chipsEl = $('calc-chips'), multEl = $('calc-mult');
  const setCalc = () => {
    chipsEl.textContent = formatNum(chips);
    multEl.textContent = formatNum(mult);
  };

  const tick = () => {
    if (i >= steps.length) return finish();
    const s = steps[i];
    const anchor = anchorOf(s.source);

    switch (s.type) {
      case 'base':
        chips = s.chips; mult = s.mult;
        $('hand-type-label').textContent = s.label;
        pulse(chipsEl); pulse(multEl);
        SFX.chipTick(0);
        break;
      case 'chips':
        chips += s.value;
        pulse(chipsEl);
        SFX.chipTick(i % 8);
        if (anchor) { flashCard(anchor); floatAt(anchor, `+${s.value}`, 'chips'); }
        break;
      case 'mult':
        mult += s.value;
        pulse(multEl);
        SFX.multTick(i % 8);
        if (anchor) { flashCard(anchor); floatAt(anchor, `+${s.value} 倍率`, 'mult'); }
        break;
      case 'xmult':
        mult = Math.round(mult * s.value * 100) / 100;
        pulse(multEl);
        SFX.xmult();
        if (anchor) { flashCard(anchor); floatAt(anchor, `×${s.value}`, 'xmult'); }
        break;
      case 'money':
        SFX.money();
        if (anchor) floatAt(anchor, s.label, 'gold');
        break;
      case 'info':
        if (anchor) floatAt(anchor, s.label, s.label.includes('碎') ? 'red' : 'white');
        break;
    }
    setCalc();
    i++;
    setTimeout(tick, s.type === 'xmult' ? stepMs * 1.6 : stepMs);
  };

  const finish = () => {
    const pop = $('score-pop');
    pop.textContent = `+${result.score.toLocaleString()}`;
    const r0 = pop.getBoundingClientRect();
    // 分级爆发：赤橙黄绿青紫，越高越炸
    const tier = scoreBurst(r0.left + r0.width / 2, r0.top, result.score);
    pop.className = tier.cls;
    pop.classList.add('on');
    // 档位收场音效（0-6 递增华丽度）
    SFX.scoreFanfare(SCORE_TIERS.indexOf(tier));
    if (result.score >= 5000) shakeScreen(true);
    else if (result.score >= 800) shakeScreen(false);
    setTimeout(() => {
      pop.classList.remove('on');
      pop.className = '';            // 清除档位颜色残留
      onDone?.();
    }, 750);
  };

  tick();
}

function anchorOf(source) {
  if (!source) return null;
  if (source.kind === 'card' || source.kind === 'held') {
    return document.querySelector(`#played-zone [data-cid="${source.id}"]`) ??
           document.querySelector(`#hand-area [data-cid="${source.id}"]`);
  }
  if (source.kind === 'joker') {
    return document.querySelector(`#joker-row [data-juid="${source.id}"]`);
  }
  return $('calc-panel');
}

function flashCard(el) {
  el.classList.remove('score-flash', 'pulse');
  void el.offsetWidth;
  el.classList.add(el.classList.contains('j-card') ? 'pulse' : 'score-flash');
}

function floatAt(el, text, cls) {
  const r = el.getBoundingClientRect();
  floatText(text, r.left + r.width / 2 - 20, r.top - 14, cls);
}

function pulse(el) {
  el.classList.remove('calc-pulse');
  void el.offsetWidth;
  el.classList.add('calc-pulse');
}

function formatNum(n) {
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
}
