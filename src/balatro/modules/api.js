// modules/api.js — REST 路由：存档 CRUD + 战绩统计
import { Router } from 'express';
import { RunStore, StatsStore } from './store.js';

const runs = new RunStore();
const stats = new StatsStore();
const router = Router();

// ── 存档 ──
router.get('/runs', (req, res) => res.json({ runs: runs.list() }));

router.get('/runs/:id', (req, res) => {
  const payload = runs.load(req.params.id);
  if (!payload) return res.status(404).json({ error: 'not found' });
  res.json(payload);
});

router.put('/runs/:id', (req, res) => {
  const payload = req.body;
  // Schema 门槛：拒绝残缺存档进入存储
  if (!payload || typeof payload.version !== 'number' || !payload.seed || !Array.isArray(payload.deck)) {
    return res.status(400).json({ error: 'invalid save payload' });
  }
  runs.save(req.params.id, payload);
  res.json({ ok: true });
});

router.delete('/runs/:id', (req, res) => {
  runs.remove(req.params.id);
  res.status(204).end();
});

// ── 统计 ──
router.get('/stats', (req, res) => res.json(stats.summary()));

router.post('/stats/record', (req, res) => {
  const e = req.body ?? {};
  if (typeof e.won !== 'boolean' || typeof e.ante !== 'number') {
    return res.status(400).json({ error: 'invalid stats entry' });
  }
  res.json(stats.record({
    won: e.won, ante: e.ante, round: e.round ?? 0,
    bestHand: e.bestHand ?? 0, money: e.money ?? 0,
    seed: String(e.seed ?? ''), endedAt: e.endedAt ?? new Date().toISOString(),
  }));
});

export default router;
