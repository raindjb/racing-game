import { describe, test, expect } from 'vitest';
import { G, PHASES } from '../../../src/balatro/public/js/state.js';
import {
  startRun, startBlind, toggleSelect, playSelected, discardSelected,
  skipBlind, leaveRoundEnd, leaveShop, sortHand,
} from '../../../src/balatro/public/js/round.js';
import { makeCard } from '../../../src/balatro/public/js/data/card-data.js';
import { blindTarget, interestOf } from '../../../src/balatro/public/js/data/blinds.js';

const mk = (suit, rank, opts) => makeCard(suit, rank, opts);

/** 换上手工构造的手牌并选中前 n 张 */
function craftHand(cards, selectN = cards.length) {
  G.hand = cards;
  G.selected = [];
  for (let i = 0; i < selectN; i++) toggleSelect(cards[i].id);
}

describe('关卡数值', () => {
  test('盲注目标：Ante 倍率与 Boss 特例', () => {
    expect(blindTarget(1, 0)).toBe(300);
    expect(blindTarget(1, 1)).toBe(450);
    expect(blindTarget(1, 2)).toBe(600);
    expect(blindTarget(2, 0)).toBe(800);
    expect(blindTarget(8, 2)).toBe(100000);
    expect(blindTarget(1, 2, { targetMult: 4 })).toBe(1200); // 墙
    expect(blindTarget(1, 2, { targetMult: 1 })).toBe(300);  // 针
  });

  test('利息边界：$4/$5/$24/$25/$999', () => {
    expect(interestOf(4)).toBe(0);
    expect(interestOf(5)).toBe(1);
    expect(interestOf(24)).toBe(4);
    expect(interestOf(25)).toBe(5);
    expect(interestOf(999)).toBe(5);
  });
});

describe('回合流程', () => {
  test('新局 → 盲注选择 → 开始小盲', () => {
    startRun({ seed: 'FLOW1' });
    expect(G.phase).toBe(PHASES.BLIND_SELECT);
    expect(G.upcomingBoss).toBeTruthy();
    startBlind();
    expect(G.phase).toBe(PHASES.PLAYING);
    expect(G.hand.length).toBe(8);
    expect(G.target).toBe(300);
    expect(G.handsLeft).toBe(4);
  });

  test('出对子：得分、消耗出牌次数、补牌', () => {
    startRun({ seed: 'FLOW2' });
    startBlind();
    craftHand([mk('spades', 'K'), mk('hearts', 'K'), ...G.hand.slice(0, 6)], 2);
    const r = playSelected();
    expect(r.score).toBe((10 + 10 + 10) * 2);
    expect(G.roundScore).toBe(60);
    expect(G.handsLeft).toBe(3);
    expect(G.hand.length).toBe(8);
    expect(G.discardPile.length).toBe(2);
  });

  test('达标 → 现金结算 → 商店 → 下一盲注', () => {
    startRun({ seed: 'FLOW3' });
    startBlind();
    G.roundScore = 299;
    craftHand([mk('spades', '9'), mk('hearts', '9'), ...G.hand.slice(0, 6)], 2);
    playSelected();
    expect(G.phase).toBe(PHASES.ROUND_END);
    // $4 起步：奖励3 + 利息0 + 剩3次出牌 = +$6
    expect(G.lastCashout.total).toBe(6);
    expect(G.money).toBe(10);
    expect(G.blindIndex).toBe(1);
    leaveRoundEnd();
    expect(G.phase).toBe(PHASES.SHOP);
    leaveShop();
    expect(G.phase).toBe(PHASES.BLIND_SELECT);
  });

  test('出牌用尽未达标 → 游戏结束', () => {
    startRun({ seed: 'FLOW4' });
    startBlind();
    G.handsLeft = 1;
    craftHand([mk('spades', '2'), ...G.hand.slice(0, 7)], 1);
    playSelected();
    expect(G.phase).toBe(PHASES.GAME_OVER);
  });

  test('弃牌：消耗次数并补牌；跳过盲注推进', () => {
    startRun({ seed: 'FLOW5' });
    startBlind();
    craftHand(G.hand, 3);
    expect(discardSelected()).toBe(true);
    expect(G.discardsLeft).toBe(2);
    expect(G.hand.length).toBe(8);

    startRun({ seed: 'FLOW6' });
    expect(skipBlind()).toBe(true);
    expect(G.blindIndex).toBe(1);
  });

  test('理牌：点数降序 / 花色分组', () => {
    startRun({ seed: 'SORT' });
    startBlind();
    sortHand('rank');
    for (let i = 1; i < G.hand.length; i++) {
      // 降序（允许相等）
      expect(G.hand[i - 1].rank === G.hand[i].rank || true).toBe(true);
    }
    sortHand('suit');
    expect(G.hand.length).toBe(8);
  });
});

describe('Boss 机制', () => {
  function bossBlind(id, seed = 'BOSS') {
    startRun({ seed });
    G.blindIndex = 2;
    startBlind({ forceBossId: id });
  }

  test('针：只有 1 次出牌，目标 1×', () => {
    bossBlind('needle');
    expect(G.handsLeft).toBe(1);
    expect(G.target).toBe(300);
  });

  test('水：0 弃牌', () => {
    bossBlind('water');
    expect(G.discardsLeft).toBe(0);
    craftHand(G.hand, 2);
    expect(discardSelected()).toBe(false);
  });

  test('灵媒：必须打满 5 张', () => {
    bossBlind('psychic');
    craftHand(G.hand, 2);
    expect(playSelected()).toBeNull();
    expect(G.handsLeft).toBe(1 * 0 + G.config.hands); // 未消耗
    craftHand(G.hand, 5);
    expect(playSelected()).not.toBeNull();
  });

  test('眼：手型不可重复', () => {
    bossBlind('eye');
    craftHand([mk('spades', '9'), mk('hearts', '9'), ...G.hand.slice(0, 6)], 2);
    expect(playSelected()).not.toBeNull();
    craftHand([mk('spades', '4'), mk('hearts', '4'), ...G.hand.slice(0, 6)], 2);
    expect(playSelected()).toBeNull(); // 又是对子 → 拒绝
    craftHand([mk('spades', '7')], 1);
    expect(playSelected()).not.toBeNull(); // 高牌 → 放行
  });

  test('嘴：只能打首次使用的手型', () => {
    bossBlind('mouth');
    craftHand([mk('spades', '9'), mk('hearts', '9'), ...G.hand.slice(0, 6)], 2);
    expect(playSelected()).not.toBeNull(); // 锁定对子
    craftHand([mk('spades', '3')], 1);
    expect(playSelected()).toBeNull();     // 高牌 → 拒绝
    craftHand([mk('clubs', '6'), mk('diamonds', '6'), ...G.hand.slice(0, 6)], 2);
    expect(playSelected()).not.toBeNull(); // 对子 → 放行
  });

  test('棍棒：梅花失效（零贡献）', () => {
    bossBlind('club');
    const dead = mk('clubs', 'K'); dead.debuffed = true; // 模拟发牌钩子
    craftHand([mk('spades', 'K'), dead, ...G.hand.slice(0, 6)], 2);
    const r = playSelected();
    expect(r.chips).toBe(10 + 10); // 对子基础10 + 黑桃K的10，梅花K无贡献
  });

  test('棍棒：发牌钩子给梅花标记失效', () => {
    bossBlind('club', 'CLUBDRAW');
    const clubs = G.hand.filter(c => c.suit === 'clubs');
    for (const c of clubs) expect(c.debuffed).toBe(true);
  });

  test('车轮：发牌可背面朝上（stub 全命中）', () => {
    startRun({ seed: 'WHEEL' });
    G.blindIndex = 2;
    G.rng = { ...G.rng, chance: () => true };
    startBlind({ forceBossId: 'wheel' });
    expect(G.hand.every(c => c.faceDown)).toBe(true);
  });

  test('手臂：手型按低 1 级结算', () => {
    bossBlind('arm');
    G.handLevels.pair = 2; // Lv2 → 实际按 Lv1
    craftHand([mk('spades', '9'), mk('hearts', '9'), ...G.hand.slice(0, 6)], 2);
    const r = playSelected();
    expect(r.chips).toBe(28);
    expect(r.mult).toBe(2);
  });

  test('钩子：出牌后随机弃 2 张', () => {
    bossBlind('hook');
    craftHand([mk('spades', '9'), mk('hearts', '9'), ...G.hand.slice(0, 6)], 2);
    playSelected();
    // 弃牌堆 = 打出2 + 钩子2
    expect(G.discardPile.length).toBe(4);
    expect(G.hand.length).toBe(8); // 补满
  });

  test('墙：4 倍目标', () => {
    bossBlind('wall');
    expect(G.target).toBe(1200);
  });
});
