import { useMemo } from "react";
import { statsGuide } from "../lib/content";
import { useMetaStats, type GameAgg, type GameField, type GameStats, type MetaStats } from "../lib/metaStats";
import type { TrendFilters, WindowId } from "../lib/trends";
import { TabHeader, Card, Flag, SourceList } from "../components/common";
import { usePersisted, RankPeriodRow, Delta, fmtDay } from "../components/LiveBits";
import { RankDistCard, BansCard, ItemsCard, Section, fmtTime } from "./StatsParts";

const fmtInt = (n: number) => Math.round(n).toLocaleString();

export function Stats() {
  const [win, setWin] = usePersisted<WindowId>("dla.stats.window", "7");
  const [rMin, setRMin] = usePersisted("dla.stats.rmin", 0);
  const [rMax, setRMax] = usePersisted("dla.stats.rmax", 11);
  const filters: TrendFilters = useMemo(() => ({ window: win, ranks: { min: rMin, max: rMax } }), [win, rMin, rMax]);
  const { data, loading, refresh } = useMetaStats(filters);
  const g = data?.game.data ?? null;

  return (
    <>
      <TabHeader
        eyebrow="Live · deadlock-api.com"
        title="Stats & Meta"
        subtitle="What matches look like right now: length, souls, ranks, bans and the items people buy."
        contentAsOf={statsGuide.asOfPatch}
        live={<LiveStamp d={data} loading={loading} />}
      />

      <div className="filter-panel">
        <RankPeriodRow rMin={rMin} rMax={rMax} setRMin={setRMin} setRMax={setRMax} win={win} setWin={setWin} onRefresh={refresh} loading={loading} />
      </div>

      <h2 className="sec">Match pulse</h2>
      <p className="muted sec-blurb">{statsGuide.sections.pulse}</p>
      <Section loading={loading && !data} err={data?.game.err} empty={!!data && !g?.cur}>
        {g?.cur && <Pulse g={g} cur={g.cur} />}
      </Section>

      <div className="grid wide stats-grid">
        <Card title="Where souls come from" className="static">
          <p className="muted small">{statsGuide.sections.souls}</p>
          <Section loading={loading && !data} err={data?.game.err} empty={!!data && !g?.cur}>
            {g?.cur && <Souls cur={g.cur} />}
          </Section>
        </Card>
        <RankDistCard s={data?.ranks} loading={loading && !data} />
      </div>

      <div className="grid wide stats-grid">
        <BansCard s={data?.bans} loading={loading && !data} />
        <ItemsCard s={data?.items} playerGames={g?.cur ? g.cur.matches * 12 : null} loading={loading && !data} />
      </div>

      <p className="sources">{statsGuide.method} Change = selected period vs. the same-length period right before it.</p>
      <SourceList sources={statsGuide.sources} />
      {statsGuide.flags.map((f) => (
        <p key={f}>
          <Flag>{f}</Flag>
        </p>
      ))}
    </>
  );
}

function LiveStamp({ d, loading }: { d: MetaStats | null; loading: boolean }) {
  if (loading && !d) return <span><span className="live-dot" /> Loading live stats…</span>;
  if (!d || d.fetchedAt == null) return null;
  const m = d.game.data?.cur?.matches;
  return (
    <span title={`Previous period: ${fmtDay(d.prev[0])} – ${fmtDay(d.prev[1] - 1)}`}>
      <span className="live-dot" /> <b>Live</b> {fmtDay(d.cur[0])} – today{m ? ` · ${m.toLocaleString()} matches` : ""} · fetched{" "}
      {new Date(d.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

/* ------------------------------ pulse ------------------------------ */

type PulseStat = { label: string; field?: GameField; fmt: (a: GameAgg) => string; delta?: (c: GameAgg, p: GameAgg) => number; unit?: string; lowerIsGood?: boolean; digits?: number };
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const PULSE: PulseStat[] = [
  { label: "Match length", fmt: (a) => fmtTime(a.v.avg_duration_s), delta: (c, p) => (c.v.avg_duration_s - p.v.avg_duration_s) / 60, unit: " min" },
  { label: "Kills / player", fmt: (a) => a.v.avg_kills.toFixed(1), delta: (c, p) => c.v.avg_kills - p.v.avg_kills, unit: "" },
  { label: "Deaths / player", fmt: (a) => a.v.avg_deaths.toFixed(1), delta: (c, p) => c.v.avg_deaths - p.v.avg_deaths, unit: "", lowerIsGood: true },
  { label: "Assists / player", fmt: (a) => a.v.avg_assists.toFixed(1), delta: (c, p) => c.v.avg_assists - p.v.avg_assists, unit: "" },
  { label: "Souls at the end", fmt: (a) => fmtInt(a.v.avg_net_worth), delta: (c, p) => c.v.avg_net_worth - p.v.avg_net_worth, unit: "", digits: 0 },
  { label: "Last hits", fmt: (a) => fmtInt(a.v.avg_last_hits), delta: (c, p) => c.v.avg_last_hits - p.v.avg_last_hits, unit: "", digits: 0 },
  { label: "Final level", fmt: (a) => a.v.avg_ending_level.toFixed(1), delta: (c, p) => c.v.avg_ending_level - p.v.avg_ending_level, unit: "" },
  { label: "Souls lost to deaths", fmt: (a) => fmtInt(a.v.avg_gold_death_loss), delta: (c, p) => c.v.avg_gold_death_loss - p.v.avg_gold_death_loss, unit: "", digits: 0, lowerIsGood: true },
  { label: "First objective falls", fmt: (a) => fmtTime(a.v.avg_first_objective_destroyed_time_s), delta: (c, p) => (c.v.avg_first_objective_destroyed_time_s - p.v.avg_first_objective_destroyed_time_s) / 60, unit: " min" },
  { label: "First Mid-Boss kill", fmt: (a) => fmtTime(a.v.avg_first_mid_boss_time_s), delta: (c, p) => (c.v.avg_first_mid_boss_time_s - p.v.avg_first_mid_boss_time_s) / 60, unit: " min" },
  { label: "Games with a Mid-Boss kill", fmt: (a) => pct(a.v.mid_boss_kill_rate), delta: (c, p) => (c.v.mid_boss_kill_rate - p.v.mid_boss_kill_rate) * 100 },
  { label: "Games with a leaver", fmt: (a) => pct(a.v.abandon_rate), delta: (c, p) => (c.v.abandon_rate - p.v.abandon_rate) * 100, lowerIsGood: true },
];

function Pulse({ g, cur }: { g: GameStats; cur: GameAgg }) {
  const prev = g.prev;
  const sideTotal = cur.side[0] + cur.side[1];
  return (
    <Card className="static pulse-card">
      <div className="pulse-stats">
        {PULSE.map((s, i) => {
          const d = prev && s.delta ? s.delta(cur, prev) : null;
          return (
            <span key={s.label} className="stat pulse-stat" style={{ ["--i" as string]: i }}>
              <b>{s.fmt(cur)}</b>
              <span>{s.label}</span>
              {d != null && <span className={s.lowerIsGood ? "invert" : ""}><Delta v={d} unit={s.unit ?? "pp"} digits={s.digits ?? 1} /></span>}
            </span>
          );
        })}
      </div>
      {sideTotal > 0 && (
        <div className="side-balance" title="Wins per side (API team 0 / team 1)">
          <span className="fp-label">Side balance</span>
          <div className="side-bar">
            <i style={{ width: `${(cur.side[0] / sideTotal) * 100}%` }} />
          </div>
          <span className="small muted">
            Team 0 {((cur.side[0] / sideTotal) * 100).toFixed(1)}% · Team 1 {((cur.side[1] / sideTotal) * 100).toFixed(1)}%
          </span>
        </div>
      )}
      <DailyBars daily={g.daily} />
    </Card>
  );
}

/** Matches per day (bars) with the average match length (line). Previous period dimmed. */
function DailyBars({ daily }: { daily: GameStats["daily"] }) {
  if (daily.length < 2) return null;
  const W = 600;
  const H = 120;
  const pad = 18;
  const maxM = Math.max(...daily.map((d) => d.matches));
  const durs = daily.map((d) => d.duration);
  const lo = Math.min(...durs) - 60;
  const hi = Math.max(...durs) + 60;
  const bw = W / daily.length;
  const y = (s: number) => pad + (1 - (s - lo) / (hi - lo)) * (H - pad * 2);
  const line = daily.map((d, i) => `${i ? "L" : "M"}${(i * bw + bw / 2).toFixed(1)},${y(d.duration).toFixed(1)}`).join("");
  return (
    <figure className="daily">
      <figcaption className="small muted">
        <span className="lg-bar" /> Matches per day · <span className="lg-line" /> average match length
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 16}`} preserveAspectRatio="none" className="daily-svg" role="img" aria-label="Matches per day and average match length">
        {daily.map((d, i) => {
          const h = (d.matches / maxM) * (H - 4);
          return (
            <g key={d.day}>
              <rect className={`db ${d.current ? "cur" : ""}`} x={i * bw + bw * 0.15} width={bw * 0.7} y={H - h} height={h} style={{ ["--i" as string]: i }}>
                <title>{`${fmtDay(d.day)}: ${d.matches.toLocaleString()} matches, avg ${fmtTime(d.duration)}`}</title>
              </rect>
              {(i === 0 || i === daily.length - 1 || daily.length <= 8) && (
                <text x={i * bw + bw / 2} y={H + 13} className="db-label">
                  {fmtDay(d.day)}
                </text>
              )}
            </g>
          );
        })}
        <path d={line} className="dl" pathLength={1} vectorEffect="non-scaling-stroke" />
      </svg>
    </figure>
  );
}

/* ------------------------------ souls ------------------------------ */

function Souls({ cur }: { cur: GameAgg }) {
  const rows = statsGuide.soulSources
    .map((s) => ({ ...s, v: cur.v[s.key as GameField] ?? 0 }))
    .filter((s) => s.v > 0)
    .sort((a, b) => b.v - a.v);
  const total = rows.reduce((s, r) => s + r.v, 0);
  if (!total) return <p className="muted small stats-empty">No soul data for this period.</p>;
  return (
    <>
      <div className="soul-stack" aria-hidden>
        {rows.map((r, i) => (
          <i key={r.key} style={{ width: `${(r.v / total) * 100}%`, background: r.color, ["--i" as string]: i }} />
        ))}
      </div>
      <ul className="soul-list">
        {rows.map((r, i) => (
          <li key={r.key} style={{ ["--i" as string]: i }} title={`API field: ${r.key}`}>
            <span className="sw" style={{ background: r.color }} />
            <span className="sl-name">
              {r.label}
              {r.flag && <span className="flag-mini" title="API category name — exact contents not documented">⚠</span>}
            </span>
            <b>{fmtInt(r.v)}</b>
            <span className="sl-pct">{((r.v / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
      <p className="small muted">Average souls per player per match, by source.</p>
    </>
  );
}
