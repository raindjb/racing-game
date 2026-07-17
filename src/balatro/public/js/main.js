// main.js — 引导启动
import { VERSION, GAME_NAME } from './version.js';
import './effects/joker-effects.js';   // 注册全部 Joker 效果（副作用导入）
import { initRender } from './ui/render.js';
import { initDrag } from './ui/drag.js';
import { initHover3d } from './ui/hover-3d.js';
import { initKeyboard } from './ui/keyboard.js';
import { initAudio } from './audio/hooks.js';
import { startRun } from './round.js';

console.log(`[balatro] ${GAME_NAME} v${VERSION} booting…`);

initRender();
const handArea = document.getElementById('hand-area');
initDrag(handArea);
initHover3d(handArea);
initKeyboard();
initAudio();
startRun({});     // Task 12：改为主菜单（新游戏/继续存档）

// Task 10: 背景着色器 + 逐步跳分
