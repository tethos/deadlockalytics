// Typed access to the generated game-data snapshot (/data, written by `npm run refresh-data`).
import heroesJson from "../../data/heroes.json";
import itemsJson from "../../data/items.json";
import mapJson from "../../data/map.json";
import ranksJson from "../../data/ranks.json";
import metaJson from "../../data/meta.json";

export type Source = { label: string; url: string };

export interface Ability {
  slot: number;
  name: string;
  image: string | null;
  quip: string | null;
  desc: string;
  upgrades: (string | null)[];
  cooldown: string | null;
}
export interface PopularItem { id: number; pick: number; win: number }
export interface Hero {
  id: number;
  name: string;
  className: string;
  type: string | null;
  complexity: number | null;
  tags: string[];
  role: string | null;
  playstyle: string | null;
  images: { card: string | null; small: string | null; minimap: string | null };
  abilities: Ability[];
  popularItems: { timestamp: number; early: PopularItem[]; mid: PopularItem[]; late: PopularItem[] } | null;
}
export type Slot = "weapon" | "vitality" | "spirit";
export interface Item {
  id: number;
  name: string;
  slot: Slot;
  tier: number;
  cost: number;
  active: boolean;
  activation: string;
  image: string | null;
  text: string;
  props: { label: string; value: string; cls: string }[];
  components: string[];
}
export interface Rank { tier: number; name: string; image: string | null; color: string | null }
export interface Meta {
  fetchedAt: string;
  patchLabel: string;
  patchDate: string;
  counts: { heroes: number; items: number };
  sources: Source[];
}
export type Pt = { x: number; y: number };
export interface MapData {
  radius: number;
  images: Record<string, string>;
  objectives: (Pt & { key: string; team: number | null; kind: string; lane: number | null })[];
  camps: (Pt & { name: string; kind: string })[];
  ziplines: { color: string; points: Pt[] }[];
  shops: (Pt & { kind: string; team: number | null })[];
  steamVents: Pt[];
  teleporters: (Pt & { to: Pt | null })[];
  soulUrnPads: Pt[];
  soulUrnSpawns: Pt[];
  rifts: Pt[];
  bells: Pt[];
  buffContainers: Pt[];
  healingSnacks: Pt[];
  toughCrates: Pt[];
  crates: Pt[];
  bridgeBuffs: Pt[];
  baseSentries: (Pt & { team: number | null })[];
  bouncePads: (Pt & { to: Pt | null })[];
  climbRopes: Pt[];
  cosmicVeils: Pt[];
}

export const heroes = heroesJson as Hero[];
export const items = itemsJson as Item[];
export const mapData = mapJson as MapData;
export const ranks = ranksJson as Rank[];
export const meta = metaJson as Meta;

export const itemById = new Map(items.map((i) => [i.id, i]));
export const itemByName = new Map(items.map((i) => [i.name.toLowerCase(), i]));
export const heroByName = new Map(heroes.map((h) => [h.name.toLowerCase(), h]));

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

/** Lower-case, accent- and punctuation-insensitive match: every query word must appear. */
export function matches(haystack: string, query: string) {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^\w\s]/g, "");
  const h = norm(haystack);
  return norm(query).split(/\s+/).filter(Boolean).every((w) => h.includes(w));
}
