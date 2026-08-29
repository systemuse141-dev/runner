// Demo-mode persistent store: JSON file on disk, in-memory engine in RAM.
// Clearly a SIMULATION environment — production uses Postgres (postgres.js).

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { MemoryDB } from './memorydb.js';

export function createFileStore({ file }) {
  let state = null;
  if (file && existsSync(file)) {
    try {
      state = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      console.warn(`[store] could not read ${file}, starting fresh: ${e.message}`);
      state = null;
    }
  }
  const db = new MemoryDB({
    persist: (s) => {
      if (!file) return;
      mkdirSync(dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, JSON.stringify(s));
      try {
        writeFileSync(file, JSON.stringify(s));
      } catch {
        /* tmp already written */
      }
    },
  });
  if (state) db.restore(state);
  return db;
}

export function createMemoryStore() {
  return new MemoryDB({});
}
