// Trend + tier computations on top of live deadlock-api.com per-day hero stats.
// Everything shown is derived from real match counts; nothing is estimated or invented.
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchHeroDaily, fetchMatchups, type DailyRow, type PairRow } from "./api";
import { meta } from "./data";

export interface RankRange { min: number; max: number } // rank tiers 0..11 (Obscurus..Eternus)
export type WindowId = "3" | "7" | "14" | "patch";
export interface TrendFilters { window: WindowId; ranks: RankRange }

export const WINDOWS: { id: WindowId; label: string }[] = [
  { id: "3", label: "Last 3 days" },
  { id: "7", label: "Last 7 days" },
  { id: "14", label: "Last 14 days" },
  { id: "patch", label: "Since patch" },
];

export interface HeroTrend {
  heroId: number;
  matches: number;
  winRate: number;
  pickRate: number;
  prevMatches: number;
  prevWinRate: number | null;
  prevPickRate: number | null;
  dWin: number | null; // percentage points
  dPick: number | null;
  dGamesPct: number | null; // relative change in games played, %
  daily: { day: number; winRate: number | null; current: boolean }[];
  tier: Tier;
  lowSample: boolean;
}
export interface TrendResult {
  heroes: Map<number, HeroTrend>;
  totalMatches: number;
  prevTotalMatches: number;
  cur: [number, number];
  prev: [number, number];
  fetchedAt: number;
}

/* ---------- tiers ---------- */
export type Tier = "S+" | "S" | "A" | "B" | "C" | "D";
export const TIERS: { id: Tier; min: number; color: string; label: string }[] = [
  { id: "S+", min: 55, color: "#ff5d73", label: "≥ 55% win rate" },
  { id: "S", min: 53, color: "#ff9f43", label: "53 – 55%" },
  { id: "A", min: 51, color: "#f6d155", label: "51 – 53%" },
  { id: "B", min: 49, color: "#7fd16b", label: "49 – 51%" },
  { id: "C", min: 47, color: "#5fb4f5", label: "47 – 49%" },
  { id: "D", min: -1, color: "#a58cf5", label: "< 47%" },
];
export const tierOf = (wr: number): Tier => TIERS.find((t) => wr >= t.min)!.id;
export const tierColor = (t: Tier) => TIERS.find((x) => x.id === t)!.color;
export const LOW_SAMPLE = 1000;

/* ---------- rank → badge filter ---------- */
// API filter uses average badge of both teams: tier*10 + subtier (1..6). Tier 0 = Obscurus (unranked).
export const badgeRange = (r: RankRange) => ({
  minBadge: r.min <= 0 ? undefined : r.min * 10,
  maxBadge: r.max >= 11 ? undefined : r.max * 10 + 9,
});

const DAY = 86400;
export function windows(w: WindowId): { cur: [number, number]; prev: [number, number] } {
  // Day-aligned (UTC) so each daily bucket belongs entirely to one window. The current window includes today so far.
  const now = Math.floor(Date.now() / 3_600_000) * 3600;
  const today = Math.floor(now / DAY) * DAY;
  let start: number;
  if (w === "patch") {
    start = Math.floor(Date.parse(meta.patchDate + "T00:00:00Z") / 1000);
    if (!Number.isFinite(start) || start >= today) start = today - 6 * DAY;
  } else start = today - (Number(w) - 1) * DAY;
  const days = Math.round((today - start) / DAY) + 1;
  return { cur: [start, now], prev: [start - days * DAY, start] };
}

function compute(rows: DailyRow[], cur: [number, number], prev: [number, number]): Omit<TrendResult, "fetchedAt"> {
  const curDayStart = cur[0]; // day-aligned
  const agg = new Map<number, { cw: number; cm: number; pw: number; pm: number; days: Map<number, { w: number; m: number }> }>();
  let curSlots = 0;
  let prevSlots = 0;
  for (const r of rows) {
    const a = agg.get(r.hero_id) ?? { cw: 0, cm: 0, pw: 0, pm: 0, days: new Map() };
    const current = r.bucket >= curDayStart;
    if (current) {
      a.cw += r.wins;
      a.cm += r.matches;
      curSlots += r.matches;
    } else {
      a.pw += r.wins;
      a.pm += r.matches;
      prevSlots += r.matches;
    }
    const d = a.days.get(r.bucket) ?? { w: 0, m: 0 };
    d.w += r.wins;
    d.m += r.matches;
    a.days.set(r.bucket, d);
    agg.set(r.hero_id, a);
  }
  const totalMatches = curSlots / 12;
  const prevTotalMatches = prevSlots / 12;
  const allDays = [...new Set(rows.map((r) => r.bucket))].sort((a, b) => a - b);

  const heroes = new Map<number, HeroTrend>();
  for (const [id, a] of agg) {
    if (!a.cm) continue;
    const winRate = (a.cw / a.cm) * 100;
    const pickRate = totalMatches ? (a.cm / totalMatches) * 100 : 0;
    const prevWinRate = a.pm >= 200 ? (a.pw / a.pm) * 100 : null; // need some sample to compare
    const prevPickRate = a.pm && prevTotalMatches ? (a.pm / prevTotalMatches) * 100 : null;
    heroes.set(id, {
      heroId: id,
      matches: a.cm,
      winRate,
      pickRate,
      prevMatches: a.pm,
      prevWinRate,
      prevPickRate,
      dWin: prevWinRate == null ? null : winRate - prevWinRate,
      dPick: prevPickRate == null ? null : pickRate - prevPickRate,
      dGamesPct: a.pm ? ((a.cm - a.pm) / a.pm) * 100 : null,
      daily: allDays.map((day) => {
        const d = a.days.get(day);
        return { day, winRate: d && d.m >= 30 ? (d.w / d.m) * 100 : null, current: day >= curDayStart };
      }),
      tier: tierOf(winRate),
      lowSample: a.cm < LOW_SAMPLE,
    });
  }
  return { heroes, totalMatches: Math.round(totalMatches), prevTotalMatches: Math.round(prevTotalMatches), cur, prev };
}

export function useHeroTrends(f: TrendFilters) {
  const [data, setData] = useState<TrendResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    const { cur, prev } = windows(f.window);
    fetchHeroDaily({ from: prev[0], to: cur[1], ...badgeRange(f.ranks) }, nonce > 0)
      .then(({ rows, fetchedAt }) => {
        if (alive) setData({ ...compute(rows, cur, prev), fetchedAt });
      })
      .catch((e) => alive && setErr(String(e.message || e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [f.window, f.ranks.min, f.ranks.max, nonce]);

  return { data, err, loading, refresh: useCallback(() => setNonce((n) => n + 1), []) };
}

/* ---------- matchups ---------- */
export interface Matchup { heroId: number; winRate: number; diff: number; matches: number }
export interface HeroMatchups { strongVs: Matchup[]; weakVs: Matchup[]; bestWith: Matchup[]; baseline: number }
export const MATCHUP_MIN = 300;

/** Loaded lazily (only when a hero is opened). Uses the current period window + rank filter. */
export function useMatchups(f: TrendFilters, heroId: number | null) {
  const [rows, setRows] = useState<{ vs: PairRow[]; with: PairRow[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const want = heroId != null;
  useEffect(() => {
    if (!want) return;
    let alive = true;
    setLoading(true);
    setErr(null);
    const { cur } = windows(f.window);
    fetchMatchups({ from: cur[0], to: cur[1], ...badgeRange(f.ranks) })
      .then((d) => alive && setRows(d))
      .catch((e) => alive && setErr(String(e.message || e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [want, f.window, f.ranks.min, f.ranks.max]);
  const result = useMemo<HeroMatchups | null>(() => (rows && heroId != null ? matchupsFor(rows, heroId) : null), [rows, heroId]);
  return { data: result, err, loading };
}

/** Score = actual win rate of the pairing minus what both heroes' usual win rates would predict
 *  (vs enemy: A + (100 − B) − 50; with teammate: A + B − 50). Removes the "strong heroes look good everywhere" bias. */
function matchupsFor(rows: { vs: PairRow[]; with: PairRow[] }, id: number): HeroMatchups {
  const tot = new Map<number, { w: number; m: number }>();
  for (const r of rows.vs) {
    const t = tot.get(r.a) ?? { w: 0, m: 0 };
    t.w += r.w;
    t.m += r.m;
    tot.set(r.a, t);
  }
  const base = (h: number) => {
    const t = tot.get(h);
    return t && t.m ? (t.w / t.m) * 100 : 50;
  };
  const baseline = base(id);
  const mk = (heroId: number, w: number, m: number, expected: number): Matchup => ({ heroId, matches: m, winRate: (w / m) * 100, diff: (w / m) * 100 - expected });
  const vs = rows.vs.filter((r) => r.a === id && r.m >= MATCHUP_MIN).map((r) => mk(r.b, r.w, r.m, baseline - base(r.b) + 50));
  const withs = rows.with
    .filter((r) => (r.a === id || r.b === id) && r.m >= MATCHUP_MIN)
    .map((r) => {
      const o = r.a === id ? r.b : r.a;
      return mk(o, r.w, r.m, baseline + base(o) - 50);
    });
  const by = (d: 1 | -1) => (x: Matchup, y: Matchup) => d * (y.diff - x.diff);
  return {
    baseline,
    strongVs: vs.filter((x) => x.diff > 0.5).sort(by(1)).slice(0, 5),
    weakVs: vs.filter((x) => x.diff < -0.5).sort(by(-1)).slice(0, 5),
    bestWith: withs.filter((x) => x.diff > 0.5).sort(by(1)).slice(0, 5),
  };
}
