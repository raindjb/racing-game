import { describe, test, expect } from 'vitest';
import '../../../src/balatro/public/js/effects/joker-effects.js'; // 注册全部 Joker
import { evalHand } from '../../../src/balatro/public/js/hand-eval.js';
import { scoreHand } from '../../../src/balatro/public/js/scoring.js';
import { getJokerHandlers } from '../../../src/balatro/public/js/effects/index.js';
import { makeCard, HAND_TYPES } from '../../../src/balatro/public/js/data/card-data.js';
import { JOKERS } from '../../../src/balatro/public/js/data/jokers.js';
import { makeJokerInstance, addJoker, sellJoker, sellValue, jokerSlotsOf } from '../../../src/balatro/public/js/joker-manager.js';
import { G, initRun } from '../../../src/balatro/public/js/state.js';

const mk = (suit, rank, opts) => makeCard(suit, rank, opts);
const J = (id, patch = {}) => Object.assign(makeJokerInstance(id), patch);

function ctxOf(cards, { jokers = [], held = [], levels = {}, rng, game = {} } = {}) {
  const ev = evalHand(cards);
  return {
    played: cards, scoring: ev.scoringCards, handType: ev.handType, handZh: ev.zh,
    handLevels: { ...Object.fromEntries(HAND_TYPES.map(h => [h.id, 1])), ...levels },
    levelDelta: 0, jokers, heldCards: held,
    rng: rng ?? { chance: () => false, random: () => 0.5, int: () => 0, pick: a => a[0] },
    game: { money: 0, handsLeft: 3, discardsLeft: 2, deckCount: 0, ante: 1,
            handPlayed: {}, jokerSlots: 5, totalDeckCount: 52, ...game },
  };
}
const pairOf9 = () => [mk('spades', '9'), mk('hearts', '9')]; // 基础: 28 筹 × 2 倍

describe('Joker 数据完整性', () => {
  test('52 张全部有已实现的效果原语（无 warn 缺口）', () => {
    for (const def of JOKERS) {
      const h = getJokerHandlers(def.id);
      expect(Object.keys(h).length, `${def.id} 未注册`).toBeGreaterThan(0);
    }
    expect(JOKERS.length).toBeGreaterThanOrEqual(50);
  });
});

describe('平铺/条件 原语', () => {
  test('小丑 +4 倍率', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('joker')] })).mult).toBe(6);
  });
  test('卡文迪什 ×3', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('cavendish')] })).mult).toBe(6);
  });
  test('贪婪小丑：逐张计分 ♦ +3', () => {
    const cards = [mk('diamonds', '9'), mk('diamonds', '9', {}), mk('hearts', '9')];
    expect(scoreHand(ctxOf(cards, { jokers: [J('greedy_joker')] })).mult).toBe(3 + 6);
  });
  test('快乐小丑：葫芦含对子 +8；高牌不触发', () => {
    const fh = [mk('spades', '8'), mk('hearts', '8'), mk('clubs', '8'), mk('diamonds', 'K'), mk('spades', 'K')];
    expect(scoreHand(ctxOf(fh, { jokers: [J('jolly_joker')] })).mult).toBe(4 + 8);
    expect(scoreHand(ctxOf([mk('spades', '7')], { jokers: [J('jolly_joker')] })).mult).toBe(1);
  });
  test('狡猾小丑：含对子 +50 筹码', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('sly_joker')] })).chips).toBe(78);
  });
  test('二重奏 ×2 / 全家福 ×4', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('the_duo')] })).mult).toBe(4);
    const quad = [mk('spades', 'J'), mk('hearts', 'J'), mk('clubs', 'J'), mk('diamonds', 'J')];
    expect(scoreHand(ctxOf(quad, { jokers: [J('the_family')] })).mult).toBe(7 * 4);
  });
});

describe('点数/人头 原语', () => {
  test('偶数史蒂文 / 奇数托德', () => {
    const evens = [mk('spades', '4'), mk('hearts', '4')];
    expect(scoreHand(ctxOf(evens, { jokers: [J('even_steven')] })).mult).toBe(2 + 8);
    const aceHigh = [mk('spades', 'A')];
    expect(scoreHand(ctxOf(aceHigh, { jokers: [J('odd_todd')] })).chips).toBe(5 + 11 + 31);
  });
  test('恐怖面孔：人头 +30 筹码/张', () => {
    const kings = [mk('spades', 'K'), mk('hearts', 'K')];
    expect(scoreHand(ctxOf(kings, { jokers: [J('scary_face')] })).chips).toBe(10 + 20 + 60);
  });
  test('斐波那契：A/2/3/5/8 +8 倍率', () => {
    const aces = [mk('spades', 'A'), mk('hearts', 'A')];
    expect(scoreHand(ctxOf(aces, { jokers: [J('fibonacci')] })).mult).toBe(2 + 16);
  });
  test('照片：仅首张人头 ×2', () => {
    const kings = [mk('spades', 'K'), mk('hearts', 'K')];
    expect(scoreHand(ctxOf(kings, { jokers: [J('photograph')] })).mult).toBe(4);
  });
});

describe('资源/状态 原语', () => {
  test('半张小丑 ≤3 张 +20', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('half_joker')] })).mult).toBe(22);
  });
  test('旗帜：每剩余弃牌 +30 筹', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('banner')], game: { discardsLeft: 2 } })).chips).toBe(28 + 60);
  });
  test('神秘山巅：0 弃牌 +15', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('mystic_summit')], game: { discardsLeft: 0 } })).mult).toBe(17);
  });
  test('错印：随机倍率（stub=7）', () => {
    const rng = { chance: () => false, int: () => 7, random: () => 0.5 };
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('misprint')], rng })).mult).toBe(9);
  });
  test('高举拳头：最小手持点值 ×2 入倍率', () => {
    const held = [mk('clubs', '3'), mk('clubs', 'K')];
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('raised_fist')], held })).mult).toBe(2 + 6);
  });
  test('抽象小丑：每 Joker +3', () => {
    const jokers = [J('abstract_joker'), J('joker')];
    expect(scoreHand(ctxOf(pairOf9(), { jokers })).mult).toBe(2 + 6 + 4);
  });
  test('蓝色小丑 / 公牛', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('blue_joker')], game: { deckCount: 40 } })).chips).toBe(28 + 80);
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('bull')], game: { money: 10 } })).chips).toBe(28 + 20);
  });
  test('小丑模板：空槽 ×（含自身）', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('joker_stencil')], game: { jokerSlots: 5 } })).mult).toBe(2 * 5);
  });
});

describe('成长型', () => {
  test('绿色小丑：出牌+1 / 弃牌-1', () => {
    const j = J('green_joker', { state: 3 });
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [j] })).mult).toBe(5);
    const h = getJokerHandlers('green_joker');
    h.onHandPlayed({}, {}, j); expect(j.state).toBe(4);
    h.onDiscard({}, [], j); h.onDiscard({}, [], j); expect(j.state).toBe(2);
  });
  test('超新星：+已打出次数(含本次)', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('supernova')], game: { handPlayed: { pair: 2 } } })).mult).toBe(2 + 3);
  });
  test('坐公车：人头计分则清零', () => {
    const j = J('ride_the_bus', { state: 2 });
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [j] })).mult).toBe(4);
    const h = getJokerHandlers('ride_the_bus');
    h.onHandPlayed({}, { scoringCards: [mk('spades', '5')] }, j); expect(j.state).toBe(3);
    h.onHandPlayed({}, { scoringCards: [mk('spades', 'K')] }, j); expect(j.state).toBe(0);
  });
  test('会员卡：第 6 次出牌 ×4', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('loyalty_card', { state: 5 })] })).mult).toBe(8);
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('loyalty_card', { state: 0 })] })).mult).toBe(2);
  });
});

describe('重触发 原语', () => {
  test('骇客：2/3/4/5 重复触发', () => {
    const twos = [mk('spades', '2'), mk('hearts', '2')];
    expect(scoreHand(ctxOf(twos, { jokers: [J('hack')] })).chips).toBe(10 + 8);
  });
  test('悲喜面具：人头重复触发', () => {
    const kings = [mk('spades', 'K'), mk('hearts', 'K')];
    expect(scoreHand(ctxOf(kings, { jokers: [J('sock_and_buskin')] })).chips).toBe(10 + 40);
  });
  test('黄昏：最后一次出牌重复触发', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('dusk')], game: { handsLeft: 0 } })).chips).toBe(10 + 36);
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('dusk')], game: { handsLeft: 2 } })).chips).toBe(28);
  });
  test('哑剧演员：手持钢铁触发两次', () => {
    const held = [mk('spades', 'K', { enhancement: 'steel' })];
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('mime')], held })).mult).toBe(4.5);
  });
});

describe('概率/花色组合', () => {
  test('血石：♥ 命中 ×1.5', () => {
    const rng = { chance: () => true, int: () => 0, random: () => 0.5 };
    const hearts = [mk('hearts', '9'), mk('hearts', '9', {})];
    const r = scoreHand(ctxOf(hearts, { jokers: [J('bloodstone')], rng }));
    expect(r.mult).toBe(2 * 1.5 * 1.5);
  });
  test('幻视：♣+其他花色 ×2；纯 ♣ 不触发', () => {
    const mixed = [mk('clubs', '9'), mk('spades', '9')];
    expect(scoreHand(ctxOf(mixed, { jokers: [J('seeing_double')] })).mult).toBe(4);
    const clubsOnly = [mk('clubs', '9'), mk('clubs', '9', {})];
    expect(scoreHand(ctxOf(clubsOnly, { jokers: [J('seeing_double')] })).mult).toBe(2);
  });
  test('黑板：手持全 ♠/♣ ×3', () => {
    const ok = [mk('spades', '3'), mk('clubs', '7')];
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('blackboard')], held: ok })).mult).toBe(6);
    const bad = [mk('hearts', '3')];
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('blackboard')], held: bad })).mult).toBe(2);
  });
  test('杂技演员：最后一手 ×3', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('acrobat')], game: { handsLeft: 0 } })).mult).toBe(6);
  });
});

describe('手持牌联动', () => {
  test('射月：手持 Q +13', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('shoot_the_moon')], held: [mk('hearts', 'Q')] })).mult).toBe(15);
  });
  test('男爵：手持 K ×1.5', () => {
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [J('baron')], held: [mk('hearts', 'K')] })).mult).toBe(3);
  });
});

describe('经济/被动（joker-manager 集成）', () => {
  test('黄金小丑回合末 +$4；鸡蛋累积出售价值', () => {
    expect(getJokerHandlers('golden_joker').onRoundEnd({}, J('golden_joker'))).toBe(4);
    const egg = J('egg');
    getJokerHandlers('egg').onRoundEnd({}, egg);
    expect(sellValue(egg)).toBe(1 + 3);
  });
  test('侠客：其余 Joker 出售价值和入倍率', () => {
    const others = [J('joker'), J('cavendish')]; // 卖价 $1 + $2
    const sw = J('swashbuckler');
    // 从左到右：侠客 2+3=5 → 小丑 +4=9 → 卡文迪什 ×3=27
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [sw, ...others] })).mult).toBe(27);
  });
  test('杂耍者/特技演员 被动改配置；出售恢复', () => {
    initRun({ seed: 'PASSIVE' });
    const jug = makeJokerInstance('juggler');
    expect(addJoker(G, jug)).toBe(true);
    expect(G.config.handSize).toBe(9);
    sellJoker(G, jug.uid);
    expect(G.config.handSize).toBe(8);

    const stunt = makeJokerInstance('stuntman');
    addJoker(G, stunt);
    expect(G.config.handSize).toBe(6);
    expect(scoreHand(ctxOf(pairOf9(), { jokers: [stunt] })).chips).toBe(28 + 250);
    expect(jokerSlotsOf(G)).toBe(5);
  });
});
