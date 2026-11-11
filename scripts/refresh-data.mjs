#!/usr/bin/env node
// Refreshes the game-data snapshot in /data from deadlock-api.com (MIT, free, not affiliated with Valve).
//
// Usage:
//   npm run refresh-data                          -> keep the current patch label
//   npm run refresh-data -- "Minor 2026-11-12"    -> set a new patch label (and patch date = today)
//
// Prints a diff (new/removed heroes, changed item costs) and lists hand-written
// hero notes in /content that are missing or orphaned, so you know what to update.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const CONTENT = path.join(ROOT, "content");
const API = "https://api.deadlock-api.com/v1/assets";

async function get(p) {
  const res = await fetch(`${API}/${p}`);
  if (!res.ok) throw new Error(`GET ${p} -> HTTP ${res.status}`);
  return res.json();
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

/** Remove inline SVG icons + anything but simple markup; keep <span class="highlight">, <br>, <b>, <i>. */
function cleanHtml(s) {
  if (!s) return "";
  return s
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<(?!\/?(span|br|b|i|strong|em)\b)[^>]+>/gi, "")
    // keep only the class attribute on allowed tags (drops inline styles / handlers)
    .replace(/<(span|br|b|i|strong|em)\b([^>]*)>/gi, (_, tag, attrs) => {
      const cls = attrs.match(/class\s*=\s*"([^"]*)"/i);
      return cls ? `<${tag} class="${cls[1].replace(/[^\w\s-]/g, "")}">` : `<${tag}>`;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function propList(item, names) {
  const out = [];
  for (const k of names) {
    const p = item.properties?.[k];
    if (!p || !p.label) continue;
    const v = String(p.value ?? "");
    if (!v || v === "0" || v === "-1" || v === "-1.0") continue;
    const post = p.postfix && !v.endsWith(p.postfix) ? p.postfix : "";
    out.push({ label: p.label, value: v + post, cls: p.css_class || "" });
  }
  return out;
}

function itemSummary(item) {
  const sections = item.tooltip_sections || [];
  let text = cleanHtml(item.description?.desc);
  const names = new Set();
  for (const s of sections) {
    for (const a of s.section_attributes || []) {
      if (!text && a.loc_string) text = cleanHtml(a.loc_string);
      for (const k of [...(a.elevated_properties || []), ...(a.important_properties || []), ...(a.properties || [])]) names.add(k);
    }
  }
  return { text, props: propList(item, [...names]) };
}

const toRel = (radius, [x, y]) => ({
  x: +((x + radius) / (2 * radius)).toFixed(4),
  y: +((radius - y) / (2 * radius)).toFixed(4),
});

async function main() {
  const labelArg = process.argv.slice(2).join(" ").trim();
  console.log("Fetching from deadlock-api.com …");
  const [heroesRaw, itemsRaw, mapRaw, ranksRaw] = await Promise.all([
    get("heroes"),
    get("items"),
    get("map"),
    get("ranks"),
  ]);

  const byClass = new Map(itemsRaw.map((i) => [i.class_name, i]));
  const byId = new Map(itemsRaw.map((i) => [i.id, i]));

  // ---------- heroes ----------
  const heroes = heroesRaw
    .filter((h) => h.player_selectable && !h.disabled && h.development_state === "release")
    .map((h) => {
      const abilities = ["signature1", "signature2", "signature3", "signature4"]
        .map((slot, idx) => {
          const a = byClass.get(h.items?.[slot]);
          if (!a) return null;
          const cd = a.properties?.AbilityCooldown?.value;
          const d = a.description || {};
          const fix = (s) => cleanHtml(s).replaceAll("{s:hero_name}", h.name);
          const fromTooltip = (a.tooltip_details?.info_sections || [])
            .map((s) => s.loc_string)
            .filter((s) => s && !s.startsWith("#")) // "#ability_…" = untranslated key
            .map(fix)
            .join("<br><br>");
          const desc =
            (d.desc ? fix(d.desc) : [d.passive, d.active].filter(Boolean).map(fix).join("<br><br>")) || fromTooltip;
          return {
            slot: idx + 1,
            name: a.name,
            image: a.image_webp || a.image || null,
            quip: d.quip ? fix(d.quip) : null,
            desc,
            upgrades: [d.t1_desc, d.t2_desc, d.t3_desc].map((t) => (t ? fix(t) : null)),
            cooldown: cd && cd !== "0" ? `${cd}s` : null,
          };
        })
        .filter(Boolean);
      const pop = (arr) =>
        (arr || [])
          .map((p) => ({ id: p.item_id, pick: +p.pick_pct.toFixed(1), win: +p.winrate_pct.toFixed(1) }))
          .filter((p) => byId.has(p.id));
      return {
        id: h.id,
        name: h.name,
        className: h.class_name,
        type: h.hero_type ?? null,
        complexity: h.complexity ?? null,
        tags: h.tags || [],
        role: cleanHtml(h.description?.role) || null,
        playstyle: cleanHtml(h.description?.playstyle) || null,
        images: {
          card: h.images?.icon_hero_card_webp || h.images?.icon_hero_card || null,
          small: h.images?.icon_image_small_webp || h.images?.icon_image_small || null,
          minimap: h.images?.minimap_image_webp || h.images?.minimap_image || null,
        },
        abilities,
        popularItems: h.popular_items
          ? {
              timestamp: h.popular_items.timestamp,
              early: pop(h.popular_items.early_game),
              mid: pop(h.popular_items.mid_game),
              late: pop(h.popular_items.late_game),
            }
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // ---------- items (normal shop only; tier 5 / cost 9999 are Street Brawl items) ----------
  const items = itemsRaw
    .filter((i) => i.type === "upgrade" && i.shopable && !i.disabled && i.item_tier >= 1 && i.item_tier <= 4)
    .map((i) => {
      const { text, props } = itemSummary(i);
      return {
        id: i.id,
        name: i.name,
        slot: i.item_slot_type,
        tier: i.item_tier,
        cost: i.cost,
        active: i.activation !== "passive",
        activation: i.activation,
        image: i.shop_image_webp || i.shop_image || i.image_webp || i.image || null,
        text,
        props,
        components: (i.component_items || []).map((c) => byClass.get(c)?.name).filter(Boolean),
      };
    })
    .sort((a, b) => a.slot.localeCompare(b.slot) || a.tier - b.tier || a.name.localeCompare(b.name));

  // ---------- map ----------
  const R = mapRaw.radius;
  const rel = (o) => ({ x: o.left_relative, y: o.top_relative });
  const ents = mapRaw.entities || {};
  const pick = (k, extra = () => ({})) => (ents[k] || []).map((e) => ({ ...rel(e), ...extra(e) }));
  const map = {
    radius: R,
    images: mapRaw.images,
    objectives: Object.entries(mapRaw.objective_positions).map(([key, o]) => {
      const m = key.match(/^team(\d)_(core|titan|tier1|tier2)(?:_(\d))?$/);
      return { key, team: m ? +m[1] : null, kind: m ? m[2] : key, lane: m?.[3] ? +m[3] : null, ...rel(o) };
    }),
    camps: mapRaw.neutral_camps.map((c) => ({ name: c.name, kind: c.kind, ...rel(c) })),
    ziplines: mapRaw.zipline_paths.map((z) => ({
      color: z.color,
      points: z.P0_points.map((p) => toRel(R, [z.origin[0] + p[0], z.origin[1] + p[1]])),
    })),
    shops: pick("shops", (e) => ({ kind: e.kind, team: e.team ?? null })),
    steamVents: pick("steam_vents"),
    teleporters: (ents.teleporters || []).map((e) => ({ ...rel(e), to: e.target ? toRel(R, e.target) : null })),
    soulUrnPads: pick("soul_urn_pads"),
    soulUrnSpawns: pick("soul_urn_spawns"),
    rifts: pick("unstable_rifts"),
    bells: pick("bells"),
    buffContainers: pick("golden_statues"),
    healingSnacks: pick("healing_snacks"),
    toughCrates: pick("tough_crates"),
    crates: pick("crates"),
    bridgeBuffs: pick("bridge_buffs"),
    baseSentries: pick("base_sentries", (e) => ({ team: e.team ?? null })),
    bouncePads: pick("bounce_pads", (e) => ({ to: e.target ? toRel(R, e.target) : null })),
    climbRopes: pick("climb_ropes"),
    cosmicVeils: pick("cosmic_veils"),
  };

  // ---------- ranks ----------
  const ranks = ranksRaw.map((r) => ({
    tier: r.tier,
    name: r.name,
    image: r.images?.small_webp || r.images?.large_webp || r.images?.large || null,
    color: r.color || null,
  }));

  // ---------- diff + meta ----------
  const oldHeroes = await readJson(path.join(DATA, "heroes.json"), []);
  const oldItems = await readJson(path.join(DATA, "items.json"), []);
  const oldMeta = await readJson(path.join(DATA, "meta.json"), {});
  const oldHeroNames = new Set(oldHeroes.map((h) => h.name));
  const newHeroNames = new Set(heroes.map((h) => h.name));
  const oldItemMap = new Map(oldItems.map((i) => [i.id, i]));

  const today = new Date().toISOString().slice(0, 10);
  const meta = {
    fetchedAt: new Date().toISOString(),
    patchLabel: labelArg || oldMeta.patchLabel || "Halloween 2026 + Gameplay Update",
    patchDate: labelArg ? today : oldMeta.patchDate || "2026-10-30",
    counts: { heroes: heroes.length, items: items.length },
    sources: [
      { label: "deadlock-api.com — Game Data API (MIT)", url: "https://api.deadlock-api.com/docs" },
    ],
  };

  await mkdir(DATA, { recursive: true });
  const write = (name, obj) => writeFile(path.join(DATA, name), JSON.stringify(obj, null, 1) + "\n");
  await Promise.all([
    write("heroes.json", heroes),
    write("items.json", items),
    write("map.json", map),
    write("ranks.json", ranks),
    write("meta.json", meta),
  ]);

  console.log(`\n✔ Wrote ${heroes.length} heroes, ${items.length} shop items, map, ${ranks.length} ranks.`);
  console.log(`  Patch label: ${meta.patchLabel} (${meta.patchDate})`);
  if (oldHeroes.length) {
    const added = [...newHeroNames].filter((n) => !oldHeroNames.has(n));
    const removed = [...oldHeroNames].filter((n) => !newHeroNames.has(n));
    if (added.length) console.log(`  + New heroes: ${added.join(", ")}`);
    if (removed.length) console.log(`  - Removed heroes: ${removed.join(", ")}`);
    const changed = [];
    for (const i of items) {
      const o = oldItemMap.get(i.id);
      if (!o) changed.push(`+ ${i.name} (new, ${i.cost})`);
      else if (o.cost !== i.cost || o.tier !== i.tier) changed.push(`~ ${i.name}: ${o.cost} → ${i.cost}`);
    }
    for (const o of oldItems) if (!items.some((i) => i.id === o.id)) changed.push(`- ${o.name} (removed)`);
    if (changed.length) console.log("  Item changes:\n    " + changed.join("\n    "));
    if (!added.length && !removed.length && !changed.length) console.log("  No hero/item roster or cost changes.");
  }

  // ---------- check hand-written notes ----------
  const notesFile = path.join(CONTENT, "hero-notes.json");
  if (existsSync(notesFile)) {
    const notes = await readJson(notesFile, { heroes: {} });
    const noted = new Set(Object.keys(notes.heroes || {}));
    const missing = heroes.filter((h) => !noted.has(h.name)).map((h) => h.name);
    const orphan = [...noted].filter((n) => !newHeroNames.has(n));
    if (missing.length) console.log(`  ⚠ Heroes without beginner notes: ${missing.join(", ")}`);
    if (orphan.length) console.log(`  ⚠ Notes for unknown heroes (renamed/removed?): ${orphan.join(", ")}`);
    console.log(`  Hand-written content is marked as of patch: ${notes.asOfPatch ?? "?"} — review it if the patch changed.`);
  }
}

main().catch((e) => {
  console.error("✖ refresh-data failed:", e.message);
  process.exit(1);
});
