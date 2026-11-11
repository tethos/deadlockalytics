import { useMemo, useState, type ReactNode } from "react";
import { heroes, itemById, ranks, type Item } from "../lib/data";
import { statsGuide } from "../lib/content";
import type { Bans, ItemStat, RankDist, Section as Sec } from "../lib/metaStats";
import { Card, Img } from "../components/common";
import { Modal } from "../components/Modal";
import { ItemDetail } from "../components/ItemBits";
import { usePersisted, rankName, rankImg } from "../components/LiveBits";

export const fmtTime = (s: number) => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`; };

/** Loading skeleton / error / empty wrapper. Numbers are never guessed when the API fails. */
export function Section({ loading, err, empty, children }: { loading: boolean; err?: string | null; empty?: boolean; children: ReactNode }) {
  if (loading) return <div className="stats-skel" aria-hidden><i /><i /><i /></div>;
  if (err) return <p className="muted small stats-empty">Unavailable: {err}. Nothing is shown instead of guessing.</p>;
  if (empty) return <p className="muted small stats-empty">No matches for this period and rank range.</p>;
  return <>{children}</>;
}

const heroById = new Map(heroes.map((h) => [h.id, h]));
const rankColor = (t: number) => ranks.find((r) => r.tier === t)?.color ?? "var(--gold)";

/* ------------------------------ ranks ------------------------------ */

export function RankDistCard({ s, loading }: { s?: Sec<RankDist>; loading: boolean }) {
  const d = s?.data;
  const max = d ? Math.max(...d.tiers.map((t) => t.players), 1) : 1;
  // "top X%": share of players at this rank or higher
  let above = 0;
  const withTop = d ? [...d.tiers].reverse().map((t) => ((above += t.players), { ...t, top: (above / d.total) * 100 })).reverse() : [];
  return (
    <Card title="Rank distribution" className="static">
      <p className="muted small">{statsGuide.sections.ranks}</p>
      <Section loading={loading} err={s?.err} empty={!!d && !d.total}>
        <div className="rank-bars">
          {withTop.map((t, i) => (
            <div
              key={t.tier}
              className="rb"
              style={{ ["--i" as string]: i, ["--rc" as string]: rankColor(t.tier) }}
              title={`${rankName(t.tier)}: ${t.players.toLocaleString()} players · top ${t.top.toFixed(1)}%`}
            >
              <span className="rb-pct">{((t.players / d!.total) * 100).toFixed(1)}%</span>
              <span className="rb-col">
                <i style={{ height: `${(t.players / max) * 100}%` }} />
              </span>
              <Img src={rankImg(t.tier)} alt={rankName(t.tier)} size={30} />
              <span className="rb-name">{rankName(t.tier)}</span>
            </div>
          ))}
        </div>
        {d && <p className="small muted">{d.total.toLocaleString()} ranked players. Hover a bar for the player count and "top X%".</p>}
      </Section>
    </Card>
  );
}

/* ------------------------------ bans ------------------------------ */

export function BansCard({ s, loading }: { s?: Sec<Bans>; loading: boolean }) {
  const [all, setAll] = useState(false);
  const d = s?.data;
  const rows = d ? d.rows.filter((r) => heroById.has(r.heroId)) : [];
  const shown = all ? rows : rows.slice(0, 10);
  const max = rows[0]?.rate || 1;
  return (
    <Card title="Most banned heroes" className="static">
      <p className="muted small">{statsGuide.sections.bans}</p>
      <Section loading={loading} err={s?.err} empty={!!d && (!d.matches || !rows.length)}>
        <ol className="ban-list">
          {shown.map((r, i) => {
            const h = heroById.get(r.heroId)!;
            return (
              <li key={r.heroId} style={{ ["--i" as string]: i }}>
                <span className="bl-rank">{i + 1}</span>
                <Img src={h.images.small} alt="" size={30} className="hr-img" />
                <span className="bl-name">{h.name}</span>
                <span className="bl-bar">
                  <i style={{ width: `${(r.rate / max) * 100}%` }} />
                </span>
                <b>{r.rate.toFixed(1)}%</b>
              </li>
            );
          })}
        </ol>
        {d && (
          <p className="small muted">
            Ban rate = bans ÷ {d.matches.toLocaleString()} matches with ban data.{" "}
            {rows.length > 10 && (
              <button className="chip" onClick={() => setAll(!all)}>
                {all ? "Top 10 only" : `Show all ${rows.length}`}
              </button>
            )}
          </p>
        )}
      </Section>
    </Card>
  );
}

/* ------------------------------ items ------------------------------ */

type ItemSort = "pick" | "win" | "early";
const SORTS: { id: ItemSort; label: string }[] = [
  { id: "pick", label: "Most bought" },
  { id: "win", label: "Win rate" },
  { id: "early", label: "Bought earliest" },
];
const MIN_ITEM_GAMES = 1000;

export function ItemsCard({ s, playerGames, loading }: { s?: Sec<ItemStat[]>; playerGames: number | null; loading: boolean }) {
  const [tier, setTier] = usePersisted("dla.stats.itemtier", 1);
  const [sort, setSort] = usePersisted<ItemSort>("dla.stats.itemsort", "pick");
  const [all, setAll] = useState(false);
  const [sel, setSel] = useState<Item | null>(null);
  const d = s?.data;
  const rows = useMemo(() => {
    if (!d) return [];
    const r = d
      .map((x) => ({ ...x, item: itemById.get(x.id)! }))
      .filter((x) => x.item && x.item.tier === tier && (sort === "pick" || x.matches >= MIN_ITEM_GAMES));
    const key = { pick: (x: ItemStat) => -x.matches, win: (x: ItemStat) => -x.winRate, early: (x: ItemStat) => x.buyTime }[sort];
    return r.sort((a, b) => key(a) - key(b));
  }, [d, tier, sort]);
  const shown = all ? rows : rows.slice(0, 12);
  const maxM = Math.max(...rows.map((r) => r.matches), 1);

  return (
    <Card title="Item usage" className="static">
      <p className="muted small">{statsGuide.sections.items}</p>
      <div className="fp-row items-ctl">
        {[1, 2, 3, 4].map((t) => (
          <button key={t} className="chip" aria-pressed={tier === t} onClick={() => setTier(t)}>
            Tier {t}
          </button>
        ))}
        <span className="chip-sep" />
        {SORTS.map((o) => (
          <button key={o.id} className="chip" aria-pressed={sort === o.id} onClick={() => setSort(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
      <Section loading={loading} err={s?.err} empty={!!d && !rows.length}>
        <div className="item-stat-head small muted" aria-hidden>
          <span>Item</span>
          <span>{playerGames ? "Bought in" : "Games"}</span>
          <span>Win</span>
          <span>Bought at</span>
        </div>
        <ul className="item-stat-list">
          {shown.map((r, i) => (
            <li key={r.id} style={{ ["--i" as string]: i, ["--slot" as string]: `var(--${r.item.slot})` }}>
              <button className="isl-row" onClick={() => setSel(r.item)} title={`${r.matches.toLocaleString()} player-games`}>
                <span className="isl-name">
                  <Img src={r.item.image} alt="" size={26} />
                  {r.item.name}
                </span>
                <span className="isl-pick">
                  <span className="bl-bar">
                    <i style={{ width: `${(r.matches / maxM) * 100}%` }} />
                  </span>
                  {playerGames ? `${((r.matches / playerGames) * 100).toFixed(1)}%` : r.matches.toLocaleString()}
                </span>
                <span className={`isl-win ${r.winRate >= 52 ? "up" : r.winRate < 48 ? "down" : ""}`}>{r.winRate.toFixed(1)}%</span>
                <span className="isl-time">{fmtTime(r.buyTime)}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="small muted">
          {playerGames ? "Bought in = share of player-games where it was bought. " : ""}
          {sort !== "pick" && `Items with under ${MIN_ITEM_GAMES.toLocaleString()} games are hidden for this sort. `}
          {rows.length > 12 && (
            <button className="chip" onClick={() => setAll(!all)}>
              {all ? "Top 12 only" : `Show all ${rows.length}`}
            </button>
          )}
        </p>
        <p className="tip">
          <b>Careful</b>
          {statsGuide.itemWinCaveat}
        </p>
      </Section>
      <Modal open={!!sel} onClose={() => setSel(null)} label={sel?.name ?? "Item"}>
        {sel && <ItemDetail item={sel} />}
      </Modal>
    </Card>
  );
}
