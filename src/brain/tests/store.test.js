import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Store } from '../modules/store.js';
import { unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_FILE = join(__dirname, 'test-notes.json');

let store;

beforeEach(() => {
  if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
  store = new Store(TEST_FILE);
});

afterEach(() => {
  if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
});

describe('Store', () => {
  it('add and retrieve a note', () => {
    const note = store.add({ title: 'Test', content: 'Hello world', tags: ['a'] });
    expect(note.id).toBeTruthy();
    expect(note.title).toBe('Test');

    const all = store.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].content).toBe('Hello world');
  });

  it('search by keyword in title', () => {
    store.add({ title: 'MCP协议', content: 'xxx', tags: [] });
    store.add({ title: '其他', content: 'yyy', tags: [] });
    const results = store.search('MCP');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('MCP协议');
  });

  it('search by keyword in content', () => {
    store.add({ title: 'Note', content: 'DeepSeek API is great', tags: [] });
    const results = store.search('deepseek');
    expect(results).toHaveLength(1);
  });

  it('search by tag', () => {
    store.add({ title: 'A', content: '', tags: ['AI', 'news'] });
    store.add({ title: 'B', content: '', tags: ['life'] });
    const results = store.search('AI');
    expect(results).toHaveLength(1);
  });

  it('getByTag filters exactly', () => {
    store.add({ title: 'A', content: '', tags: ['AI'] });
    store.add({ title: 'B', content: '', tags: ['ai-tools'] });
    const results = store.getByTag('AI');
    expect(results).toHaveLength(1);
  });

  it('delete removes a note', () => {
    const note = store.add({ title: 'Gone', content: '', tags: [] });
    expect(store.delete(note.id)).toBe(true);
    expect(store.getAll()).toHaveLength(0);
  });

  it('delete returns false for missing id', () => {
    expect(store.delete('nonexistent')).toBe(false);
  });

  it('getById returns note or null', () => {
    const note = store.add({ title: 'Find me', content: '', tags: [] });
    expect(store.getById(note.id).title).toBe('Find me');
    expect(store.getById('nope')).toBeNull();
  });
});
