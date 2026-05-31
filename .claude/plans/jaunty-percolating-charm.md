# 赛车游戏 Bug 修复计划

## Context
`src/racing/index.html`（~10,000行，12个模块）是首次多agent协作产物。35+ 个bug，3个架构级根因导致游戏基本不可玩。

## 根本原因
1. **坐标系XY vs XZ混用** — 玩家用 XY 平面 (cos/sin驱动 x/y)，赛道和AI用 XZ 平面。渲染、碰撞、赛道检测全部断裂
2. **`R.playerCar` 从未赋值** — AI/碰撞/特效/HUD 读 `R.playerCar`，实际玩家在 `R.player`
3. **`R.cars` 从未填充** — HUD 排名/小地图/结果页都在读空数组

## 修复策略
**统一坐标系为 XZ**（与赛道一致），修复所有引用断裂。按优先级分批：

### 第一批：游戏能跑起来（7项）
1. **玩家坐标改为 XZ 平面** — `updatePlayer`: `p.x += cos(a)*speed, p.z += sin(a)*speed`, angle含义与AI对齐
2. **`R.playerCar` 指向 `R.player`** — 一行修复，AI/碰撞/特效/HUD 全部复活
3. **`R.cars` 指向合并数组** — `R.cars = [R.player].concat(R.aiCars)`，排名/小地图/结果页修复
4. **`R.worldToScreen` 使用 wz 做透视缩放** — scale = zoom / (1 + wz * PERSPECTIVE_COEFF)，远景正确缩小
5. **碰撞系统接入游戏循环** — `R.loop` 中调用 `R.checkCollisions()`
6. **赛道检测修复** — `isOnTrack(p.x, p.z)`，传正确的世界坐标
7. **玩家初始角度对齐赛道** — `initPlayer` 用 `R.track.startAngle`

### 第二批：视觉和体验（5项）
8. **倒计时触发** — 状态机进入 countdown 时调用 `R.triggerCountdown()`
9. **菜单渲染接入** — `R.render()` 在 menu 阶段调用 `R.renderMenu()`
10. **暂停系统接入** — 状态机加 `paused` 阶段
11. **输入系统统一** — 去掉 engine 内置键盘处理，只用 input.js
12. **AI 坐标对齐** — 修复 `getSegmentAtZ` 用 `seg.segDist`，修复 `trackLength()`

### 第三批：细节打磨（4项）
13. **HUD 速度表缩放** — `speed * 20` 显示合理 km/h
14. **赛道渲染透视** — `_projectSegment` 修复 road width 在极端角度下塌陷
15. **弯道路缘闪烁修复** — 条纹索引用世界距离而非相机相对距离
16. **场景物体屋顶颜色缓存** — 初始化时随机，渲染时只读

## 涉及文件
- `src/racing/index.html`（唯一文件，所有模块内联）

## 验证
- 浏览器打开 `index.html`，检查：赛道可见、玩家车可见、AI车可见、碰撞有效、倒计时显示、菜单完整
