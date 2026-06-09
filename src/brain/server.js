import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3456;

app.use(express.static(join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Snake running at http://localhost:${PORT}`);
});
