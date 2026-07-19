// ui/keyboard.js — 键盘快捷键
// 出牌区: 1-8 选牌 / Enter·空格 出牌 / D 弃牌 / R 按点数理牌 / S 按花色理牌
// 浮层: Enter 确认 / Esc 离开商店
import { G, PHASES } from '../state.js';
import * as round from '../round.js';
import { playAction } from './render.js';

export function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.repeat) return;
    switch (G.phase) {
      case PHASES.PLAYING: {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playAction(); }
        else if (e.key === 'd' || e.key === 'D') round.discardSelected();
        else if (e.key === 'r' || e.key === 'R') round.sortHand('rank');
        else if (e.key === 's' || e.key === 'S') round.sortHand('suit');
        else {
          const n = parseInt(e.key, 10);
          if (n >= 1 && n <= 8 && G.hand[n - 1]) round.toggleSelect(G.hand[n - 1].id);
        }
        break;
      }
      case PHASES.BLIND_SELECT:
        if (e.key === 'Enter') round.startBlind();
        break;
      case PHASES.ROUND_END:
        if (e.key === 'Enter') round.leaveRoundEnd();
        break;
      case PHASES.SHOP:
        if (e.key === 'Escape') round.leaveShop();
        break;
      case PHASES.GAME_OVER:
      case PHASES.WIN:
        if (e.key === 'Enter') round.startRun({});
        break;
      case PHASES.MENU:
        if (e.key === 'Enter' && document.activeElement?.id !== 'menu-seed') {
          document.getElementById('menu-new')?.click();
        }
        break;
    }
  });
}
