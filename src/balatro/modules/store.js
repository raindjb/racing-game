// modules/store.js — JSON 文件持久化（仿 src/brain/modules/store.js 模式）
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = join(__dirname, '..', 'data');

class JsonStore {
  constructor(name, defaults, dir = DEFAULT_DIR) {
    mkdirSync(dir, { recursive: true });
    this.filePath = join(dir, `${name}.json`);
    this.defaults = defaults;
    if (!existsSync(this.filePath)) this._write(defaults);
  }
  _read() {
    try { return JSON.parse(readFileSync(this.filePath, 'utf-8')); }
    catch (e) { return structuredClone(this.defaults); }
  }
  _write(data) { writeFileSync(this.filePath, JSON.stringify(data, null, 2)); }
}

/** 对局存档：id → { payload, updatedAt } */
export class RunStore extends JsonStore {
  constructor(dir) { super('runs', { runs: {} }, dir); }

  save(id, payload) {
    const d = this._read();
    d.runs[id] = { payload, updatedAt: new Date().toISOString() };
    this._write(d);
  }
  load(id) { return this._read().runs[id]?.payload ?? null; }
  list() {
    return Object.entries(this._read().runs).map(([id, r]) => ({
      id, updatedAt: r.updatedAt,
      ante: r.payload?.ante, round: r.payload?.round, money: r.payload?.money,
    }));
  }
  remove(id) {
    const d = this._read();
    if (!(id in d.runs)) return false;
    delete d.runs[id];
    this._write(d);
    return true;
  }
}

/** 战绩统计 */
export class StatsStore extends JsonStore {
  constructor(dir) {
    super('stats', { games: 0, wins: 0, bestScore: 0, bestAnte: 0, history: [] }, dir);
  }
  record(entry) {
    const d = this._read();
    d.games++;
    if (entry.won) d.wins++;
    d.bestScore = Math.max(d.bestScore, entry.bestHand ?? 0);
    d.bestAnte = Math.max(d.bestAnte, entry.ante ?? 0);
    d.history.unshift(entry);
    d.history = d.history.slice(0, 50);
    this._write(d);
    return d;
  }
  summary() { return this._read(); }
}
