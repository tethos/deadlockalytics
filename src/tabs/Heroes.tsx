import { useEffect, useMemo, useState, type ReactNode } from "react";
import { heroes, itemById, matches, fmtDate, type Hero } from "../lib/data";
import { heroNotes, NEW_HEROES, COMPLEXITY } from "../lib/content";
import { useHeroTrends, useMatchups, MATCHUP_MIN, TIERS, tierColor, type HeroTrend, type TrendFilters, type TrendResult, type WindowId, type Matchup } from "../lib/trends";
import { TabHeader, Card, Img, Rich, Flag, SourceList } from "../components/common";
import { Modal } from "../components/Modal";
import { ItemTile, ItemDetail } from "../components/ItemBits";
import { usePersisted, RankPeriodRow, Delta, fmtDay } from "../components/LiveBits";

type View = "trending" | "tiers" | "all";
type SortKey = "name" | "win" | "pick" | "games" | "dWin";
const TYPES = ["brawler", "marksman", "mystic", "assassin"] as const;
const typeLabel = (t: string | null) => (t ? t[0].toUpperCase() + t.slice(1) : "—");
const heroById = new Map(heroes.map((h) => [h.id, h]));
const beginnerWhy = new Map(heroNotes.beginnerPicks.map((p) => [p.hero, p.why]));

export function Heroes() {
  const [view, setView] = usePersisted<View>("dla.heroes.view", "trending");
  const [win, setWin] = usePersisted<WindowId>("dla.heroes.window", "7");
  const [rMin, setRMin] = usePersisted("dla.heroes.rmin", 0);
  const [rMax, setRMax] = usePersisted("dla.heroes.rmax", 11);
  const [sort, setSort] = usePersisted<SortKey>("dla.heroes.sort", "win");
  const [q, setQ] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [cx, setCx] = useState<number | null>(null);
  const [onlyNew, setOnlyNew] = useState(false);
  const [onlyBeginner, setOnlyBeginner] = useState(false);
  const [sel, setSel] = useState<Hero | null>(null);

  const filters: TrendFilters = useMemo(() => ({ window: win, ranks: { min: rMin, max: rMax } }), [win, rMin, rMax]);
  const trends = useHeroTrends(filters);

  const visible = useMemo(
    () =>
      heroes.filter(
        (h) =>
          (!q || matches(`${h.name} ${h.type ?? ""} ${h.tags.join(" ")} ${h.role ?? ""} ${h.abilities.map((a) => a.name).join(" ")}`, q)) &&
          (!type || h.type === type) &&
          (cx == null || h.complexity === cx) &&
          (!onlyNew || NEW_HEROES.has(h.name)) &&
          (!onlyBeginner || beginnerWhy.has(h.name)),
      ),
    [q, type, cx, onlyNew, onlyBeginner],
  );
  const filtersActive = !!(q || type || cx != null || onlyNew || onlyBeginner);
  const clearFilters = () => {
    setQ("");
    setType(null);
    setCx(null);
    setOnlyNew(false);
    setOnlyBeginner(false);
  };

  return (
    <>
      <TabHeader
        eyebrow={`Roster · ${heroes.length} heroes`}
        title="Heroes"
        subtitle="What's trending, how strong each hero is right now, and everything about their kit."
        contentAsOf={heroNotes.asOfPatch}
        live={<LiveStamp t={trends.data} loading={trends.loading} />}
      />

      <div className="seg" role="tablist" aria-label="Hero views">
        {(
          [
            ["trending", "▲ Trending"],
            ["tiers", "◆ Tier List"],
            ["all", "☰ All Heroes"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={view === id} className="seg-btn" onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="filter-panel">
        <div className="fp-row">
          <input
            className="search"
            data-search
            placeholder="Search heroes, abilities, tags…  (press /)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <RankPeriodRow rMin={rMin} rMax={rMax} setRMin={setRMin} setRMax={setRMax} win={win} setWin={setWin} onRefresh={trends.refresh} loading={trends.loading} />
        <div className="fp-row">
          <span className="fp-label">Role</span>
          {TYPES.map((t) => (
            <button key={t} className="chip" aria-pressed={type === t} onClick={() => setType(type === t ? null : t)}>
              {typeLabel(t)}
            </button>
          ))}
          <span className="chip-sep" />
          <span className="fp-label">Difficulty</span>
          {[1, 2, 3, 4].map((c) => (
            <button key={c} className="chip" aria-pressed={cx === c} onClick={() => setCx(cx === c ? null : c)}>
              {COMPLEXITY[c]}
            </button>
          ))}
          <span className="chip-sep" />
          <button className="chip" aria-pressed={onlyNew} onClick={() => setOnlyNew(!onlyNew)}>
            New (Oct 2026)
          </button>
          <button className="chip" aria-pressed={onlyBeginner} onClick={() => setOnlyBeginner(!onlyBeginner)}>
            Beginner-friendly
          </button>
          {filtersActive && (
            <button className="chip clear" onClick={clearFilters}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {trends.err && (
        <Card className="static">
          <p>
            <b>Live stats unavailable:</b> {trends.err}. Hero info below still works; numbers are hidden instead of guessed.
          </p>
        </Card>
      )}

      <div className="view-anim" key={view}>
        {view === "trending" && <TrendingView data={trends.data} loading={trends.loading} visible={visible} onPick={setSel} />}
        {view === "tiers" && <TierView data={trends.data} loading={trends.loading} visible={visible} onPick={setSel} />}
        {view === "all" && <AllView data={trends.data} visible={visible} sort={sort} setSort={setSort} onPick={setSel} q={q} />}
      </div>

      <p className="sources">
        Live stats: <a href="https://deadlock-api.com" target="_blank" rel="noreferrer">deadlock-api.com</a> analytics (standard
        matches, average rank of both teams within the selected range). Tiers are computed by this site from win rate only — not an
        official ranking. Change = selected period vs. the same-length period right before it.
      </p>
      <SourceList sources={heroNotes.sources} />
      {heroNotes.flags.map((f) => (
        <p key={f}>
          <Flag>{f}</Flag>
        </p>
      ))}

      <HeroModal hero={sel} onClose={() => setSel(null)} data={trends.data} filters={filters} onPick={setSel} />
    </>
  );
}

/* ------------------------------------------------------------------ */

function LiveStamp({ t, loading }: { t: TrendResult | null; loading: boolean }) {
  if (loading && !t) return <span><span className="live-dot" /> Loading live stats…</span>;
  if (!t) return null;
  return (
    <span title={`Previous period: ${fmtDay(t.prev[0])} – ${fmtDay(t.prev[1] - 1)}`}>
      <span className="live-dot" /> <b>Live</b> {fmtDay(t.cur[0])} – today · {t.totalMatches.toLocaleString()} matches · fetched{" "}
      {new Date(t.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

function TierBadge({ t, small }: { t: HeroTrend["tier"]; small?: boolean }) {
  return (
    <span className={`tier-badge ${small ? "sm" : ""}`} style={{ "--tc": tierColor(t) } as React.CSSProperties}>
      {t}
    </span>
  );
}

/** Daily win-rate line. Previous period dimmed, current period bright. */
function Sparkline({ daily }: { daily: HeroTrend["daily"] }) {
  const pts = daily.map((d, i) => ({ i, v: d.winRate, cur: d.current })).filter((p) => p.v != null) as { i: number; v: number; cur: boolean }[];
  if (pts.length < 2) return <span className="spark empty" />;
  const W = 110;
  const H = 30;
  const vals = pts.map((p) => p.v);
  const lo = Math.min(...vals, 48);
  const hi = Math.max(...vals, 52);
  const x = (i: number) => (i / Math.max(daily.length - 1, 1)) * W;
  const y = (v: number) => H - 2 - ((v - lo) / (hi - lo)) * (H - 4);
  const path = (arr: typeof pts) => arr.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const firstCur = daily.findIndex((d) => d.current);
  const prevPts = pts.filter((p) => !p.cur);
  const curPts = pts.filter((p) => p.i >= firstCur - 1);
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
      {firstCur > 0 && <rect x={x(firstCur) - 2} y={0} width={W - x(firstCur) + 2} height={H} className="spark-cur" />}
      <line x1={0} x2={W} y1={y(50)} y2={y(50)} className="spark-mid" />
      {prevPts.length > 1 && <path d={path(prevPts)} className="spark-prev" />}
      {curPts.length > 1 && <path d={path(curPts)} className="spark-line" pathLength={1} />}
      <circle cx={x(last.i)} cy={y(last.v)} r={2.6} className="spark-dot" />
    </svg>
  );
}

function HeroChip({ h, onPick, children }: { h: Hero; onPick: (h: Hero) => void; children?: ReactNode }) {
  return (
    <button className="hero-row" onClick={() => onPick(h)}>
      <Img src={h.images.small} alt={h.name} size={40} className="hr-img" />
      <span className="hr-name">
        {h.name}
        {NEW_HEROES.has(h.name) && <span className="mini-new">NEW</span>}
      </span>
      {children}
    </button>
  );
}

/* ------------------------------ Trending ------------------------------ */

function TrendingView({ data, loading, visible, onPick }: { data: TrendResult | null; loading: boolean; visible: Hero[]; onPick: (h: Hero) => void }) {
  if (!data) return loading ? <SkeletonGrid /> : null;
  const rows = visible.map((h) => ({ h, t: data.heroes.get(h.id) })).filter((r): r is { h: Hero; t: HeroTrend } => !!r.t);
  const solid = rows.filter((r) => !r.t.lowSample);
  const by = (fn: (t: HeroTrend) => number | null, dir: 1 | -1, src = solid) =>
    src.filter((r) => fn(r.t) != null).sort((a, b) => dir * ((fn(b.t) as number) - (fn(a.t) as number))).slice(0, 6);

  const lists: { title: string; icon: string; accent: string; rows: { h: Hero; t: HeroTrend }[]; value: (t: HeroTrend) => ReactNode; empty?: string }[] = [
    {
      title: "Win rate climbers",
      icon: "▲",
      accent: "var(--ok)",
      rows: by((t) => t.dWin, 1).filter((r) => (r.t.dWin ?? 0) > 0),
      value: (t) => (<><b>{t.winRate.toFixed(1)}%</b><Delta v={t.dWin} /></>),
      empty: "No hero gained win rate in this period.",
    },
    {
      title: "Win rate fallers",
      icon: "▼",
      accent: "var(--danger)",
      rows: by((t) => t.dWin, -1).filter((r) => (r.t.dWin ?? 0) < 0),
      value: (t) => (<><b>{t.winRate.toFixed(1)}%</b><Delta v={t.dWin} /></>),
      empty: "No hero lost win rate in this period.",
    },
    {
      title: "Pick rate rising",
      icon: "⬈",
      accent: "var(--gold)",
      rows: by((t) => t.dPick, 1).filter((r) => (r.t.dPick ?? 0) > 0),
      value: (t) => (<><b>{t.pickRate.toFixed(1)}%</b><Delta v={t.dPick} /></>),
    },
    {
      title: "Pick rate dropping",
      icon: "⬊",
      accent: "var(--sapphire)",
      rows: by((t) => t.dPick, -1).filter((r) => (r.t.dPick ?? 0) < 0),
      value: (t) => (<><b>{t.pickRate.toFixed(1)}%</b><Delta v={t.dPick} /></>),
    },
    {
      title: "Most played",
      icon: "◉",
      accent: "var(--spirit)",
      rows: by((t) => t.matches, 1, rows),
      value: (t) => (<><b>{t.matches.toLocaleString()}</b><Delta v={t.dGamesPct} unit="%" digits={0} /></>),
    },
    {
      title: "New heroes",
      icon: "✦",
      accent: "var(--weapon)",
      rows: rows.filter((r) => NEW_HEROES.has(r.h.name)).sort((a, b) => b.t.winRate - a.t.winRate),
      value: (t) => (<><b>{t.winRate.toFixed(1)}%</b><span className="sub-val">{t.pickRate.toFixed(0)}% picked</span></>),
      empty: "No new heroes match your filters.",
    },
  ];

  return (
    <div className="trend-grid">
      {lists.map((l, li) => (
        <Card key={l.title} className="trend-card static" accent={l.accent}>
          <h2 className="card-title">
            <span className="trend-icon" style={{ color: l.accent }}>{l.icon}</span> {l.title}
          </h2>
          {l.rows.length ? (
            <ol className="trend-list">
              {l.rows.map(({ h, t }, i) => (
                <li key={h.id} style={{ "--i": i + li * 2 } as React.CSSProperties}>
                  <span className="pos">{i + 1}</span>
                  <HeroChip h={h} onPick={onPick}>
                    <TierBadge t={t.tier} small />
                    <Sparkline daily={t.daily} />
                    <span className="hr-val">{l.value(t)}</span>
                  </HeroChip>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted small">{l.empty ?? "Nothing to show for these filters."}</p>
          )}
        </Card>
      ))}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="trend-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i} className="static placeholder">
          <div className="shimmer-lines">
            <i />
            <i />
            <i />
            <i />
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------ Tier list ------------------------------ */

function TierView({ data, loading, visible, onPick }: { data: TrendResult | null; loading: boolean; visible: Hero[]; onPick: (h: Hero) => void }) {
  if (!data) return loading ? <SkeletonGrid /> : null;
  const rows = visible
    .map((h) => ({ h, t: data.heroes.get(h.id) }))
    .filter((r): r is { h: Hero; t: HeroTrend } => !!r.t)
    .sort((a, b) => b.t.winRate - a.t.winRate);
  const noData = visible.filter((h) => !data.heroes.has(h.id));
  return (
    <div className="tier-list">
      {TIERS.map((tier, ti) => {
        const inTier = rows.filter((r) => r.t.tier === tier.id);
        return (
          <div key={tier.id} className="tier-band" style={{ "--tc": tier.color, "--i": ti } as React.CSSProperties}>
            <div className="tier-head">
              <span className="tier-letter">{tier.id}</span>
              <span className="tier-range">{tier.label}</span>
            </div>
            <div className="tier-heroes">
              {inTier.length ? (
                inTier.map(({ h, t }, i) => (
                  <button
                    key={h.id}
                    className={`tier-hero ${t.lowSample ? "low" : ""}`}
                    style={{ "--j": i } as React.CSSProperties}
                    onClick={() => onPick(h)}
                    title={`${h.name}: ${t.winRate.toFixed(2)}% win · ${t.pickRate.toFixed(1)}% pick · ${t.matches.toLocaleString()} games${t.lowSample ? " (small sample)" : ""}`}
                  >
                    <Img src={h.images.small} alt={h.name} size={64} />
                    <span className="th-name">{h.name}</span>
                    <span className="th-wr">
                      {t.winRate.toFixed(1)}% <Delta v={t.dWin} />
                    </span>
                    {NEW_HEROES.has(h.name) && <span className="mini-new corner">NEW</span>}
                  </button>
                ))
              ) : (
                <span className="muted small tier-empty">—</span>
              )}
            </div>
          </div>
        );
      })}
      {noData.length > 0 && (
        <p className="muted small">No games in this period/rank for: {noData.map((h) => h.name).join(", ")}.</p>
      )}
      <p className="muted small">Faded heroes have fewer than 1,000 games in the selection, so their tier is less reliable.</p>
    </div>
  );
}

/* ------------------------------ All heroes ------------------------------ */

function AllView({ data, visible, sort, setSort, onPick, q }: { data: TrendResult | null; visible: Hero[]; sort: SortKey; setSort: (s: SortKey) => void; onPick: (h: Hero) => void; q: string }) {
  const val = (h: Hero) => data?.heroes.get(h.id);
  const sorted = [...visible].sort((a, b) => {
    const ta = val(a);
    const tb = val(b);
    switch (sort) {
      case "win": return (tb?.winRate ?? -1) - (ta?.winRate ?? -1);
      case "pick": return (tb?.pickRate ?? -1) - (ta?.pickRate ?? -1);
      case "games": return (tb?.matches ?? -1) - (ta?.matches ?? -1);
      case "dWin": return (tb?.dWin ?? -99) - (ta?.dWin ?? -99);
      default: return a.name.localeCompare(b.name);
    }
  });
  const SORTS: [SortKey, string][] = [["win", "Win rate"], ["pick", "Pick rate"], ["games", "Games"], ["dWin", "WR change"], ["name", "Name"]];
  return (
    <>
      <div className="fp-row sort-row">
        <span className="fp-label">Sort</span>
        {SORTS.map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={sort === k} onClick={() => setSort(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="hero-grid">
        {sorted.map((h, i) => {
          const t = val(h);
          return (
            <button key={h.id} className="hero-card" style={{ "--i": i } as React.CSSProperties} onClick={() => onPick(h)}>
              <span className="hero-img">
                <Img src={h.images.card} alt={h.name} />
              </span>
              {NEW_HEROES.has(h.name) && <span className="new-badge">NEW</span>}
              {t && <span className="card-tier"><TierBadge t={t.tier} /></span>}
              <span className="hero-info">
                <span className="hero-name">{h.name}</span>
                <span className="hero-sub">
                  {typeLabel(h.type)} <Pips n={h.complexity} />
                </span>
                {t && (
                  <span className="hero-wr">
                    {t.winRate.toFixed(1)}% WR · {t.pickRate.toFixed(0)}% pick
                  </span>
                )}
              </span>
            </button>
          );
        })}
        {!sorted.length && <p className="muted">No hero matches {q ? `“${q}”` : "these filters"}.</p>}
      </div>
    </>
  );
}

function Pips({ n }: { n: number | null }) {
  return (
    <span className="pips" title={`Valve complexity: ${n ?? "?"} (${COMPLEXITY[n ?? 0] || "unknown"})`}>
      {[1, 2, 3, 4].map((i) => (
        <i key={i} className={n != null && i <= n ? "on" : ""} />
      ))}
    </span>
  );
}

/* ------------------------------ Hero detail ------------------------------ */

function HeroModal({ hero, onClose, data, filters, onPick }: { hero: Hero | null; onClose: () => void; data: TrendResult | null; filters: TrendFilters; onPick: (h: Hero) => void }) {
  const mu = useMatchups(filters, hero?.id ?? null);
  const [itemId, setItemId] = useState<number | null>(null);
  const [openAb, setOpenAb] = useState<number | null>(null);
  useEffect(() => {
    setItemId(null);
    setOpenAb(null);
  }, [hero]);
  if (!hero) return null;
  const note = heroNotes.heroes[hero.name];
  const why = beginnerWhy.get(hero.name);
  const t = data?.heroes.get(hero.id);
  const item = itemId != null ? itemById.get(itemId) : null;
  const phases = hero.popularItems
    ? ([
        ["Early game", hero.popularItems.early],
        ["Mid game", hero.popularItems.mid],
        ["Late game", hero.popularItems.late],
      ] as const)
    : [];

  return (
    <Modal open onClose={onClose} label={hero.name}>
      <div className="hero-modal">
        <div className="hm-head">
          <span className="hm-portrait">
            <Img src={hero.images.card} alt={hero.name} />
          </span>
          <div className="hm-title">
            <span className="eyebrow">
              {typeLabel(hero.type)} · {COMPLEXITY[hero.complexity ?? 0] || "?"} {NEW_HEROES.has(hero.name) && "· NEW"}
            </span>
            <h2 className="hm-name">
              {hero.name} {t && <TierBadge t={t.tier} />}
            </h2>
            <Pips n={hero.complexity} />
            {hero.role && <p className="hm-role">{hero.role}</p>}
            {hero.playstyle && <p className="small muted">{hero.playstyle}</p>}
            <div className="tags">
              {hero.tags.map((tg) => (
                <span key={tg} className="tag">
                  {tg}
                </span>
              ))}
            </div>
            <div className="hm-stats">
              {t ? (
                <>
                  <Stat label="Win rate" value={`${t.winRate.toFixed(1)}%`} good={t.winRate >= 50} extra={<Delta v={t.dWin} />} />
                  <Stat label="Pick rate" value={`${t.pickRate.toFixed(1)}%`} extra={<Delta v={t.dPick} />} />
                  <Stat label="Games" value={t.matches.toLocaleString()} extra={<Delta v={t.dGamesPct} unit="%" digits={0} />} />
                  <span className="hm-spark">
                    <Sparkline daily={t.daily} />
                    <span className="stat-note">daily win rate</span>
                  </span>
                </>
              ) : (
                <span className="stat-note">{data ? "No games for this hero in the selected period/rank." : "Live stats loading or unavailable."}</span>
              )}
            </div>
            {t && <span className="stat-note">Uses the period and rank filters from the Heroes tab · deadlock-api.com</span>}
          </div>
        </div>

        {why && (
          <div className="tip beginner">
            <b>Good to learn on</b> {why}
          </div>
        )}
        {note ? (
          <div className="tip">
            <b>Beginner tip</b> {note.tip}
          </div>
        ) : (
          <Flag>No beginner note written for this hero yet</Flag>
        )}

        <h3 className="sec">Matchups</h3>
        {mu.data && (mu.data.strongVs.length || mu.data.weakVs.length || mu.data.bestWith.length) ? (
          <div className="matchups">
            <MatchupCol title="Strong against" tone="up" list={mu.data.strongVs} onPick={onPick} />
            <MatchupCol title="Struggles against" tone="down" list={mu.data.weakVs} onPick={onPick} />
            <MatchupCol title="Best teammates" tone="up" list={mu.data.bestWith} onPick={onPick} />
          </div>
        ) : (
          <p className="muted small">{mu.loading ? "Loading matchups…" : mu.err ? `Matchups unavailable: ${mu.err}` : `Not enough games (each pairing needs ${MATCHUP_MIN}+) for this period and rank range.`}</p>
        )}
        {mu.data && (
          <p className="stat-note">
            Numbers show how much better or worse {hero.name} does than both heroes' usual win rates would predict ({hero.name}: {mu.data.baseline.toFixed(1)}%), so strong heroes don't top every list. Hover a row for the raw win rate. Only pairings with {MATCHUP_MIN}+ games. Same period &amp; rank filter as above · deadlock-api.com
          </p>
        )}

        <h3 className="sec">Abilities</h3>
        <div className="abilities">
          {hero.abilities.map((a) => (
            <div key={a.slot} className={`ability ${openAb === a.slot ? "open" : ""}`}>
              <button className="ab-head" onClick={() => setOpenAb(openAb === a.slot ? null : a.slot)}>
                <span className="ab-icon">
                  <Img src={a.image} alt={a.name} size={44} />
                  <kbd>{a.slot === 4 ? "4 · ULT" : a.slot}</kbd>
                </span>
                <span className="ab-name">{a.name}</span>
                {a.cooldown && <span className="ab-cd">⟳ {a.cooldown}</span>}
              </button>
              <div className="ab-body">
                {a.quip && <p className="ab-quip">{a.quip}</p>}
                {a.desc ? <Rich html={a.desc} /> : <span className="muted">No description in the game data.</span>}
                {openAb === a.slot && a.upgrades.some(Boolean) && (
                  <ol className="ab-upgrades">
                    {a.upgrades.map((u, i) =>
                      u ? (
                        <li key={i}>
                          <span className="ap">Tier {i + 1}</span> <Rich html={u} />
                        </li>
                      ) : null,
                    )}
                  </ol>
                )}
                {a.upgrades.some(Boolean) && openAb !== a.slot && <span className="ab-more">Show upgrades ▾</span>}
              </div>
            </div>
          ))}
        </div>

        <h3 className="sec">What players buy on {hero.name}</h3>
        {phases.length ? (
          <>
            <div className="phases">
              {phases.map(([label, arr]) => (
                <div key={label} className="phase">
                  <span className="phase-label">{label}</span>
                  <div className="phase-items">
                    {[...arr]
                      .sort((a, b) => b.pick - a.pick)
                      .slice(0, 6)
                      .map((p) => {
                        const it = itemById.get(p.id);
                        return it ? <ItemTile key={p.id} item={it} size={58} note={`${p.pick.toFixed(0)}% buy`} onClick={() => setItemId(p.id)} /> : null;
                      })}
                  </div>
                </div>
              ))}
            </div>
            <p className="small muted">
              Most-bought items per phase across all ranks (game data snapshot, sampled{" "}
              {fmtDate(new Date(hero.popularItems!.timestamp * 1000).toISOString())}). Popular ≠ optimal, but it's a safe default.
            </p>
          </>
        ) : (
          <p className="muted">No purchase data available for this hero yet.</p>
        )}
        {item && (
          <div className="inline-item">
            <ItemDetail item={item} />
          </div>
        )}
        <p className="sources">
          More: <a href={`https://deadlock.wiki/${encodeURIComponent(hero.name.replaceAll(" ", "_"))}`} target="_blank" rel="noreferrer">deadlock.wiki/{hero.name}</a>
        </p>
      </div>
    </Modal>
  );
}

function Stat({ label, value, good, extra }: { label: string; value: string; good?: boolean; extra?: ReactNode }) {
  return (
    <span className={`stat ${good === undefined ? "" : good ? "good" : "bad"}`}>
      <b>{value}</b>
      <span>{label}</span>
      {extra}
    </span>
  );
}

function MatchupCol({ title, tone, list, onPick }: { title: string; tone: "up" | "down"; list: Matchup[]; onPick: (h: Hero) => void }) {
  return (
    <div className={`mu-col ${tone}`}>
      <span className="mu-title">{title}</span>
      {list.length ? (
        <ul>
          {list.map((m, i) => {
            const h = heroById.get(m.heroId);
            if (!h) return null;
            return (
              <li key={m.heroId} style={{ ["--i" as string]: i }}>
                <button className="mu-row" onClick={() => onPick(h)} title={`${m.winRate.toFixed(1)}% win rate over ${m.matches.toLocaleString()} games`}>
                  <Img src={h.images.small} alt="" size={30} className="hr-img" />
                  <span className="mu-name">{h.name}</span>
                  <Delta v={m.diff} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <span className="muted small">None stand out</span>
      )}
    </div>
  );
}
