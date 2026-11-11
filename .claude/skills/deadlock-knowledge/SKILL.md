---
name: deadlock-knowledge
description: Deadlock game facts for this project — verified match timings, objectives, mechanics, patch history (City Never Sleeps Sep 29 2026 → Oct 30 2026), source hierarchy and fact-checking rules. Use when writing or checking guide content (content/*.json), timelines, map labels, tips, or anything stating how the game works.
---

# Deadlock knowledge

## Look here first (before any web research)
Verified facts already live in the repo. Read the relevant file instead of re-researching:
- `content/timeline.json`: spawn times, respawn curve, trooper waves and phases. It is sourced from deadlock.wiki pages, which are listed in the file.
- `content/concepts.json`: the tower chain (Guardian → Walker → Base Guardians → Shrines → Patron/Weakened Patron), souls, kit and map features.
- `content/mistakes.json`, `content/items-guide.json` (shop rules) and `content/hero-notes.json` (a beginner tip per hero).
- `data/*.json`: hero, item and map data from the API. This is ground truth for names, costs and positions.

Only research the web when a fact is missing or a newer patch exists. Check the latest patch date on https://deadlock.wiki/Patches.

## Source hierarchy
1. Game data API (`data/*.json`, deadlock-api.com).
2. Official patch notes: the forum thread at https://forums.playdeadlock.com/forums/changelog.10/ and the wiki `Update:<Month_D,_YYYY>` pages.
3. deadlock.wiki mechanic pages. Prefer pages edited after the latest patch. Wiki images can't be used; their policy restricts them to the wiki.
4. Statlocker and Tracklock: link to them only. They have no API and no reuse terms.

## Patch context (as of 2026-11-04)
- **Sep 29 2026, "City Never Sleeps" (major):**
  - Map rework, with Steam Vents added.
  - Neutrals renamed **Haunts**; Golden Statues renamed **Buff Containers**.
  - New Tough Crates (opened with heavy melee) and Healing Snacks.
  - Six new heroes released by Oct 20: Rat King, Baba, Solomon, Deadman Danny, Violet, Nurse Harrow.
- **Oct 5 and Oct 14:** hero balance only, plus a fix for troopers walking too slowly.
- **Oct 30 (Halloween + Gameplay):**
  - Mid-Boss: +20% HP, bounty 1500 (+25/min). The Rejuvenator now drops as 3 crystals you break with heavy melee.
  - Haunts +10%.
  - Healing Snacks heal 14% of max HP.
  - Steam Vents give +150% stamina regen.
  - Comeback souls are capped at 30%.
  - Halloween Cauldrons run until Nov 2.

## Known gaps and conflicts (keep these flagged)
- The wiki Powerups page predates Sep 29 2026, so the "5:00, then every 5 min" timing may have changed.
- Unstable Rift spawns vary by about ±1 min.
- Sinner's Sacrifice has "variable timings", with no details.
- Respawn time before 5:00 is undocumented.
- Shrine bullet resist is listed as both 10% and 20%.
- When Walker backdoor protection turns off isn't verified.
- Default keybinds aren't verified yet; this is needed for M6.

## Writing rules
- No comparisons to League of Legends or any other game.
- Quote numbers exactly as the source gives them, and add the source to the file's `sources`.
- Put anything uncertain in `flags[]`, or mark the item `"flag": true`.
- When a file is re-checked against a newer patch, bump its `asOfPatch`.
