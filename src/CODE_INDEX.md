# 轨道跑者 — Rail Runner 代码索引

> 基于 ~/src/index.html 全部 2030 行源码分析生成。

---

## 1. 全局结构

### 全局命名空间 G（行 40-102）

| 属性 | 类型 | 用途 |
|------|------|------|
| `G.canvas` | HTMLCanvasElement | 画布元素 |
| `G.ctx` | CanvasRenderingContext2D | 绘图上下文 |
| `G.W, G.H` | number | 画布宽高（CSS 像素） |
| `G.state` | string | 游戏状态：'start' / 'playing' / 'dead' |
| `G.score` | number | 当前分数 |
| `G.highScore` | number | 最高分（localStorage 持久化） |
| `G.coinScore` | number | 累计金币分数 |
| `G.distance` | number | 已跑距离（米） |
| `G.speed` | number | 当前速度 |
| `G.hearts` | number | 剩余生命 |
| `G.invincible` | number | 无敌剩余帧数 |
| `G.player` | object | 玩家对象 |
| `G.obstacles` | array | 障碍物对象池 |
| `G.coins` | array | 金币对象池 |
| `G.particles` | array | 粒子对象池 |
| `G.powerups` | array | 道具对象池 |
| `G.keys` | object | 键盘按键状态 |
| `G.swipeStart` | object | 触屏滑动起点 |
| `G.lastSwipe` | string | 最后滑动方向 |
| `G.shakeX, G.shakeY` | number | 屏幕震动偏移 |
| `G.shakeDuration` | number | 震动剩余帧数 |
| `G.flashAlpha` | number | 红色闪屏透明度 |
| `G.vanishY, G.vanishX` | number | 透视消失点坐标 |
| `G.maxDist` | number | 最大可视距离（1200） |
| `G.laneSpread` | number | 轨道底部扩散宽度 |
| `G.groundY` | number | 玩家地面 Y 坐标 |
| `G.spawnTimer` | number | 障碍物生成计时器 |
| `G.spawnInterval` | number | 生成帧间隔 |
| `G.coinTimer` | number | 金币生成计时器 |
| `G.laneCooldown` | number | 换道冷却帧数 |
| `G.lastTime` | number | 上一帧时间戳 |
| `G.deltaTime` | number | 帧间隔（ms） |
| `G.fps` | number | 当前 FPS |
| `G.frameCount` | number | 总帧数 |
| `G.offscreen` | object | 预渲染离屏画布缓存 |
| `G.audioCtx` | AudioContext | Web Audio 上下文 |
| `G.audioReady` | boolean | 音效是否就绪 |

### 常量列表

| 常量名 | 行号 | 值 | 用途 |
|--------|------|-----|------|
| `LANE_COUNT` | 105 | 3 | 轨道数量 |
| `PLAYER_LANE` | 106 | 1 | 玩家初始轨道（中） |
| `MAX_HEARTS` | 107 | 3 | 最大生命值 |
| `INVINCIBLE_FRAMES` | 108 | 90 | 无敌帧数（1.5秒@60fps） |
| `BASE_SPEED` | 109 | 1.2 | 初始速度 |
| `MAX_SPEED` | 110 | 3 | 最大速度 |
| `SPEED_INC` | 111 | 0.00025 | 每帧加速量 |
| `DISTANCE_PER_FRAME` | 112 | 0.6 | 每帧距离增量 |
| `COIN_SCORE` | 113 | 50 | 单个金币分数 |
| `DISTANCE_SCORE` | 114 | 1 | 每米分数 |
| `STATE_RUN` | 117 | 'run' | 玩家状态：奔跑 |
| `STATE_JUMP` | 118 | 'jump' | 玩家状态：跳跃 |
| `STATE_SLIDE` | 119 | 'slide' | 玩家状态：滑铲 |
| `STATE_HIT` | 120 | 'hit' | 玩家状态：受击 |
| `OBS_LOW` | 123 | 'low' | 障碍物类型：低（滑铲通过） |
| `OBS_MID` | 124 | 'mid' | 障碍物类型：中（跳跃通过） |
| `OBS_HIGH` | 125 | 'high' | 障碍物类型：高（必须换道） |
| `PUP_MAGNET` | 128 | 'magnet' | 道具：磁铁 |
| `PUP_SHIELD` | 129 | 'shield' | 道具：护盾 |
| `PUP_2X` | 130 | '2x' | 道具：双倍分数 |
| `POWERUP_DURATION` | 132 | 480 | 道具持续时间（8秒@60fps） |
| `MAGNET_RANGE` | 133 | 1.5 | 磁铁吸金币范围 |

### 函数列表

| 函数名 | 行号 | 功能 |
|--------|------|------|
| `lerp(a, b, t)` | 136 | 线性插值 |
| `clamp(v, lo, hi)` | 137 | 数值钳制 |
| `randInt(min, max)` | 138 | 随机整数 |
| `randChoice(arr)` | 139 | 随机选择数组元素 |
| `initAudio()` | 143 | 初始化 AudioContext |
| `playSound(freq, type, duration, vol, options)` | 154 | 播放合成音效 |
| `playNoise(duration, vol, filterFreq)` | 174 | 播放噪音音效 |
| `sfxJump()` | 205 | 跳跃音效 |
| `sfxSlide()` | 209 | 滑铲音效 |
| `sfxCoin()` | 213 | 金币音效 |
| `sfxHurt()` | 231 | 受伤音效 |
| `sfxDeath()` | 250 | 死亡音效 |
| `sfxPowerup()` | 270 | 道具音效 |
| `worldToScreen(dist)` | 290 | 世界深度→屏幕 Y + 缩放 |
| `laneX(laneIdx, dist)` | 301 | 轨道索引→屏幕 X |
| `init()` | 309 | 初始化（画布、输入、预渲染、启动循环） |
| `resize()` | 369 | 窗口尺寸变化处理 |
| `preRenderAssets()` | 393 | 预渲染所有离屏资源 |
| `drawGraffitiTag(ctx, x, y, w, h)` | 523 | 绘制随机涂鸦标签 |
| `drawSpritePose(ctx, pose)` | 630 | 绘制单帧角色姿态 |
| `drawLimb(ctx, ox, oy, a1, a2, l1, l2, c1, c2, w1, w2)` | 769 | 绘制肢体（IK 两段式） |
| `footPos(ox, oy, a1, a2, l1, l2)` | 781 | 计算脚部位置 |
| `armPos(ox, oy, a1, a2, l1, l2)` | 791 | 计算手部位置 |
| `thickLine(ctx, x1, y1, x2, y2, w, c)` | 800 | 绘制粗线条（圆角） |
| `drawShoe(ctx, x, y, ang)` | 817 | 绘制鞋子 |
| `preRenderPlayerSprites()` | 888 | 预渲染全部玩家精灵帧 |
| `drawObstacleSprite(ctx, type, w, h)` | 907 | 绘制障碍物精灵（预渲染用） |
| `drawCoinSprite(ctx, w, h)` | 944 | 绘制金币精灵 |
| `poolGet(pool, factory)` | 957 | 对象池获取 |
| `poolReleaseAll(pool)` | 967 | 对象池全部释放 |
| `createPlayer()` | 972 | 创建玩家对象 |
| `createObstacle(lane, type, dist)` | 995 | 创建障碍物对象 |
| `createCoin(lane, dist)` | 1005 | 创建金币对象 |
| `createPowerup(lane, type, dist)` | 1015 | 创建道具对象 |
| `createParticle(x, y, vx, vy, life, color)` | 1027 | 创建粒子对象 |
| `startGame()` | 1037 | 开始游戏（重置状态） |
| `restartGame()` | 1058 | 重新开始 |
| `die()` | 1062 | 玩家死亡处理 |
| `hurtPlayer(damage)` | 1086 | 玩家受伤处理 |
| `processInput()` | 1112 | 输入处理（键盘+触屏） |
| `update()` | 1160 | 游戏逻辑更新（主更新函数） |
| `sameLane(obs)` | 1386 | 碰撞检测：同轨道判断 |
| `spawnObstacle()` | 1391 | 生成障碍物 |
| `spawnCoinRow()` | 1422 | 生成金币行 |
| `spawnPowerup()` | 1433 | 生成道具 |
| `applyPowerup(p, type)` | 1444 | 应用道具效果 |
| `cleanupPool(pool)` | 1453 | 对象池清理（空实现） |
| `render()` | 1459 | 主渲染函数 |
| `drawGround(ctx)` | 1589 | 绘制地面 |
| `drawTracks(ctx)` | 1616 | 绘制轨道 |
| `drawObstacle(ctx, obs, sx, sy, scale)` | 1658 | 绘制障碍物（运行时） |
| `drawCoin(ctx, coin, sx, sy, scale)` | 1719 | 绘制金币（运行时） |
| `drawPowerup(ctx, pu, sx, sy, scale)` | 1735 | 绘制道具 |
| `drawPlayer(ctx)` | 1758 | 绘制玩家 |
| `drawHUD(ctx)` | 1812 | 绘制 HUD |
| `drawHeart(ctx, x, y, size, color)` | 1886 | 绘制心形 |
| `drawStartScreen(ctx)` | 1901 | 绘制开始画面 |
| `drawDeathScreen(ctx)` | 1945 | 绘制死亡画面 |
| `roundRect(ctx, x, y, w, h, r)` | 1991 | 绘制圆角矩形 |
| `gameLoop(timestamp)` | 2006 | 游戏主循环 |

---

## 2. 游戏系统分类

### 渲染系统
- `preRenderAssets()` (393) — 预渲染天空、城市、近景、地面、轨道、障碍物、金币、粒子
- `preRenderPlayerSprites()` (888) — 预渲染 8 帧跑步 + 特殊姿态精灵
- `render()` (1459) — 主渲染：天空→视差城市→地面→轨道→深度排序实体→粒子→速度线→闪屏→HUD→UI
- `drawGround(ctx)` (1589) — 碎石地表渐变 + 纹理点
- `drawTracks(ctx)` (1616) — 3 条轨道的钢轨 + 枕木
- `drawObstacle(ctx, obs, sx, sy, scale)` (1658) — 运行时障碍物绘制（3 种类型）
- `drawCoin(ctx, coin, sx, sy, scale)` (1719) — 旋转金币
- `drawPowerup(ctx, pu, sx, sy, scale)` (1735) — 浮动道具 + 光晕
- `drawPlayer(ctx)` (1758) — 玩家精灵选择 + 无敌闪烁
- `drawHUD(ctx)` (1812) — 血量心、分数、速度、DEBUG 信息、道具指示器
- `drawStartScreen(ctx)` (1901) — 开始画面
- `drawDeathScreen(ctx)` (1945) — 死亡画面
- `drawSpritePose(ctx, pose)` (630) — 角色姿态绘制（含头部、躯干、四肢）
- `drawLimb()` (769), `drawShoe()` (817), `thickLine()` (800) — 肢体绘制辅助
- `drawGraffitiTag()` (523) — 涂鸦标签（5 种随机风格）
- `drawObstacleSprite()` (907) — 障碍物预渲染精灵
- `drawCoinSprite()` (944) — 金币预渲染精灵
- `drawHeart()` (1886) — 心形绘制

### 物理/碰撞
- `worldToScreen(dist)` (290) — 世界深度→屏幕坐标 + 缩放
- `laneX(laneIdx, dist)` (301) — 轨道索引→屏幕 X（透视收缩）
- `sameLane(obs)` (1386) — 碰撞检测：同轨道判断（阈值 0.6）
- 碰撞逻辑 (1227-1235) — 在 `update()` 内：低障碍滑铲通过、中障碍跳跃通过、高障碍必须换道

### 输入处理
- 键盘输入 (321-329) — keydown/keyup 事件监听
- 触屏输入 (332-356) — touchstart/touchend 滑动检测
- `processInput()` (1112) — 统一处理键盘+触屏，换道冷却 8 帧

### 动画系统
- `RUN_POSES` (834-867) — 8 帧跑步循环姿态定义
- `JUMP_POSE` (870), `SLIDE_POSE` (873), `HIT_POSE` (876), `LOOKBACK_POSE` (880), `KICK_POSE` (884) — 特殊姿态
- 动画帧切换 (1213-1218) — 每 8 帧切换一帧（~7.5fps 动画）
- 庆祝动作 (1207-1211, 1237-1248) — 跳过/滑过障碍后触发回头/踢腿

### 音效系统
- `initAudio()` (143) — 初始化 AudioContext
- `playSound()` (154) — 合成音效（振荡器+增益）
- `playNoise()` (174) — 噪音音效（缓冲区+滤波器）
- `sfxJump()` (205), `sfxSlide()` (209), `sfxCoin()` (213), `sfxHurt()` (231), `sfxDeath()` (250), `sfxPowerup()` (270) — 各事件音效

### UI/HUD
- `drawHUD()` (1812) — 血量心、分数、速度指示、DEBUG 统计、道具指示器
- `drawStartScreen()` (1901) — 标题、操作说明、最高分、闪烁提示
- `drawDeathScreen()` (1945) — 得分面板、距离、最高分、新纪录标记
- `drawHeart()` (1886) — 贝塞尔曲线心形

### 对象管理
- `poolGet(pool, factory)` (957) — 对象池获取（复用 inactive 对象）
- `poolReleaseAll(pool)` (967) — 全部释放
- `createPlayer()` (972), `createObstacle()` (995), `createCoin()` (1005), `createPowerup()` (1015), `createParticle()` (1027) — 对象工厂
- `cleanupPool()` (1453) — 空实现（对象池不真正删除）

### 游戏流程
- `startGame()` (1037) — 重置所有状态，开始游戏
- `restartGame()` (1058) — 从死亡状态重启
- `die()` (1062) — 死亡：保存最高分、爆炸粒子
- `hurtPlayer()` (1086) — 受伤：护盾吸收/扣血/无敌/屏幕震动
- `applyPowerup()` (1444) — 应用道具效果

### 生成控制
- `spawnObstacle()` (1391) — 按速度比例选择障碍物类型，避免同轨道堆叠
- `spawnCoinRow()` (1422) — 单轨道金币行
- `spawnPowerup()` (1433) — 随机道具生成

---

## 3. 硬编码数值清单

### 预渲染/绘制中的硬编码数字

| 行号 | 数值 | 用途 | 应抽成常量？ |
|------|------|------|-------------|
| 16 | `600` | 画布最大宽度 | 是 |
| 17 | `900` | 画布最大高度 | 是 |
| 18 | `2/3` | 画布宽高比 | 是 |
| 383 | `0.5` | 消失点 X 比例 | 是 |
| 384 | `0.28` | 消失点 Y 比例 | 是 |
| 385 | `0.88` | 地面 Y 比例 | 是 |
| 386 | `0.18` | 轨道扩散比例 | 是 |
| 372 | `2` | 最大 DPR 限制 | 是 |
| 399 | `40` | 天空渐变底部偏移 | 是 |
| 407 | `8` | 云层数量 | 是 |
| 410 | `60, 120` | 云宽度范围 | 是 |
| 412 | `12, 10` | 云高度范围 | 是 |
| 429 | `30, 100` | 远建筑宽度范围 | 是 |
| 431 | `40, 0.85` | 远建筑高度范围 | 是 |
| 433 | `5, 20` | 远建筑间距范围 | 是 |
| 439 | 5 个颜色 | 涂鸦标签颜色 | 是 |
| 444 | `0.3` | 窗户光点透明度 | 是 |
| 445-448 | `8, 12, 6, 10, 3` | 窗户光点参数 | 是 |
| 462 | `60, 160` | 近建筑宽度范围 | 是 |
| 463 | `80, 0.9` | 近建筑高度范围 | 是 |
| 466 | `0.2` | 近窗户透明度 | 是 |
| 467-470 | `12, 16, 14, 5, 6` | 近窗户参数 | 是 |
| 473 | `0.3` | 近涂鸦概率 | 是 |
| 620-627 | 多个颜色值 | 角色调色板 | 是（SP 对象） |
| 631 | `80, 100` | 精灵画布尺寸 | 是 |
| 633 | `40` | 角色水平中心 | 是 |
| 634-637 | `52, 28, 16, 16, 9` | 身体比例参数 | 是 |
| 944 | `32, 32` | 金币精灵尺寸 | 是 |
| 514 | `8, 8` | 粒子精灵尺寸 | 是 |
| 1258 | `0.85` | 金币收集距离阈值 | 是 |
| 1317 | `0.85` | 道具收集距离阈值 | 是 |
| 1387 | `0.6` | 同轨道碰撞阈值 | 是 |
| 1364 | `50, 35` | 跳跃高度参数 | 是 |
| 1136 | `8` | 换道冷却帧数 | 是 |
| 1141 | `150` | 跳跃持续帧数 | 是 |
| 1148 | `100` | 滑铲持续帧数 | 是 |
| 1107 | `18` | 受击后仰帧数 | 是 |
| 1242 | `40` | 回头庆祝帧数 | 是 |
| 1245 | `35` | 踢腿庆祝帧数 | 是 |
| 1299 | `150, 120` | 金币生成间隔范围 | 是 |
| 1304 | `300, 400` | 道具生成间隔范围 | 是 |
| 1406 | `0.2, 0.5` | 障碍物类型分布阈值 | 是 |
| 1410 | `100, 30` | 障碍物堆叠检测距离 | 是 |
| 1425 | `20, 60` | 金币行间距参数 | 是 |
| 1558 | `0.3` | 速度线显示阈值 | 是 |
| 1563 | `12` | 速度线数量 | 是 |
| 1566 | `20, 40` | 速度线长度范围 | 是 |
| 1619 | `5` | 钢轨宽度 | 是 |
| 1627 | `8` | 轨道半宽偏移 | 是 |
| 1645 | `3` | 枕木宽度 | 是 |
| 1646 | `60` | 枕木间距 | 是 |
| 1722 | `0.05, 0.1` | 金币旋转速度 | 是 |
| 1831 | `28` | 分数字号 | 是 |
| 1908 | `48` | 标题字字号 | 是 |

### 运行时逻辑中的硬编码数字

| 行号 | 数值 | 用途 |
|------|------|------|
| 293 | `0.35` | 世界坐标最小值（允许负距离） |
| 296 | `0.3, 1.0` | 缩放范围 |
| 1185 | `0.25` | 轨道平滑插值系数 |
| 1215 | `8` | 动画帧切换间隔 |
| 1225 | `400` | 障碍物消失距离 |
| 1270 | `4, 2` | 金币收集粒子速度 |
| 1316 | `0.05` | 道具浮动相位增量 |
| 1349 | `0.08` | 磁铁吸引插值系数 |
| 1350 | `0.3` | 磁铁加速系数 |
| 1370 | `4` | 扬尘粒子间隔帧数 |
| 1374 | `20` | 扬尘粒子 X 范围 |
| 1376 | `0.8, 1.5` | 扬尘粒子 Y 速度 |
| 1476 | `0.15` | 远城市视差系数 |
| 1480 | `0.3` | 近建筑视差系数 |
| 1605 | `42` | 碎石纹理随机种子 |
| 1606 | `12` | 碎石纹理 Y 间距 |
| 1607 | `14` | 碎石纹理 X 间距 |
| 1608 | `31, 17, 7` | 碎石纹理哈希参数 |

---

## 4. 潜在问题

### 超过 50 行的函数

| 函数 | 行号 | 行数 | 问题 |
|------|------|------|------|
| `update()` | 1160-1383 | **223 行** | 最大函数，包含速度、碰撞、生成、道具、粒子全部逻辑 |
| `render()` | 1459-1586 | **127 行** | 次大函数，包含全部渲染管线 |
| `drawSpritePose()` | 630-766 | **136 行** | 角色绘制，含头部 3 种朝向 |
| `drawHUD()` | 1812-1884 | **72 行** | HUD 绘制 |
| `drawObstacle()` | 1658-1716 | **58 行** | 3 种障碍物绘制 |
| `init()` | 309-367 | **58 行** | 初始化 |
| `preRenderAssets()` | 393-519 | **126 行** | 预渲染全部资源 |
| `drawGraffitiTag()` | 523-612 | **89 行** | 5 种涂鸦风格 |
| `processInput()` | 1112-1157 | **45 行** | 接近阈值 |
| `spawnObstacle()` | 1391-1420 | **29 行** | 正常 |
| `drawStartScreen()` | 1901-1943 | **42 行** | 正常 |
| `drawDeathScreen()` | 1945-1989 | **44 行** | 正常 |

### 重复代码块

1. **金币绘制逻辑重复** — `drawCoinSprite()` (944-954) 和 `drawCoin()` (1719-1732) 绘制相同的金币，一个用于预渲染一个用于运行时
2. **障碍物绘制逻辑重复** — `drawObstacleSprite()` (907-942) 和 `drawObstacle()` (1658-1716) 绘制相同的障碍物，且运行时版本完全重写了绘制逻辑
3. **粒子生成代码重复** — 金币收集 (1266-1275)、道具收集 (1324-1333)、死亡爆炸 (1074-1083)、扬尘 (1371-1381) 四处几乎相同的粒子生成代码
4. **键盘消耗代码** (1153-1156) — 重复的 `G.keys[xxx] = false` 模式

### 注释中的 TODO/FIXME/HACK

**无。** 代码中没有 TODO、FIXME、HACK 注释。

### 其他问题

- `cleanupPool()` (1453) 是空函数，注释说"对象池不真正删除"，但对象池会无限增长
- DEBUG 信息 (1845-1852) 在生产代码中不应显示
- `preRenderAssets()` 每次 `resize()` 都重新生成全部离屏画布（含随机内容），城市天际线每次 resize 都会变

---

## 5. 入口点

### 初始化
- **`init()`** — 行 309
  - 获取画布、设置上下文
  - 调用 `resize()`
  - 加载最高分（localStorage）
  - 注册键盘/触屏事件
  - 创建玩家
  - 调用 `preRenderAssets()`
  - 启动 `requestAnimationFrame(gameLoop)`

### 主循环
- **`gameLoop(timestamp)`** — 行 2006
  ```
  gameLoop()
    ├── 计算 deltaTime 和 FPS
    ├── processInput()  — 输入处理
    ├── update()        — 游戏逻辑
    ├── render()        — 渲染
    └── requestAnimationFrame(gameLoop)  — 递归
  ```

### 更新
- **`update()`** — 行 1160
  - 速度递增 + 距离计算
  - 无敌/震动/闪屏衰减
  - 轨道平滑切换
  - 玩家状态机（jump/slide/hit）
  - 障碍物移动 + 碰撞检测
  - 金币移动 + 收集检测
  - 粒子更新
  - 生成控制（障碍物/金币/道具）
  - 道具效果（磁铁吸引）
  - 玩家屏幕坐标计算
  - 扬尘粒子

### 渲染
- **`render()`** — 行 1459
  - 天空 → 远城视差 → 近建筑视差 → 地面 → 轨道
  - 深度排序实体（障碍物/金币/道具）
  - 分离身前/身后实体
  - 玩家绘制
  - 粒子绘制
  - 速度线 → 闪屏 → HUD → UI 状态画面

### 启动调用
- **行 2027**: `init()` — 脚本末尾直接调用，页面加载即启动

---

## 精灵姿态常量（行 834-886）

| 常量名 | 行号 | 用途 |
|--------|------|------|
| `RUN_POSES` | 834 | 8 帧跑步循环（接触→下沉→经过→蹬起 × 2） |
| `JUMP_POSE` | 870 | 跳跃姿态 |
| `SLIDE_POSE` | 873 | 滑铲姿态 |
| `HIT_POSE` | 876 | 受击姿态 |
| `LOOKBACK_POSE` | 880 | 庆祝：回头 |
| `KICK_POSE` | 884 | 庆祝：踢腿 |

## 调色板 SP（行 620-627）

| 属性 | 值 | 用途 |
|------|-----|------|
| `skin` | #ffd3b6 | 皮肤色 |
| `skinS` | #e8bfa5 | 皮肤阴影 |
| `hair` | #2a1a0a | 头发色 |
| `hairH` | #3d2818 | 头发高光 |
| `hoodie` | #e94560 | 连帽衫色 |
| `hoodieD` | #c23152 | 连帽衫深色 |
| `hoodieF` | #d63852 | 连帽衫前色 |
| `pants` | #2d2d44 | 裤子色 |
| `pantsD` | #252538 | 裤子深色 |
| `shoe` | #f0f0f0 | 鞋子色 |
| `sole` | #333 | 鞋底色 |
| `shoeA` | #e94560 | 鞋子强调色 |
| `goggleF` | #555 | 护目镜框色 |
