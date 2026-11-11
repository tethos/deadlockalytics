# Deadlockalytics

A personal second-screen companion for Valve's Deadlock. It runs locally.

## Commands
| Command | What it does |
|---|---|
| `npm run dev` | Starts the site at http://localhost:5173 |
| `npm run refresh-data` | Downloads the latest heroes, items, map and ranks from deadlock-api.com into `data/` |
| `npm run refresh-data -- "Minor 2026-11-12"` | Does the same and also sets a new patch label, which the site shows on every tab |
| `npm run build` | Type-checks the code and builds the site into `dist/` (optional) |

## After a patch
1. Run `npm run refresh-data -- "<patch name>"`. It prints which heroes were added or removed and which item costs changed.
2. If it lists heroes without beginner notes, update `content/hero-notes.json`.
3. Check the patch notes against the files in `content/`. Each one records the patch its text was written for (`asOfPatch`).

## Layout
- `data/`: generated game data. Don't edit it by hand; re-run the refresh script instead.
- `content/`: the hand-written guide text, safe to edit.
- `src/`: the React app (Vite + TypeScript).
- `scripts/refresh-data.mjs`: the data refresh script.
