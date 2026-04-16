import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const adminPin = String(process.env.ADMIN_PIN || '').trim();
if (!/^\d{4}$/.test(adminPin)) {
  throw new Error('ADMIN_PIN fehlt oder ist ungueltig. Bitte eine 4-stellige PIN in server/.env setzen.');
}

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');

const bristolLabels = {
  1: 'Typ 1 - separate harte Kloempel',
  2: 'Typ 2 - wurstfoermig, klumpig',
  3: 'Typ 3 - wurstfoermig mit Rissen',
  4: 'Typ 4 - glatt und weich',
  5: 'Typ 5 - weiche Kloempel',
  6: 'Typ 6 - breiig, flockig',
  7: 'Typ 7 - fluessig'
};

function mapEntry(row) {
  return {
    id: row.id,
    personId: row.person_id,
    personName: row.person_name,
    happenedAt: row.happened_at,
    bristolType: row.bristol_type,
    bristolLabel: bristolLabels[row.bristol_type],
    rating: row.rating ?? 3,
    note: row.note ?? ''
  };
}

function getProvidedPin(req) {
  return String(req.header('x-admin-pin') || '').trim();
}

function requireAdminPin(req, res, next) {
  const providedPin = getProvidedPin(req);

  if (!providedPin) {
    return res.status(401).json({ error: 'Admin-PIN erforderlich.' });
  }

  if (!/^\d{4}$/.test(providedPin)) {
    return res.status(400).json({ error: 'Admin-PIN muss 4-stellig sein.' });
  }

  if (providedPin !== adminPin) {
    return res.status(403).json({ error: 'Admin-PIN ist falsch.' });
  }

  return next();
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/admin/verify', (req, res) => {
  const pin = String(req.body?.pin || '').trim();

  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN muss 4-stellig sein.' });
  }

  if (pin !== adminPin) {
    return res.status(401).json({ error: 'PIN ist falsch.' });
  }

  return res.json({ ok: true });
});

app.get('/api/people', (_req, res) => {
  const people = db
    .prepare('SELECT id, name FROM people ORDER BY name COLLATE NOCASE ASC')
    .all();
  res.json(people);
});

app.post('/api/people', requireAdminPin, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich.' });
  }

  try {
    const result = db.prepare('INSERT INTO people(name) VALUES (?)').run(name);
    return res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Name existiert bereits.' });
    }
    return res.status(500).json({ error: 'Name konnte nicht gespeichert werden.' });
  }
});

app.delete('/api/people/:id', requireAdminPin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Ungueltige ID.' });
  }

  const person = db.prepare('SELECT id FROM people WHERE id = ?').get(id);
  if (!person) {
    return res.status(404).json({ error: 'Name nicht gefunden.' });
  }

  db.prepare('DELETE FROM people WHERE id = ?').run(id);
  return res.status(204).send();
});

app.get('/api/entries', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT e.id, e.person_id, p.name AS person_name, e.happened_at, e.bristol_type, e.rating, e.note
       FROM entries e
       JOIN people p ON p.id = e.person_id
       ORDER BY datetime(e.happened_at) DESC
       LIMIT 50`
    )
    .all();

  res.json(rows.map(mapEntry));
});

app.post('/api/entries', (req, res) => {
  const personId = Number(req.body?.personId);
  const happenedAt = String(req.body?.happenedAt || '').trim();
  const bristolType = Number(req.body?.bristolType);
  const rating = Number(req.body?.rating);
  const noteRaw = req.body?.note;
  const note = typeof noteRaw === 'string' ? noteRaw.trim() : '';

  if (!Number.isInteger(personId)) {
    return res.status(400).json({ error: 'Person ist erforderlich.' });
  }

  if (!happenedAt || Number.isNaN(new Date(happenedAt).getTime())) {
    return res.status(400).json({ error: 'Datum/Uhrzeit ist ungueltig.' });
  }

  if (!Number.isInteger(bristolType) || bristolType < 1 || bristolType > 7) {
    return res.status(400).json({ error: 'Bristol-Typ muss zwischen 1 und 7 liegen.' });
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Bewertung muss zwischen 1 und 5 Sternen liegen.' });
  }

  const person = db.prepare('SELECT id FROM people WHERE id = ?').get(personId);
  if (!person) {
    return res.status(404).json({ error: 'Person nicht gefunden.' });
  }

  const result = db
    .prepare(
      'INSERT INTO entries(person_id, happened_at, bristol_type, rating, note) VALUES (?, ?, ?, ?, ?)'
    )
    .run(personId, happenedAt, bristolType, rating, note || null);

  const created = db
    .prepare(
      `SELECT e.id, e.person_id, p.name AS person_name, e.happened_at, e.bristol_type, e.rating, e.note
       FROM entries e
       JOIN people p ON p.id = e.person_id
       WHERE e.id = ?`
    )
    .get(result.lastInsertRowid);

  return res.status(201).json(mapEntry(created));
});

app.get('/api/dashboard', (_req, res) => {
  const totalEntries = db.prepare('SELECT COUNT(*) AS value FROM entries').get().value;
  const heatmapDays = 14;
  const averages = db
    .prepare('SELECT AVG(bristol_type) AS avg_bristol_type, AVG(rating) AS avg_rating FROM entries')
    .get();

  const perPerson = db
    .prepare(
      `SELECT p.id, p.name, COUNT(e.id) AS count
       FROM people p
       LEFT JOIN entries e ON e.person_id = p.id
       GROUP BY p.id, p.name
       ORDER BY count DESC, p.name ASC`
    )
    .all();

  const byBristolType = db
    .prepare(
      `SELECT bristol_type AS type, COUNT(*) AS count
       FROM entries
       GROUP BY bristol_type
       ORDER BY bristol_type ASC`
    )
    .all()
    .map((row) => ({
      type: row.type,
      label: bristolLabels[row.type],
      count: row.count
    }));

  const latest = db
    .prepare(
      `SELECT e.id, e.person_id, p.name AS person_name, e.happened_at, e.bristol_type, e.rating, e.note
       FROM entries e
       JOIN people p ON p.id = e.person_id
       ORDER BY datetime(e.happened_at) DESC
       LIMIT 10`
    )
    .all()
    .map(mapEntry);

  const activityRaw = db
    .prepare(
      `SELECT date(happened_at, 'localtime') AS date, COUNT(*) AS count
       FROM entries
       WHERE date(happened_at, 'localtime') >= date('now', 'localtime', ?)
       GROUP BY date(happened_at, 'localtime')
       ORDER BY date ASC`
    )
    .all(`-${heatmapDays - 1} days`);

  const activityMap = new Map(activityRaw.map((row) => [row.date, row.count]));
  const activityDays = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = heatmapDays - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const dateKey = day.toISOString().slice(0, 10);
    activityDays.push({ date: dateKey, count: activityMap.get(dateKey) ?? 0 });
  }

  res.json({
    totalEntries,
    averageBristolType: averages?.avg_bristol_type ?? null,
    averageRating: averages?.avg_rating ?? null,
    perPerson,
    byBristolType,
    latest,
    activityDays
  });
});

// Static file serving and SPA fallback (must come AFTER API routes)
if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(clientIndexPath);
  });
}

app.listen(port, () => {
  console.log(`Pooptracker API laeuft auf http://localhost:${port}`);
});
