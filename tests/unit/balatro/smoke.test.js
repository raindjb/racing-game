import { describe, test, expect } from 'vitest';
import { VERSION, GAME_NAME, SAVE_VERSION } from '../../../src/balatro/public/js/version.js';

describe('balatro smoke', () => {
  test('version 模块可加载', () => {
    expect(VERSION).toMatch(/^0\.1\./);
    expect(GAME_NAME).toBe('小丑牌');
    expect(SAVE_VERSION).toBe(1);
  });
});
