import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'data', 'pooptracker.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL,
    happened_at TEXT NOT NULL,
    bristol_type INTEGER NOT NULL CHECK (bristol_type BETWEEN 1 AND 7),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_entries_happened_at ON entries(happened_at DESC);
`);

const seedPeople = ['Alex', 'Mia', 'Sam'];
const countPeople = db.prepare('SELECT COUNT(*) AS count FROM people').get().count;
if (countPeople === 0) {
  const insert = db.prepare('INSERT INTO people(name) VALUES (?)');
  const insertMany = db.transaction((names) => {
    for (const name of names) {
      insert.run(name);
    }
  });
  insertMany(seedPeople);
}

export default db;
