// Hand-written guide content (/content). Edit the JSON files; the site picks changes up live.
import heroNotesJson from "../../content/hero-notes.json";
import itemsGuideJson from "../../content/items-guide.json";
import conceptsJson from "../../content/concepts.json";
import mistakesJson from "../../content/mistakes.json";
import type { Slot, Source } from "./data";

export interface HeroNotes {
  asOfPatch: string;
  method: string;
  sources: Source[];
  flags: string[];
  beginnerPicks: { hero: string; why: string }[];
  heroes: Record<string, { tip: string }>;
}
export interface ItemsGuide {
  asOfPatch: string;
  sources: Source[];
  flags: string[];
  categories: { slot: Slot; name: string; color: string; what: string; bonus: string }[];
  rules: { title: string; text: string }[];
  principles: string[];
}

export const heroNotes = heroNotesJson as HeroNotes;
export const itemsGuide = itemsGuideJson as ItemsGuide;

export interface Concepts {
  asOfPatch: string;
  sources: Source[];
  flags: string[];
  tldr: string[];
  chain: { name: string; count: string; facts: string[] }[];
  sections: { id: string; icon: string; title: string; points: string[] }[];
  firstMatches: string[];
}
export interface MistakesGuide {
  asOfPatch: string;
  method: string;
  sources: Source[];
  flags: string[];
  groups: { id: string; title: string; icon: string; items: { id: string; bad: string; fix: string; flag?: boolean }[] }[];
}
export const concepts = conceptsJson as Concepts;
export const mistakes = mistakesJson as MistakesGuide;

/** Heroes released with the City Never Sleeps update (Oct 2026) — builds/meta still settling. */
export const NEW_HEROES = new Set(["Rat King", "Baba", "Solomon", "Deadman Danny", "Violet", "Nurse Harrow"]);

export const COMPLEXITY = ["", "Easy", "Medium", "Hard", "Expert"] as const;
export const slotColor: Record<Slot, string> = { weapon: "var(--weapon)", vitality: "var(--vitality)", spirit: "var(--spirit)" };

import mapGuideJson from "../../content/map.json";
export interface MapLayerDef {
  id: string;
  group: string;
  label: string;
  icon: string;
  color: string;
  on: boolean;
  flag?: boolean;
  text: string;
}
export interface MapGuide {
  asOfPatch: string;
  sources: Source[];
  flags: string[];
  lanes: { color: string; name: string }[];
  groups: { id: string; label: string }[];
  layers: MapLayerDef[];
  /** layer id → timeline event ids (first spawn times come from content/timeline.json) */
  spawns: Record<string, string[]>;
}
export const mapGuide = mapGuideJson as MapGuide;

import statsGuideJson from "../../content/stats.json";
export interface StatsGuide {
  asOfPatch: string;
  method: string;
  sources: Source[];
  flags: string[];
  sections: Record<"pulse" | "souls" | "ranks" | "bans" | "items", string>;
  itemWinCaveat: string;
  soulSources: { key: string; label: string; color: string; flag?: boolean }[];
}
export const statsGuide = statsGuideJson as StatsGuide;

import settingsJson from "../../content/settings.json";
export interface Keybind {
  id: string;
  group: string;
  action: string;
  /** how the key is written in the source */
  label: string;
  /** key ids on the diagram (see KEY_ROWS in components/Keyboard.tsx) */
  keys: string[];
  src: string;
  flag?: boolean;
  note?: string;
}
export interface SettingsGuide {
  asOfPatch: string;
  method: string;
  sources: (Source & { id: string })[];
  flags: string[];
  groups: { id: string; label: string; color: string }[];
  binds: Keybind[];
  firstChanges: { src: string; intro: string; items: string[] };
  settings: { id: string; title: string; icon: string; recs: { setting: string; value: string; why: string; src: string; flag?: boolean }[] }[];
}
export const settingsGuide = settingsJson as SettingsGuide;
