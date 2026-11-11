// Stats & Meta tab: match-wide averages, soul sources, rank distribution, bans and item usage.
// All numbers come straight from deadlock-api.com analytics; failures surface as per-section errors, never guesses.
import { useCallback, useEffect, useState } from "react";
import { getAnalytics } from "./api";
import { badgeRange, windows, type TrendFilters } from "./trends";
import { itemById } from "./data";

/* ---------- match-wide averages (game-stats, per day) ---------- */
// Fields kept from the API row. Averages are per player per match unless the name says otherwise.
export const GAME_FIELDS = [
  "avg_duration_s", "avg_kills", "avg_deaths", "avg_assists", "avg_net_worth", "avg_last_hits", "avg_denies",
  "avg_ending_level", "avg_gold_death_loss", "avg_first_objective_destroyed_time_s", "avg_first_mid_boss_time_s",
  "mid_boss_kill_rate", "abandon_rate",
  "avg_gold_lane_creep", "avg_gold_neutral_creep", "avg_gold_player", "avg_gold_assists", "avg_gold_boss",
  "avg_gold_treasure", "avg_gold_breakable", "avg_gold_team_bonus", "avg_gold_denied",
  "avg_gold_item_trophy_collector", "avg_gold_item_cultist_sacrifice", "avg_gold_item_goose_egg",
] as const;
export type GameField = (typeof GAME_FIELDS)[number];
type DayRow = { day: number; matches: number; t0: number; t1: number } & Record<GameField, number>;
export interface GameAgg {
  matches: number;
  side: [number, number]; // wins for team 0 / team 1
  v: Record<GameField, number>;
}
export interface GameStats {
  cur: GameAgg | null;
  prev: GameAgg | null;
  daily: { day: number; matches: number; duration: number; current: boolean }[];
}

/** Weighted by match count, so each day counts in proportion to its games. Mid-boss timing is weighted by matches that had one. */
function aggregate(rows: DayRow[]): GameAgg | null {
  const matches = rows.reduce((s, r) => s + r.matches, 0);
  if (!matches) return null;
  const v = {} as Record<GameField, number>;
  for (const f of GAME_FIELDS) {
    const w = (r: DayRow) => (f === "avg_first_mid_boss_time_s" ? r.matches * r.mid_boss_kill_rate : r.matches);
    const tw = rows.reduce((s, r) => s + w(r), 0);
    v[f] = tw ? rows.reduce((s, r) => s + (r[f] ?? 0) * w(r), 0) / tw : 0;
  }
  return { matches, side: [rows.reduce((s, r) => s + r.t0, 0), rows.reduce((s, r) => s + r.t1, 0)], v };
}

export async function fetchGameStats(f: TrendFilters, force: boolean): Promise<{ data: GameStats; fetchedAt: number }> {
  const { cur, prev } = windows(f.window);
  const p = params(prev[0], cur[1], f);
  p.set("bucket", "start_time_day");
  const { data: rows, fetchedAt } = await getAnalytics<DayRow[]>(
    "game-stats",
    p,
    (raw: any[]) =>
      raw.map((r) => {
        const o: any = { day: r.bucket, matches: r.total_matches, t0: r.team0_wins, t1: r.team1_wins };
        for (const k of GAME_FIELDS) o[k] = r[k] ?? 0;
        return o as DayRow;
      }),
    force,
  );
  const sorted = [...rows].sort((a, b) => a.day - b.day);
  return {
    fetchedAt,
    data: {
      cur: aggregate(sorted.filter((r) => r.day >= cur[0])),
      prev: aggregate(sorted.filter((r) => r.day < cur[0])),
      daily: sorted.map((r) => ({ day: r.day, matches: r.matches, duration: r.avg_duration_s, current: r.day >= cur[0] })),
    },
  };
}

/* ---------- rank distribution (badge-distribution) ---------- */
export interface RankDist { tiers: { tier: number; players: number }[]; total: number }
export async function fetchRankDist(f: TrendFilters, force: boolean): Promise<{ data: RankDist; fetchedAt: number }> {
  const { cur } = windows(f.window);
  const p = new URLSearchParams({ min_unix_timestamp: String(cur[0]), max_unix_timestamp: String(cur[1]), game_mode: "normal" });
  return getAnalytics<RankDist>(
    "badge-distribution",
    p,
    (raw: { badge_level: number; unique_players: number }[]) => {
      const by = new Map<number, number>();
      for (const r of raw) {
        const t = Math.floor(r.badge_level / 10);
        by.set(t, (by.get(t) ?? 0) + r.unique_players);
      }
      const tiers = [...by].map(([tier, players]) => ({ tier, players })).sort((a, b) => a.tier - b.tier);
      return { tiers, total: tiers.reduce((s, t) => s + t.players, 0) };
    },
    force,
  );
}

/* ---------- hero bans (hero-ban-stats) ---------- */
export interface Bans { rows: { heroId: number; bans: number; rate: number }[]; matches: number }
export async function fetchBans(f: TrendFilters, force: boolean): Promise<{ data: Bans; fetchedAt: number }> {
  const { cur } = windows(f.window);
  const p = params(cur[0], cur[1], f);
  p.delete("game_mode"); // endpoint only takes match_mode
  return getAnalytics<Bans>(
    "hero-ban-stats",
    p,
    (raw: { hero_id: number; bans: number; matches: number }[]) => {
      const matches = raw.reduce((m, r) => Math.max(m, r.matches), 0);
      const rows = raw
        .filter((r) => r.matches > 0)
        .map((r) => ({ heroId: r.hero_id, bans: r.bans, rate: (r.bans / r.matches) * 100 }))
        .sort((a, b) => b.rate - a.rate);
      return { rows, matches };
    },
    force,
  );
}

/* ---------- item usage (item-stats) ---------- */
export interface ItemStat { id: number; matches: number; winRate: number; buyTime: number }
export async function fetchItems(f: TrendFilters, force: boolean): Promise<{ data: ItemStat[]; fetchedAt: number }> {
  const { cur } = windows(f.window);
  return getAnalytics<ItemStat[]>(
    "item-stats",
    params(cur[0], cur[1], f),
    (raw: { item_id: number; wins: number; matches: number; avg_buy_time_s: number }[]) =>
      raw
        .filter((r) => r.matches > 0 && (itemById.get(r.item_id)?.tier ?? 9) <= 4) // shop tiers 1–4 only
        .map((r) => ({ id: r.item_id, matches: r.matches, winRate: (r.wins / r.matches) * 100, buyTime: r.avg_buy_time_s })),
    force,
  );
}

function params(from: number, to: number, f: TrendFilters) {
  const p = new URLSearchParams({ min_unix_timestamp: String(from), max_unix_timestamp: String(to), game_mode: "normal" });
  const b = badgeRange(f.ranks);
  if (b.minBadge != null) p.set("min_average_badge", String(b.minBadge));
  if (b.maxBadge != null) p.set("max_average_badge", String(b.maxBadge));
  return p;
}

/* ---------- hook ---------- */
export interface Section<T> { data: T | null; err: string | null }
export interface MetaStats {
  game: Section<GameStats>;
  ranks: Section<RankDist>;
  bans: Section<Bans>;
  items: Section<ItemStat[]>;
  fetchedAt: number | null;
  cur: [number, number];
  prev: [number, number];
}

const settle = <T,>(r: PromiseSettledResult<{ data: T; fetchedAt: number }>): Section<T> & { at: number | null } =>
  r.status === "fulfilled" ? { data: r.value.data, err: null, at: r.value.fetchedAt } : { data: null, err: String(r.reason?.message || r.reason), at: null };

export function useMetaStats(f: TrendFilters) {
  const [data, setData] = useState<MetaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const force = nonce > 0;
    const { cur, prev } = windows(f.window);
    Promise.allSettled([fetchGameStats(f, force), fetchRankDist(f, force), fetchBans(f, force), fetchItems(f, force)])
      .then(([g, r, b, i]) => {
        if (!alive) return;
        const s = [settle(g), settle(r), settle(b), settle(i)] as const;
        const ats = s.map((x) => x.at).filter((x): x is number => x != null);
        setData({
          game: s[0], ranks: s[1], bans: s[2], items: s[3],
          fetchedAt: ats.length ? Math.min(...ats) : null,
          cur, prev,
        });
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.window, f.ranks.min, f.ranks.max, nonce]);
  return { data, loading, refresh: useCallback(() => setNonce((n) => n + 1), []) };
}
