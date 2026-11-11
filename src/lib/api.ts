// Live analytics from deadlock-api.com (free, CORS-enabled, server-side cached 1h).
// Never invent numbers: callers must show an empty state when this fails.

const BASE = "https://api.deadlock-api.com/v1/analytics";
const TTL = 60 * 60 * 1000;

export interface HeroStatsQuery {
  minBadge?: number; // average badge of both teams: tier*10 + subtier (e.g. 91 = Phantom 1)
  maxBadge?: number;
  days?: number; // look-back window, default 30
  gameMode?: "normal";
}
export interface HeroStat {
  heroId: number;
  wins: number;
  losses: number;
  matches: number;
  winRate: number; // %
  pickRate: number; // % of matches in which the hero appears
}
export interface HeroStatsResult {
  stats: Map<number, HeroStat>;
  totalMatches: number;
  fetchedAt: number;
  from: number; // unix seconds
  to: number;
  fromCache: boolean;
}

function cacheGet<T>(key: string): { at: number; data: T } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return Date.now() - v.at < TTL ? v : null;
  } catch {
    return null;
  }
}
function cacheSet(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full / unavailable — fine */
  }
}

type RawHeroStat = { hero_id: number; wins: number; losses: number; matches: number };
export type DailyRow = { hero_id: number; bucket: number; wins: number; matches: number };

/** Per-hero, per-day stats for [from, to) — used for trends (current vs previous window) and sparklines. */
export async function fetchHeroDaily(
  opts: { from: number; to: number; minBadge?: number; maxBadge?: number },
  force = false,
): Promise<{ rows: DailyRow[]; fetchedAt: number }> {
  const params = new URLSearchParams({
    min_unix_timestamp: String(opts.from),
    max_unix_timestamp: String(opts.to),
    game_mode: "normal",
    bucket: "start_time_day",
  });
  if (opts.minBadge != null) params.set("min_average_badge", String(opts.minBadge));
  if (opts.maxBadge != null) params.set("max_average_badge", String(opts.maxBadge));
  const key = `dla.daily.${params}`;
  const cached = force ? null : cacheGet<DailyRow[]>(key);
  if (cached) return { rows: cached.data, fetchedAt: cached.at };
  const res = await fetch(`${BASE}/hero-stats?${params}`);
  if (res.status === 503 || res.status === 504) throw new Error("deadlock-api is busy right now — try Refresh in a minute");
  if (!res.ok) throw new Error(`deadlock-api returned HTTP ${res.status}`);
  const raw: (DailyRow & Record<string, unknown>)[] = await res.json();
  const rows = raw.map((r) => ({ hero_id: r.hero_id, bucket: r.bucket, wins: r.wins, matches: r.matches }));
  cacheSet(key, rows);
  return { rows, fetchedAt: Date.now() };
}

export async function fetchHeroStats(q: HeroStatsQuery = {}, force = false): Promise<HeroStatsResult> {
  const days = q.days ?? 30;
  // round to the hour so the URL (and server cache) is stable
  const to = Math.floor(Date.now() / 3_600_000) * 3600;
  const from = to - days * 86400;
  const params = new URLSearchParams({ min_unix_timestamp: String(from), game_mode: q.gameMode ?? "normal" });
  if (q.minBadge != null) params.set("min_average_badge", String(q.minBadge));
  if (q.maxBadge != null) params.set("max_average_badge", String(q.maxBadge));
  const url = `${BASE}/hero-stats?${params}`;
  const key = `dla.herostats.${days}.${q.minBadge ?? ""}.${q.maxBadge ?? ""}`;

  let raw: RawHeroStat[];
  let fetchedAt: number;
  let fromCache = false;
  const cached = force ? null : cacheGet<RawHeroStat[]>(key);
  if (cached) {
    raw = cached.data;
    fetchedAt = cached.at;
    fromCache = true;
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`deadlock-api returned HTTP ${res.status}`);
    raw = await res.json();
    fetchedAt = Date.now();
    cacheSet(key, raw);
  }

  const heroSlots = raw.reduce((s, r) => s + r.matches, 0);
  const totalMatches = heroSlots / 12; // 12 heroes per match
  const stats = new Map<number, HeroStat>();
  for (const r of raw) {
    if (!r.matches) continue;
    stats.set(r.hero_id, {
      heroId: r.hero_id,
      wins: r.wins,
      losses: r.losses,
      matches: r.matches,
      winRate: (r.wins / r.matches) * 100,
      pickRate: totalMatches ? (r.matches / totalMatches) * 100 : 0,
    });
  }
  return { stats, totalMatches: Math.round(totalMatches), fetchedAt, from, to, fromCache };
}

/* ---------- matchups (counter + synergy) ---------- */
export type PairRow = { a: number; b: number; w: number; m: number }; // a's wins / matches vs (or with) b
/** Ordered enemy pairs (a vs b) and unordered teammate pairs (a with b) for [from, to). */
export async function fetchMatchups(
  opts: { from: number; to: number; minBadge?: number; maxBadge?: number },
  force = false,
): Promise<{ vs: PairRow[]; with: PairRow[]; fetchedAt: number }> {
  const params = new URLSearchParams({
    min_unix_timestamp: String(opts.from),
    max_unix_timestamp: String(opts.to),
    game_mode: "normal",
    min_matches: "100",
  });
  if (opts.minBadge != null) params.set("min_average_badge", String(opts.minBadge));
  if (opts.maxBadge != null) params.set("max_average_badge", String(opts.maxBadge));
  const key = `dla.matchups.${params}`;
  const cached = force ? null : cacheGet<{ vs: PairRow[]; with: PairRow[] }>(key);
  if (cached) return { ...cached.data, fetchedAt: cached.at };
  const get = async (path: string) => {
    const res = await fetch(`${BASE}/${path}?${params}`);
    if (res.status === 503 || res.status === 504) throw new Error("deadlock-api is busy right now — try again in a minute");
    if (!res.ok) throw new Error(`deadlock-api returned HTTP ${res.status}`);
    return res.json();
  };
  const [c, s] = await Promise.all([get("hero-counter-stats"), get("hero-synergy-stats")]);
  const data = {
    vs: (c as any[]).map((r) => ({ a: r.hero_id, b: r.enemy_hero_id, w: r.wins, m: r.matches_played })),
    with: (s as any[]).map((r) => ({ a: r.hero_id1, b: r.hero_id2, w: r.wins, m: r.matches_played })),
  };
  cacheSet(key, data);
  return { ...data, fetchedAt: Date.now() };
}

/* ---------- generic cached analytics GET (used by Stats & Meta) ---------- */
/** GET {BASE}/{path}?{params}, cached 1h in localStorage under `dla.<path>.<params>`. `pick` trims rows before caching. */
export async function getAnalytics<T>(path: string, params: URLSearchParams, pick: (raw: any) => T, force = false): Promise<{ data: T; fetchedAt: number }> {
  const key = `dla.${path}.${params}`;
  const cached = force ? null : cacheGet<T>(key);
  if (cached) return { data: cached.data, fetchedAt: cached.at };
  const res = await fetch(`${BASE}/${path}?${params}`);
  if (res.status === 503 || res.status === 504) throw new Error("deadlock-api is busy right now — try Refresh in a minute");
  if (!res.ok) throw new Error(`deadlock-api returned HTTP ${res.status}`);
  const data = pick(await res.json());
  cacheSet(key, data);
  return { data, fetchedAt: Date.now() };
}
