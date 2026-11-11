---
name: frontend-style
description: This project's UI conventions — art-deco gold-on-midnight design tokens, animation patterns, portrait/landscape breakpoints, motion toggle, and reusable components (TabHeader, Card, Flag, Modal, chips, stats). Use when building or restyling any tab or component in src/.
---

# Frontend style (Vite + React 18 + TS, plain global CSS)

## Tokens (`:root` in `src/styles.css`)
- **Surfaces and text:** `--bg` #07080b, `--surface`/`-2`/`-3`, `--line` (gold at 14%), `--line-2`, `--text`, `--muted`, `--faint`.
- **Accent:** `--gold` #e9b24c, `--gold-hi`, `--accent-ink`.
- **Item slots:** `--weapon` (orange), `--vitality` (green), `--spirit` (purple).
- **Status:** `--ok`, `--danger`, `--warn`, `--sapphire`.
- **Type:** `--display` (Barlow Condensed) for headings and numbers, `--font` (Inter) for body text.
- **Motion:** `--ease-out`, `--ease-spring`.
- **Spacing:** `--radius` 12px, `--gap` 16px.
- Tier colours live in `TIERS` in `src/lib/trends.ts`.

## Layout
- **Landscape** is `@media (min-aspect-ratio: 5/4) and (min-width: 1100px)`. It uses a 290px side rail, and content scrolls inside `.content`.
- **Everything else** (portrait is the primary target) gets a sticky top tab strip, with `.rail-foot` in the top-right corner.
- **Grids:** `.grid` has a 320px minimum column width; `.grid.wide` has 460px.
- No horizontal scrolling at either size.

## Reuse before writing new markup
- **Components in `components/common.tsx`:**
  - `TabHeader {title, eyebrow, subtitle, contentAsOf, live}`: required on every tab.
  - `Card {title, accent, className}`: pass `className="static"` to turn off the hover lift.
  - `Flag`, `SourceList`.
  - `Img`: has a fallback.
  - `Rich`: renders HTML from the API.
- **Other components:** `Modal` (portal, closes on Esc), and `ItemTile` / `ItemDetail` in `ItemBits.tsx`.
- **CSS classes:** `.chip`, `.btn` / `.btn.primary`, `.stat` (`<b>value</b><span>label</span>`), `.tip`, `.sec`, `.eyebrow`, `.fp-label`, `.seg` / `.seg-btn`, `.delta.up` / `.delta.down`.

## Animation patterns
- **Entrance:** `animation: rise .45s var(--ease-out) both; animation-delay: calc(var(--i) * 50ms)`, with `--i` set inline on each item.
- **Hover:** a small `translateY(-3px)` or `translateX(3px)` with `--ease-spring`, plus a glow `box-shadow` in the element's colour (via `color-mix`).
- **Motion off:** `html[data-motion="off"]` disables motion. Every new infinite or draw animation needs an off-state.
- **Tab switches:** these remount `.tab-anim`, so entrance animations replay.

## Conventions
- **New tab:** create `src/tabs/X.tsx` and export it from `tabs/index.tsx`.
- **Styles:** put them in a topical `styles-*.css` file and import it in `main.tsx`.
- **Content:** load it from `content/*.json`, typed in `lib/content.ts`. Don't hard-code guide text in TSX.
- **Per-browser UI state:** store it in localStorage under `dla.*` keys, wrapped in try/catch.
- **No autofocus on inputs:** it swallows the 1–9 tab hotkeys.
- **File size:** keep files under about 400 lines and split big tabs. `Heroes.tsx` is about 700 lines, so it's a candidate. Smaller files cost fewer tokens to read.
