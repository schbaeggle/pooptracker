# Pooptracker

Mobile-first Single-Page-App zum Tracken von Stuhlgang in einer Gruppe.

## Tech-Stack

- Frontend: Vue 3 + Vite
- Backend: Node.js + Express
- Datenbank: SQLite (better-sqlite3)

## Aktueller Funktionsumfang

- Tracking-Formular:
  - Name aus Dropdown
  - Datum/Uhrzeit standardmaessig vorausgefuellt, aber editierbar
  - Bristol Stool Scale Typ 1-7
  - optionale Bemerkung
- Dashboard:
  - letzte Eintraege
  - Gesamtanzahl
  - Eintraege je Person
  - Bristol-Typ-Verteilung
- Admin-Bereich:
  - Namen hinzufuegen
  - Namen entfernen
  - Zugriff nur nach PIN-Freigabe (4-stellig)
- UI:
  - modernes, kuehles Design in Blau/Grau/Anthrazit

## Projektstruktur

```text
.
├── client
│   └── src
├── server
│   ├── src
│   └── .env(.example)
└── package.json
```

## Voraussetzungen

- Node.js 20+
- npm 10+

## Lokales Setup

1. Abhaengigkeiten installieren:

```bash
npm install
npm install --prefix client
npm install --prefix server
```

2. Admin-PIN konfigurieren:

```bash
cp server/.env.example server/.env
```

Dann in `server/.env` setzen:

```env
ADMIN_PIN=1234
```

Wichtig:
- `ADMIN_PIN` muss genau 4-stellig numerisch sein.
- Ohne gueltige `ADMIN_PIN` startet der Server nicht.

3. Development starten (API + Frontend parallel):

```bash
npm run dev
```

4. App im Browser oeffnen:

```text
http://localhost:5173
```

## NPM-Skripte

Im Root-Verzeichnis:

- `npm run dev` startet Server und Client parallel
- `npm run build` baut das Frontend
- `npm run start` startet den Server im Produktionsmodus

## Admin-PIN-Schutz (aktuell)

- Das Frontend fragt im Admin-Tab eine 4-stellige PIN ab.
- Die PIN wird ueber `POST /api/admin/verify` geprueft.
- Schreibende Admin-Aktionen sind serverseitig geschuetzt und akzeptieren nur Requests mit Header `x-admin-pin`.
- Falsche oder fehlende PIN fuehrt zu einem Fehler (401/403).

## Produktion

Frontend bauen:

```bash
npm run build
```

Server starten:

```bash
npm start
```

Die SQLite-Datei wird automatisch unter `server/data/pooptracker.db` erzeugt.