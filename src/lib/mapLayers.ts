// Turns data/map.json into labelled markers per layer (ids match content/map.json layers).
import { mapData, type Pt } from "./data";
import { mapGuide } from "./content";
import { timeline } from "./timer";

export interface Marker extends Pt {
  key: string;
  layer: string;
  name: string;
  /** 0–2 size step (Haunt tier, objective rank). */
  size?: number;
  team?: number | null;
  /** timeline event id that controls this marker's first spawn */
  spawn?: string;
  /** link line target (teleporters, bounce pad landing spot) */
  to?: Pt | null;
  /** many-of-a-kind pickup drawn as a small dot */
  dense?: boolean;
}

/** Layers with many points get small plain dots instead of glyph badges. */
export const DENSE_LAYERS = new Set(["crates", "containers", "tough", "snacks", "vents", "bounce", "ropes", "veils", "sentries"]);

const titleCase = (s: string) =>
  s
    .replace(/_(camp|neutrals|vault\d?)$/i, "")
    .split("_")
    .filter(Boolean)
    .map((w) => (/^\d+$/.test(w) ? String(+w) : w[0].toUpperCase() + w.slice(1)))
    .join(" ");

// ----- lanes: zipline colour → lane name (content/map.json) -----
const laneName = (color: string) => mapGuide.lanes.find((l) => l.color.toLowerCase() === color.toLowerCase())?.name ?? "Lane";
const midX = (pts: Pt[]) => {
  const mid = pts.filter((p) => p.y > 0.3 && p.y < 0.7);
  const use = mid.length ? mid : pts;
  return use.reduce((a, p) => a + p.x, 0) / use.length;
};
export const lanes = mapData.ziplines.map((z) => {
  // label sits on the zipline point closest to the map's horizontal middle
  const label = z.points.reduce((best, p) => (Math.abs(p.y - 0.5) < Math.abs(best.y - 0.5) ? p : best), z.points[0]);
  return { color: z.color, name: laneName(z.color), points: z.points, label, x: midX(z.points) };
});

/** Objective lane numbers → nearest zipline by average x. */
const laneByNumber = new Map<number, string>();
for (const n of new Set(mapData.objectives.map((o) => o.lane).filter((l): l is number => l != null))) {
  const xs = mapData.objectives.filter((o) => o.lane === n);
  const ax = xs.reduce((a, o) => a + o.x, 0) / xs.length;
  const near = lanes.reduce((b, l) => (Math.abs(l.x - ax) < Math.abs(b.x - ax) ? l : b), lanes[0]);
  if (near) laneByNumber.set(n, near.name);
}

// ----- teams: whichever team's base sentries sit lower on the map is "south" -----
const avgY = (team: number) => {
  const s = mapData.baseSentries.filter((b) => b.team === team);
  return s.length ? s.reduce((a, p) => a + p.y, 0) / s.length : team ? 0 : 1;
};
const southTeam = avgY(0) > avgY(1) ? 0 : 1;
export const teamSide = (team: number | null | undefined) => (team == null ? "" : team === southTeam ? "south" : "north");
export const teamColor = (team: number | null | undefined) =>
  team == null ? "var(--gold)" : team === southTeam ? "var(--amber)" : "var(--sapphire)";
export const bases = [southTeam, 1 - southTeam].map((team) => {
  const s = mapData.baseSentries.filter((b) => b.team === team);
  const x = s.reduce((a, p) => a + p.x, 0) / (s.length || 1);
  const y = s.reduce((a, p) => a + p.y, 0) / (s.length || 1);
  return { team, color: teamColor(team), label: `${teamSide(team)} base`.toUpperCase(), x, y: team === southTeam ? y - 0.075 : y + 0.075 };
});

// ----- markers -----
const OBJ: Record<string, { name: string; size: number }> = {
  tier1: { name: "Guardian", size: 1 },
  tier2: { name: "Walker", size: 2 },
  titan: { name: "Patron", size: 2 },
};
const HAUNT_TIER: Record<string, number> = { weak: 0, medium: 1, strong: 2 };
const SHOP: Record<string, string> = { lane: "Lane shop", base: "Base shop", secret: "Secret shop" };

const plain = (layer: string, pts: Pt[], name: string, spawn?: string): Marker[] =>
  pts.map((p, i) => ({ key: `${layer}${i}`, layer, name, x: p.x, y: p.y, spawn }));

const sp = (layer: string, i = 0) => mapGuide.spawns[layer]?.[i];

const allMarkers: Marker[] = [
  ...mapData.objectives
    .filter((o) => OBJ[o.kind]) // "core" points fall outside the reworked map — see content flags
    .map((o) => ({
      key: o.key,
      layer: "objectives",
      name: [o.lane != null ? laneByNumber.get(o.lane) : null, OBJ[o.kind].name].filter(Boolean).join(" ") + ` (${teamSide(o.team)})`,
      size: OBJ[o.kind].size,
      team: o.team,
      x: o.x,
      y: o.y,
    })),
  ...mapData.baseSentries.map((s, i) => ({ key: `sentry${i}`, layer: "sentries", name: `Base sentry (${teamSide(s.team)})`, team: s.team, x: s.x, y: s.y })),
  ...mapData.shops.map((s, i) => ({
    key: `shop${i}`,
    layer: "shops",
    name: (SHOP[s.kind] ?? "Shop") + (s.team != null ? ` (${teamSide(s.team)})` : ""),
    team: s.team,
    size: s.kind === "base" ? 2 : 1,
    x: s.x,
    y: s.y,
  })),
  ...mapData.camps.map((c, i): Marker => {
    if (c.kind === "vault") return { key: `camp${i}`, layer: "sinners", name: `Sinner's Sacrifice · ${titleCase(c.name)}`, x: c.x, y: c.y, spawn: sp("sinners") };
    const tier = HAUNT_TIER[c.kind] ?? 1;
    return { key: `camp${i}`, layer: "haunts", name: `Tier ${"I".repeat(tier + 1)} Haunt · ${titleCase(c.name)}`, size: tier, x: c.x, y: c.y, spawn: sp("haunts", tier) };
  }),
  ...plain("urn", mapData.soulUrnSpawns, "Soul Urn spawn", sp("urn")),
  ...mapData.soulUrnPads.map((p, i) => ({ key: `urnpad${i}`, layer: "urn", name: "Urn drop-off pad", size: 2, x: p.x, y: p.y, spawn: sp("urn") })),
  ...plain("rift", mapData.rifts, "Unstable Rift", sp("rift")),
  ...plain("powerups", mapData.bridgeBuffs, "Bridge powerup", sp("powerups")),
  ...plain("bells", mapData.bells, "Bell"),
  ...mapData.teleporters.map((t, i) => ({ key: `tp${i}`, layer: "teleporters", name: "Teleporter", x: t.x, y: t.y, to: t.to })),
  ...plain("vents", mapData.steamVents, "Steam Vent"),
  ...mapData.bouncePads.map((b, i) => ({ key: `bounce${i}`, layer: "bounce", name: "Bounce pad", x: b.x, y: b.y, to: b.to })),
  ...plain("ropes", mapData.climbRopes, "Climb rope"),
  ...plain("veils", mapData.cosmicVeils, "Cosmic Veil"),
  ...plain("containers", mapData.buffContainers, "Buff Container", sp("containers")),
  ...plain("snacks", mapData.healingSnacks, "Healing Snack"),
  ...plain("tough", mapData.toughCrates, "Tough Crate"),
  ...plain("crates", mapData.crates, "Crate", sp("crates")),
];
export const markers = allMarkers.map((m) => (DENSE_LAYERS.has(m.layer) ? { ...m, dense: true } : m));
export const markerByKey = new Map(markers.map((m) => [m.key, m]));

export const countByLayer = markers.reduce<Record<string, number>>((acc, m) => ((acc[m.layer] = (acc[m.layer] ?? 0) + 1), acc), {
  lanes: lanes.length,
});

/** First-spawn time (match seconds) of a timeline event id, from content/timeline.json. */
export const spawnAt = (eventId?: string) => (eventId ? timeline.events.find((e) => e.id === eventId)?.at : undefined);

/** Earliest first-spawn time for a layer (for the legend badge). */
export const layerSpawn = (layer: string) => {
  const ts = (mapGuide.spawns[layer] ?? []).map(spawnAt).filter((t): t is number => t != null);
  return ts.length ? Math.min(...ts) : undefined;
};
