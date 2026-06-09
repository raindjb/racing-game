import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3456;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (process.argv[1] && !process.argv[1].includes('test')) {
  app.listen(PORT, () => {
    console.log(`Brain running at http://localhost:${PORT}`);
  });
}

export { app };
