// main.js — 引导启动
import { VERSION, GAME_NAME } from './version.js';
import { initRender } from './ui/render.js';
import { startRun } from './round.js';

console.log(`[balatro] ${GAME_NAME} v${VERSION} booting…`);

initRender();
startRun({});     // Task 12：改为主菜单（新游戏/继续存档）

// Task 07: Joker 渲染
// Task 09: 音频
// Task 10: 背景着色器 + 逐步跳分
