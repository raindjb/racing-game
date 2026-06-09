import { readFileSync, writeFileSync, existsSync } from 'fs';

export class Store {
  constructor(filePath) {
    this.filePath = filePath;
    if (!existsSync(filePath)) {
      writeFileSync(filePath, JSON.stringify({ notes: [] }, null, 2));
    }
  }

  _read() {
    return JSON.parse(readFileSync(this.filePath, 'utf-8'));
  }

  _write(data) {
    writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  add({ title, content, tags = [] }) {
    const data = this._read();
    const note = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title,
      content,
      tags,
      createdAt: new Date().toISOString(),
    };
    data.notes.push(note);
    this._write(data);
    return note;
  }

  getAll() {
    return this._read().notes;
  }

  search(keyword) {
    const q = keyword.toLowerCase();
    return this.getAll().filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  getByTag(tag) {
    const q = tag.toLowerCase();
    return this.getAll().filter(n =>
      n.tags.some(t => t.toLowerCase() === q)
    );
  }

  delete(id) {
    const data = this._read();
    const idx = data.notes.findIndex(n => n.id === id);
    if (idx === -1) return false;
    data.notes.splice(idx, 1);
    this._write(data);
    return true;
  }

  getById(id) {
    return this.getAll().find(n => n.id === id) || null;
  }
}
