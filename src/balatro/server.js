import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3457;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(__dirname, 'public')));

// /api 路由在 Task 11 挂载（modules/api.js）

app.listen(PORT, () => {
  console.log(`[balatro] 小丑牌 running at http://localhost:${PORT}`);
});
