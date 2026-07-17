# 小丑牌（Balatro 复刻）— 游戏设计文档

> 状态：M1 实施中 · 来源：已批准计划 `.claude/plans/ticklish-yawning-lake.md` · 原型结论：`prototypes/balatro/README.md`

## 1. Overview

扑克 Roguelike：玩家从 52 张标准牌组抽 8 张手牌，打出 1-5 张组成扑克手型得分（筹码×倍率），在限定出牌次数内达到盲注目标分。通过商店购买小丑牌（被动效果）、塔罗牌（改造牌组）、星球牌（升级手型）构建 build，通关 8 个底注（Ante），每个底注含小盲/大盲/Boss 三关。

- 平台：浏览器（vanilla JS + Express :3457）
- 计分引擎数据移植自 [balatrolator](https://github.com/kleinfreund/balatrolator)（MIT）
- 全部视觉/音频程序化原创生成（无官方素材，规避版权）

## 2. Player Fantasy

"我是赌桌上的作弊之神"——用不断膨胀的倍率组合打出天文数字，把普通扑克玩成数值爆炸的机器。核心爽点：① 结算时逐张跳分的连锁反馈；② build 成型后一手牌秒杀 Boss；③ 商店里的抉择与赌博感。

## 3. Detailed Rules

### 回合流程
1. 盲注选择 → 进入回合，抽满 8 张手牌
2. 选 1-5 张 → 出牌（消耗 1 次出牌）或弃牌（消耗 1 次弃牌，补抽等量）
3. 结算：手型基础值 → 逐张计分牌（左→右）→ 手持牌效果 → Joker（左→右）→ chips×mult
4. 分数 ≥ 目标 → 过关结现金 → 商店；出牌用尽未达标 → 游戏结束
5. Boss 关有特殊规则（见 bosses.js）；通关 Ante 8 Boss → 胜利

### 资源
- 出牌 4 / 弃牌 3 / 手牌上限 8 / Joker 槽 5 / 消耗牌槽 2 / 起始 $4
- 商店：2 卡位 + 2 卡包 + 1 优惠券；重掷 $5 起每次 +$1

### 卡牌改造
- 强化(8)：奖励+30筹、多倍+4倍、万能全花色、玻璃×2倍(1/4碎)、钢铁×1.5倍(手持)、石牌+50筹无点花、黄金手持回合末+$3、幸运1/5+20倍·1/15+$20
- 版本(4)：闪箔+50筹、全息+10倍、多彩×1.5倍、负片+1 Joker 槽
- 蜡封(4)：红=重触发、金=打出+$3、蓝=回合末生成星球牌、紫=弃置时生成塔罗牌

## 4. Formulas

**得分** `score = floor(chips × mult)`
- chips = 手型基础筹码 + 等级×levelChips + Σ(牌面筹码 + 强化/版本筹码)
- mult = 手型基础倍率 + 等级×levelMult，经加法(+)与乘法(×)效果按结算顺序累积
- 变量域：M1 chips ∈ [5, ~5000]，mult ∈ [1, ~300]，score < 1e6（Number 安全）
- 例：一对(Lv1: 10筹×2倍) 打出 9♠9♥，其一全息：chips=10+9+9=28… 版本后 mult=2+10=12 → 28×12=336

**盲注目标** `target = anteBase[ante] × blindMult`
- anteBase = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000]（Ante 1-8）
- blindMult：小盲 1×、大盲 1.5×、Boss 2×（墙 4×、针 1× 特例）

**回合收入** `income = blindReward + min(5, floor(money/5)) + handsLeft`
- blindReward = $3/$4/$5（小/大/Boss）；例：$23 存款、剩 2 出牌过大盲 → 4+4+2 = $10

## 5. Edge Cases

- 5 张同点数（M2 五条）：M1 判定为四条（取最高 4 张计分牌规则不变）
- A-2-3-4-5 轮子顺：合法顺子；A-K-Q-J-10 皇家：显示"皇家同花顺"但手型=同花顺（等级/星球共用）
- 万能牌参与同花判定：视为任意花色，取多数花色
- 石牌：无点数无花色，不参与手型判定，永远计分 +50 筹
- 玻璃碎裂：结算后从牌组永久移除；牌组耗尽：弃牌堆不足补抽时，能抽几张抽几张，不重洗（与原作一致）
- 手型不可重复(眼 Boss)时打出重复手型：出牌被拒绝，不消耗次数
- 钱不够买卡：点击提示"资金不足"，交易不发生；Joker 槽满再买：提示，不扣款
- 利息边界：$4→$0利息，$5→$1，$24→$4，$25+→$5（封顶）

## 6. Dependencies

- `scoring.js` ← `hand-eval.js`（手型结果）、`effects/`（效果函数表）、`state.js`（等级/资源）、`rng.js`（概率效果）
- `round.js` ← `scoring.js`、`data/blinds.js`、`boss-effects.js`；被 `ui/render.js`、`shop.js` 监听
- `shop.js`/`boosters.js` ← `data/{jokers,tarots,planets,vouchers}.js`、`rng.js`；写回 `state.js`
- `ui/*` 只读 `state.js` + 订阅事件，不反向进入引擎；`audio/*` 同
- 后端 `modules/api.js` ← `modules/store.js`；前端 `save-client` fetch 失败降级 localStorage
- 反向声明：`state.js` 被上述所有模块依赖，其字段变更需同步 `serialize` 测试与 SAVE_VERSION

## 7. Tuning Knobs

| 旋钮 | 默认 | 安全范围 | 影响 |
|---|---|---|---|
| anteBase 表 | 300…50000 | ±30% | 整体难度曲线 |
| 出牌/弃牌次数 | 4/3 | 3-6 / 2-5 | 容错率与节奏 |
| 利息上限 | $5 | $3-$10 | 存钱策略强度 |
| 商店 Joker 价格带 | $2-$8 | ±$2 | build 成型速度 |
| 重掷起价/递增 | $5/+$1 | $3-$8 | 商店赌博倾向 |
| 玻璃碎裂概率 | 1/4 | 1/6-1/3 | 高风险强化收益 |
| 扇形最大角/弧深 | 40°/40px | 20-60°/20-60px | 手牌可读性（纯表现） |

## 8. Acceptance Criteria（QA 可验证）

1. `npx vitest run tests/unit/balatro/` 全绿：手型边界（A-5、皇家=同花顺、万能牌）、结算顺序（红封重触发、注入 RNG 的玻璃/幸运）、50 Joker 逐条、利息四个边界值、seeded RNG 同种子同序列、存档往返深等于
2. `node src/balatro/server.js` 启动后 http://localhost:3457 可完整打通：新游戏→Ante 1 小盲→商店购卡→卡包开启→Boss 关规则生效→失败/胜利结算画面
3. 手牌 8 张扇形排布且相互遮挡，拖拽可重排、松手落位、悬停 3D 倾斜、选中上浮发光
4. 出牌结算逐张跳分动画与音效同步；背景着色器动态渲染（无 WebGL 时降级渐变不报错）
5. 关闭服务器纯静态打开仍可游玩（localStorage 存档）；重启服务器后 /api/runs 可恢复进行中对局
