---
name: deadlock-api
description: deadlock-api.com endpoints, query params and data quirks, plus the refresh-data / after-patch workflow (scripts/refresh-data.mjs → data/*.json). Use when fetching live stats, adding an analytics feature (src/lib/api.ts, trends.ts), changing the refresh script, or updating data after a patch.
---

# deadlock-api.com and the data pipeline

## Endpoints
The API is MIT-licensed, serves CORS `*`, allows 200 requests/min per IP, and caches responses server-side for 1h.

- **Assets:** `https://api.deadlock-api.com/v1/assets/{heroes,items,map,ranks}`.
- **Analytics** (`https://api.deadlock-api.com/v1/analytics/...`):
  - `hero-stats`: takes `min_unix_timestamp`, `max_unix_timestamp`, `game_mode=normal`, `min_average_badge`, `max_average_badge`. Add `bucket=start_time_day` for per-day rows (hero_id, bucket, wins, matches).
  - `hero-counter-stats`: ordered pairs, `hero_id` vs `enemy_hero_id`, with `wins` and `matches_played`. Also supports `min_matches` and `same_lane_filter`.
  - `hero-synergy-stats`: unordered pairs, `hero_id1` and `hero_id2`.
  - Used by Stats & Meta (`lib/metaStats.ts`, via `getAnalytics()` in `api.ts`):
    - `game-stats` (`bucket=start_time_day`): per-day `total_matches`, `team0_wins`/`team1_wins` and per-player `avg_*` fields, including the `avg_gold_*` soul sources.
    - `badge-distribution`: `unique_players` per badge, by each player's latest ranked match. It ignores badge filters.
    - `hero-ban-stats`: takes `match_mode` only, not `game_mode`. Ban rate = bans ÷ matches, counting only matches with ban data.
    - `item-stats`: wins, matches and `avg_buy_time_s` per item, per player-game.
- The full parameter list is in `https://api.deadlock-api.com/openapi.json`. Query it with node rather than reading the whole file.

## Quirks
- **Badge** = tier×10 + subtier. Tiers 0–11 are Obscurus, Initiate, Seeker, Acolyte, Sentinel, Mystic, Ritualist, Emissary, Oracle, Phantom, Ascendant and Eternus. The badge filter applies to the average of both teams.
- **Pick rate:** total matches = (sum of hero matches) ÷ 12. Pick rate = hero matches ÷ total matches.
- **Released heroes:** filter with `player_selectable && !disabled && development_state === "release"`. This gives 44 heroes.
- **Shop items:** tiers 1–4 cost 800/1600/3200/6400. Tier 5 (cost 9999) is Street Brawl only, so it's excluded.
- **Map coordinates:** `left = (x+R)/(2R)`, `top = (R-y)/(2R)`, with R = 10752. `data/map.json` already stores relative coordinates for objectives, camps, ziplines, shops, vents, urns, rifts, bells, crates and the rest.
- **Busy API:** a 503 or 504 means the API is busy. Show a friendly message and never fall back to made-up numbers.
- **Known gap:** Mina's "Rake" has no description in the source data. This is expected.

## After a patch
1. Run `npm run refresh-data -- "<patch label>"`. It prints hero and item diffs, and any hero-notes entries that are missing or orphaned.
2. Update `content/hero-notes.json` for any new heroes.
3. Re-check `content/*.json` against the patch notes (see the deadlock-knowledge skill), then run `npm run build`.

## Testing tips
- Node 24 has `fetch` built in. Write probe scripts to `$TEMP`, because inline `node -e` quoting breaks on Windows.
- To unit-test the TS libraries, bundle them with `npx esbuild file.ts --bundle --platform=node --loader:.json=json` and stub `localStorage`.
