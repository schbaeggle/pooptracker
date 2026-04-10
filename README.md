# Pooptracker

Mobile-first Single-Page-App zum Tracken von Stuhlgang in einer Gruppe.

## Stack

- Frontend: Vue 3 + Vite
- Backend: Node.js + Express
- Datenbank: SQLite (better-sqlite3)

## Features

- Erfassungsmaske mit:
	- Name aus Dropdown
	- Datum/Uhrzeit standardmaessig vorausgefuellt (aktuell), aber editierbar
	- Bristol Stool Scale Typ 1-7
	- optionale Bemerkung
- Dashboard mit:
	- letzten Eintraegen
	- Gesamtanzahl
	- Eintraegen je Person
	- Bristol-Typ-Verteilung
- Admin-Bereich:
	- Namen hinzufuegen
	- Namen entfernen

## Lokaler Start

1. Abhaengigkeiten installieren:

	 npm install
	 npm install --prefix client
	 npm install --prefix server

2. Development starten (API + Frontend parallel):

	 npm run dev

3. App im Browser oeffnen:

	 http://localhost:5173

## Produktion

- Frontend bauen:

	npm run build

- Server starten:

	npm start

Die SQLite-Datei wird automatisch unter `server/data/pooptracker.db` erzeugt.