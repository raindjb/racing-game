import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, store } from '../server.js';
import { unlinkSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '..', 'data', 'notes.json');

beforeEach(() => {
  // Reset store to empty
  writeFileSync(DATA_FILE, JSON.stringify({ notes: [] }, null, 2));
});

describe('API', () => {
  it('POST /api/notes creates a note', async () => {
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 'Test', content: 'Body', tags: ['ai'] })
      .expect(201);

    expect(res.body.title).toBe('Test');
    expect(res.body.id).toBeTruthy();
    expect(res.body.tags).toEqual(['ai']);
  });

  it('POST /api/notes rejects missing title', async () => {
    await request(app)
      .post('/api/notes')
      .send({ content: 'No title' })
      .expect(400);
  });

  it('GET /api/notes returns all notes', async () => {
    await request(app).post('/api/notes').send({ title: 'A', content: 'a' });
    await request(app).post('/api/notes').send({ title: 'B', content: 'b' });

    const res = await request(app).get('/api/notes').expect(200);
    expect(res.body).toHaveLength(2);
  });

  it('GET /api/notes?q=keyword searches', async () => {
    await request(app).post('/api/notes').send({ title: 'MCP协议', content: 'xxx' });
    await request(app).post('/api/notes').send({ title: 'Other', content: 'yyy' });

    const res = await request(app).get('/api/notes?q=MCP').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('MCP协议');
  });

  it('GET /api/notes?tag=xxx filters by tag', async () => {
    await request(app).post('/api/notes').send({ title: 'A', content: '', tags: ['AI'] });
    await request(app).post('/api/notes').send({ title: 'B', content: '', tags: ['life'] });

    const res = await request(app).get('/api/notes?tag=AI').expect(200);
    expect(res.body).toHaveLength(1);
  });

  it('DELETE /api/notes/:id removes a note', async () => {
    const create = await request(app).post('/api/notes').send({ title: 'Gone', content: '' });
    await request(app).delete(`/api/notes/${create.body.id}`).expect(200);

    const all = await request(app).get('/api/notes').expect(200);
    expect(all.body).toHaveLength(0);
  });

  it('DELETE /api/notes/:id returns 404 for missing', async () => {
    await request(app).delete('/api/notes/nonexistent').expect(404);
  });
});
