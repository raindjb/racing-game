# 小丑牌 · Balatro 复刻（M1）

> 扑克 Roguelike：出牌组手型得分（筹码 × 倍率），用小丑牌/塔罗牌/星球牌构建 build，通关 8 个底注。
> 前端 vanilla JS（零依赖、零素材文件，全程序化生成），后端 Express。

## 运行

```bash
cd src/balatro
npm install        # 仅 express
npm start          # http://localhost:3457
```

不启动服务器也能玩：直接用任意静态服务器托管 `public/`（存档自动降级 localStorage）。

## 测试

```bash
# 仓库根目录
npx vitest run tests/unit/balatro/    # 123 个单测
```

## M1 内容

| 系统 | 规模 |
|---|---|
| 手型 | 12 种（含 3 秘密手型判定）+ 星球等级 |
| 计分 | 完整原作结算顺序：基础→逐张（强化/版本/蜡封/重触发）→手持→Joker 左→右 |
| Joker | 52 张（数据驱动效果编译器，M2 扩展只加数据） |
| 塔罗 | 全 22 张 |
| 星球 | 全 12 张（秘密星球需解锁） |
| Boss | 10 个（钩子/墙/眼/嘴/车轮/手臂/棍棒/灵媒/水/针） |
| 商店 | 2 卡位 + 2 卡包（标准/奥术/天体/小丑）+ 优惠券 8 张 + 重掷 |
| 强化/版本/蜡封 | 8 / 4 / 4，全部生效 |
| 存档 | REST API（`/api/runs`、`/api/stats`）+ localStorage 兜底 + 自动存档 |
| 表现 | 自写 GLSL 漩涡背景、扇形遮挡手牌、拖拽理牌、悬停 3D、逐张跳分、版本闪箔/镭射/多彩 CSS、粒子/震屏/CRT |
| 音频 | 30 个合成音效 + 原创 lo-fi 循环音乐引擎（摇摆鼓/黑胶噪声，Boss 变奏） |

## 操作

| 操作 | 方式 |
|---|---|
| 选牌 | 点击 / 数字键 1-8（最多 5 张） |
| 出牌 / 弃牌 | 按钮 / Enter·空格 / D |
| 理牌 | 按钮 / R（点数）S（花色）/ 拖拽自由排序 |
| 牌型等级面板 | 按钮 / Tab |
| 使用消耗牌 | 点击槽位中的塔罗/星球（需要目标时先选中手牌） |
| 出售 | 右键 Joker / 消耗牌 |
| 商店 | 点击购买，Esc 离开 |

## 架构

```
public/js/
├── 引擎（纯逻辑，可 Node 测试）: state / deck / rng / hand-eval / scoring /
│   effects/ / data/ / round / shop / boss-effects / joker-manager /
│   consumable-manager / serialize
├── ui/: render / hand-layout / card-dom / drag / hover-3d / score-popup /
│   hand-panel / notifications / keyboard
├── audio/: sfx / music / hooks
├── svg/: card-face / joker-art        # 52 张牌面 + Joker 卡面程序化生成
└── shaders/: background               # 自写 GLSL 漩涡（WebGL 不可用降级 CSS）
modules/: store（JSON 落盘）/ api（REST）
```

设计文档：`design/gdd/balatro-gdd.md`（含公式、边界、验收标准）。

## 归属与版权

- 计分数据模型与结算顺序参考 [Balatrolator](https://github.com/kleinfreund/balatrolator)
  （Copyright © Philipp Rudloff，**MIT License**），移植为 vanilla JS。
- 全部美术（SVG 牌面/Joker 卡面/背景着色器）与音乐（合成引擎）为本项目原创程序化生成，
  未使用 Balatro 官方素材。本项目为玩法学习复刻，与 LocalThunk/Playstack 无关。

## 已知限制 / 路线图

- 卡包开启中退出不落档（会损失已买卡包）
- M2：补满 150 Joker、18 幻灵牌、全 28 Boss、24 标签、全 32 优惠券、秘密手型星球投放
- M3：15 套牌、8 赌注、无尽模式（decimal 大数）、种子每日挑战、排行榜
