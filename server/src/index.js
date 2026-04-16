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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseYmdToLocalDate(value) {
  if (!DATE_RE.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDashboardRange() {
  const settingsRows = db
    .prepare(
      `SELECT setting_key, setting_value
       FROM app_settings
       WHERE setting_key IN ('dashboard_start_date', 'dashboard_end_date')`
    )
    .all();

  const settings = Object.fromEntries(
    settingsRows.map((row) => [row.setting_key, row.setting_value])
  );

  const parsedStart = parseYmdToLocalDate(settings.dashboard_start_date || '');
  const parsedEnd = parseYmdToLocalDate(settings.dashboard_end_date || '');

  if (parsedStart && parsedEnd && parsedStart <= parsedEnd) {
    return {
      startDate: toLocalDateKey(parsedStart),
      endDate: toLocalDateKey(parsedEnd)
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fallbackStart = new Date(today);
  fallbackStart.setDate(today.getDate() - 13);

  return {
    startDate: toLocalDateKey(fallbackStart),
    endDate: toLocalDateKey(today)
  };
}

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

app.put('/api/admin/dashboard-range', requireAdminPin, (req, res) => {
  const startDate = String(req.body?.startDate || '').trim();
  const endDate = String(req.body?.endDate || '').trim();

  const parsedStart = parseYmdToLocalDate(startDate);
  const parsedEnd = parseYmdToLocalDate(endDate);

  if (!parsedStart || !parsedEnd) {
    return res.status(400).json({ error: 'Start- und Enddatum sind erforderlich (YYYY-MM-DD).' });
  }

  if (parsedStart > parsedEnd) {
    return res.status(400).json({ error: 'Startdatum darf nicht nach dem Enddatum liegen.' });
  }

  const upsertSetting = db.prepare(
    `INSERT INTO app_settings(setting_key, setting_value)
     VALUES (?, ?)
     ON CONFLICT(setting_key) DO UPDATE
     SET setting_value = excluded.setting_value,
         updated_at = CURRENT_TIMESTAMP`
  );

  const tx = db.transaction(() => {
    upsertSetting.run('dashboard_start_date', startDate);
    upsertSetting.run('dashboard_end_date', endDate);
  });
  tx();

  return res.json({ startDate, endDate });
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
  const { startDate, endDate } = getDashboardRange();
  const startLocal = parseYmdToLocalDate(startDate);
  const endLocal = parseYmdToLocalDate(endDate);
  const averages = db
    .prepare(
      `SELECT AVG(bristol_type) AS avg_bristol_type, AVG(rating) AS avg_rating
       FROM entries
       WHERE date(happened_at, 'localtime') BETWEEN ? AND ?`
    )
    .get(startDate, endDate);

  const totalEntriesInRange = db
    .prepare(
      `SELECT COUNT(*) AS value
       FROM entries
       WHERE date(happened_at, 'localtime') BETWEEN ? AND ?`
    )
    .get(startDate, endDate).value;

  const perPerson = db
    .prepare(
      `SELECT p.id, p.name, COUNT(e.id) AS count
       FROM people p
       LEFT JOIN entries e
         ON e.person_id = p.id
        AND date(e.happened_at, 'localtime') BETWEEN ? AND ?
       GROUP BY p.id, p.name
       ORDER BY count DESC, p.name ASC`
    )
    .all(startDate, endDate);

  const byBristolType = db
    .prepare(
      `SELECT bristol_type AS type, COUNT(*) AS count
       FROM entries
       WHERE date(happened_at, 'localtime') BETWEEN ? AND ?
       GROUP BY bristol_type
       ORDER BY bristol_type ASC`
    )
     .all(startDate, endDate)
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
       WHERE date(e.happened_at, 'localtime') BETWEEN ? AND ?
       ORDER BY datetime(e.happened_at) DESC
       LIMIT 10`
    )
     .all(startDate, endDate)
    .map(mapEntry);

  const activityRaw = db
    .prepare(
      `SELECT date(happened_at, 'localtime') AS date, COUNT(*) AS count
       FROM entries
       WHERE date(happened_at, 'localtime') BETWEEN ? AND ?
       GROUP BY date(happened_at, 'localtime')
       ORDER BY date ASC`
    )
     .all(startDate, endDate);

  const dailyBristolRaw = db
    .prepare(
      `SELECT
         date(happened_at, 'localtime') AS date,
         COUNT(*) AS count,
         AVG(bristol_type) AS average_bristol_type
       FROM entries
       WHERE date(happened_at, 'localtime') BETWEEN ? AND ?
       GROUP BY date(happened_at, 'localtime')
       ORDER BY date ASC`
    )
     .all(startDate, endDate);

  const activityMap = new Map(activityRaw.map((row) => [row.date, row.count]));
  const dailyBristolMap = new Map(
    dailyBristolRaw.map((row) => [row.date, { count: row.count, averageBristolType: row.average_bristol_type }])
  );
  const activityDays = [];
  const dailyBristolTrend = [];
  const rangeStart = startLocal || new Date();
  const rangeEnd = endLocal || new Date();

  for (let day = new Date(rangeStart); day <= rangeEnd; day.setDate(day.getDate() + 1)) {
    const dateKey = toLocalDateKey(day);
    activityDays.push({ date: dateKey, count: activityMap.get(dateKey) ?? 0 });

    const dailyBristol = dailyBristolMap.get(dateKey);
    dailyBristolTrend.push({
      date: dateKey,
      count: dailyBristol?.count ?? 0,
      averageBristolType: dailyBristol?.averageBristolType ?? null
    });
  }

  res.json({
    totalEntries: totalEntriesInRange,
    averageBristolType: averages?.avg_bristol_type ?? null,
    averageRating: averages?.avg_rating ?? null,
    rangeStartDate: startDate,
    rangeEndDate: endDate,
    perPerson,
    byBristolType,
    latest,
    activityDays,
    dailyBristolTrend
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
