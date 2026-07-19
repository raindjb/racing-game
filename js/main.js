// Balatro — poker roguelike entry point
// main.js — 引导启动
import { VERSION, GAME_NAME } from './version.js';
import './effects/joker-effects.js';   // 注册全部 Joker 效果（副作用导入）
import { initRender } from './ui/render.js';
import { initDrag } from './ui/drag.js';
import { initHover3d } from './ui/hover-3d.js';
import { initKeyboard } from './ui/keyboard.js';
import { initAudio } from './audio/hooks.js';
import { initBackground } from './shaders/background.js';
import { initParticles } from './ui/notifications.js';
import { initHandPanel } from './ui/hand-panel.js';
import { initSaveClient } from './save-client.js';
import { toMenu } from './round.js';

console.log(`[balatro] ${GAME_NAME} v${VERSION} booting…`);

initRender();
const handArea = document.getElementById('hand-area');
initDrag(handArea);
initHover3d(handArea);
initKeyboard();
initAudio();
initBackground();
initParticles();
initHandPanel();
initSaveClient();
// 左下角筹码堆（3D 可视化永久筹码余额）
(function addChipPile() {
  const pile = document.createElement('div');
  pile.id = 'chip-pile';
  document.getElementById('board')?.appendChild(pile);
  import('./svg/chip-pile.js').then(m => { pile.innerHTML = m.renderChipPile(); }).catch(() => {});
  // 每局结束后更新（异步绑定）
  import('./state.js').then(({ bus, PHASES }) => {
    bus.on('phase', ({ phase }) => {
      if (phase === PHASES.GAME_OVER || phase === PHASES.WIN) {
        import('./svg/chip-pile.js').then(m => { pile.innerHTML = m.renderChipPile(); }).catch(() => {});
      }
    });
  }).catch(() => {});
})();
// 背景花色装饰（play-area 内浮动黑红梅方）
(function addBgSuits() {
  const area = document.getElementById('play-area');
  if (!area) return;
  const suits = [
    { c: '♠', r: 'black' }, { c: '♥', r: 'red' }, { c: '♦', r: 'red' },
    { c: '♣', r: 'black' }, { c: '♠', r: 'black' }, { c: '♥', r: 'red' },
  ];
  suits.forEach(s => {
    const el = document.createElement('div');
    el.className = `bg-suit ${s.r}`;
    el.textContent = s.c;
    area.appendChild(el);
  });
})();
// 全屏按钮
(function initFullscreen() {
  const btn = document.getElementById('btn-fullscreen');
  if (!btn) return;

  const supportsFS = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  if (!supportsFS) { btn.textContent = '📱 横屏'; btn.disabled = true; return; }

  btn.addEventListener('click', () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const el = document.documentElement;
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el).then(() => {
        try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape'); } catch (_) {}
      });
    }
  });

  const updateLabel = () => {
    const inFS = document.fullscreenElement || document.webkitFullscreenElement;
    btn.textContent = inFS ? '✕' : '⛶ 全屏';
  };
  document.addEventListener('fullscreenchange', updateLabel);
  document.addEventListener('webkitfullscreenchange', updateLabel);
})();

// 修复旧浏览器的视口高度（不支持 dvh 时用 JS 设置）
(function fixViewportHeight() {
  const style = document.createElement('style');
  style.textContent = '#app { height: 100vh; height: 100dvh; }';
  document.head.appendChild(style);
  // 旧浏览器 fallback：监听 resize
  const app = document.getElementById('app');
  if (!app || CSS.supports('height', '100dvh')) return;
  const setVH = () => { app.style.height = window.innerHeight + 'px'; };
  setVH();
  window.addEventListener('resize', setVH);
  window.addEventListener('orientationchange', () => setTimeout(setVH, 300));
})();

toMenu();         // 主菜单：新游戏 / 继续存档
