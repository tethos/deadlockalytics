// Match clock shared by every tab (persisted, so a reload or tab switch keeps counting).
import { useEffect, useState, useSyncExternalStore } from "react";
import timelineJson from "../../content/timeline.json";

export interface TimelineEvent {
  id: string;
  at: number;
  every?: number;
  until?: number;
  name: string;
  kind: string;
  what: string;
  flag?: boolean;
  approx?: boolean;
  hidden?: boolean;
}
export interface Phase { id: string; name: string; from: number; to: number | null; color: string; goal: string; do: string[]; avoid: string[] }
export const timeline = timelineJson as unknown as {
  asOfPatch: string;
  sources: { label: string; url: string }[];
  flags: string[];
  respawn: { points: [number, number][]; cap: number; notes: string[] };
  events: TimelineEvent[];
  phases: Phase[];
};

interface ClockState {
  running: boolean;
  base: number; // match seconds at `since`
  since: number; // Date.now() when last started/set
  bossKills: number[]; // match seconds of each Mid-Boss kill
}
const KEY = "dla.clock";
let state: ClockState = load();
const subs = new Set<() => void>();

function load(): ClockState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v.base === "number") return { bossKills: [], ...v };
  } catch {
    /* ignore */
  }
  return { running: false, base: 0, since: Date.now(), bossKills: [] };
}
function set(next: Partial<ClockState>) {
  state = { ...state, ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

export const elapsedOf = (s: ClockState) => Math.max(0, s.base + (s.running ? (Date.now() - s.since) / 1000 : 0));

export const clock = {
  start: () => !state.running && set({ running: true, since: Date.now() }),
  pause: () => state.running && set({ running: false, base: elapsedOf(state), since: Date.now() }),
  reset: () => set({ running: false, base: 0, since: Date.now(), bossKills: [] }),
  setTo: (sec: number) => set({ base: Math.max(0, sec), since: Date.now(), bossKills: state.bossKills.filter((k) => k <= sec) }),
  nudge: (d: number) => set({ base: Math.max(0, elapsedOf(state) + d), since: Date.now() }),
  bossKilled: () => set({ bossKills: [...state.bossKills, Math.floor(elapsedOf(state))] }),
  undoBoss: () => set({ bossKills: state.bossKills.slice(0, -1) }),
};

/** Re-renders ~4×/s while running. */
export function useClock() {
  const s = useSyncExternalStore(subscribe, () => state);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!s.running) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [s.running]);
  return { ...s, t: elapsedOf(s) };
}

export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
/** "4:30", "430", "4", "4.5" → seconds. */
export function parseClock(v: string): number | null {
  const m = v.trim().match(/^(\d{1,3})(?::(\d{1,2}))?$/);
  if (m) return m[2] != null ? +m[1] * 60 + +m[2] : v.length >= 3 ? Math.floor(+m[1] / 100) * 60 + (+m[1] % 100) : +m[1] * 60;
  return null;
}

/** Respawn seconds at match time t, linear between the wiki's listed points; null before the first point. */
export function respawnAt(t: number): number | null {
  const p = timeline.respawn.points;
  if (t < p[0][0]) return null;
  for (let i = 0; i < p.length - 1; i++) {
    const [t0, r0] = p[i];
    const [t1, r1] = p[i + 1];
    if (t <= t1) return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0);
  }
  return p[p.length - 1][1]; // past the last listed point the wiki only gives the 90s cap — UI shows a range
}

export const waveInterval = (t: number) => (t < 1200 ? 30 : t < 2100 ? 25 : 20);

const BOSS_RESPAWN = [420, 360, 300];
/** All upcoming occurrences (time ≥ t) of every event, plus derived ones (next wave, Mid-Boss respawn). */
export function upcoming(t: number, bossKills: number[], horizon = 1200) {
  const out: { ev: TimelineEvent; at: number }[] = [];
  for (const ev of timeline.events) {
    if (ev.hidden || ev.id === "midboss") continue;
    if (ev.every) {
      let k = ev.at <= t ? Math.ceil((t - ev.at) / ev.every) : 0;
      for (let at = ev.at + k * ev.every; at <= t + horizon && (ev.until == null || at <= ev.until); k++, at = ev.at + k * ev.every) out.push({ ev, at });
    } else if (ev.at >= t) out.push({ ev, at: ev.at });
  }
  const lastKill = bossKills[bossKills.length - 1];
  if (lastKill != null) {
    const at = lastKill + BOSS_RESPAWN[Math.min(bossKills.length - 1, 2)];
    const boss = timeline.events.find((e) => e.id === "midboss")!;
    if (at >= t) out.push({ ev: { ...boss, name: "Mid-Boss respawns", what: `Killed at ${fmtClock(lastKill)} (kill #${bossKills.length}). Respawn after kills: 7 → 6 → 5 min.` }, at });
  }
  return out.sort((a, b) => a.at - b.at);
}
