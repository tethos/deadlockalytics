import { useMemo, useState } from "react";
import { items, heroes, itemById, matches, type Item, type Slot } from "../lib/data";
import { itemsGuide } from "../lib/content";
import { TabHeader, Card, Flag, SourceList } from "../components/common";
import { Modal } from "../components/Modal";
import { ItemTile, ItemDetail, fmtSouls } from "../components/ItemBits";

const TIERS = [1, 2, 3, 4];
const plain = (html: string) => html.replace(/<[^>]+>/g, " ");

/** Items players buy early on the most heroes — computed from the per-hero popular-item data. */
function commonEarlyItems(n = 10) {
  const score = new Map<number, { sum: number; heroes: number }>();
  for (const h of heroes) {
    for (const p of h.popularItems?.early ?? []) {
      const s = score.get(p.id) ?? { sum: 0, heroes: 0 };
      s.sum += p.pick;
      s.heroes += 1;
      score.set(p.id, s);
    }
  }
  return [...score.entries()]
    .map(([id, s]) => ({ item: itemById.get(id)!, avg: s.sum / heroes.length, heroes: s.heroes }))
    .filter((x) => x.item)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, n);
}

export function Items() {
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [activeOnly, setActiveOnly] = useState(false);
  const [sel, setSel] = useState<Item | null>(null);
  const early = useMemo(() => commonEarlyItems(10), []);

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          (!slot || i.slot === slot) &&
          (!activeOnly || i.active) &&
          (!q || matches(`${i.name} ${i.slot} ${plain(i.text)} ${i.props.map((p) => p.label).join(" ")}`, q)),
      ),
    [q, slot, activeOnly],
  );
  // name matches first, then description matches
  const results = useMemo(() => {
    if (!q) return [];
    return [...filtered].sort((a, b) => Number(matches(b.name, q)) - Number(matches(a.name, q)) || a.cost - b.cost);
  }, [filtered, q]);

  const cats = itemsGuide.categories.filter((c) => !slot || c.slot === slot);

  return (
    <>
      <TabHeader
        eyebrow={`The Curiosity Shop · ${items.length} items`}
        title="Items / Shop"
        subtitle="Type to find any item instantly. Click an icon for the full description."
        contentAsOf={itemsGuide.asOfPatch}
      />

      <div className="filterbar sticky-search">
        <input
          className="search"
          data-search
          placeholder="Item name or effect — e.g. “stamina”, “silence”, “headshot”  (press /)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="chips">
          {itemsGuide.categories.map((c) => (
            <button
              key={c.slot}
              className={`chip chip-${c.slot}`}
              aria-pressed={slot === c.slot}
              onClick={() => setSlot(slot === c.slot ? null : c.slot)}
            >
              {c.name}
            </button>
          ))}
          <span className="chip-sep" />
          <button className="chip" aria-pressed={activeOnly} onClick={() => setActiveOnly(!activeOnly)}>
            Active items only
          </button>
        </div>
      </div>

      {q ? (
        <div className="search-results">
          {results.slice(0, 8).map((i) => (
            <Card key={i.id} className="result-card static">
              <ItemDetail item={i} />
            </Card>
          ))}
          {results.length > 8 && (
            <div className="more-results">
              {results.slice(8).map((i) => (
                <ItemTile key={i.id} item={i} size={56} onClick={() => setSel(i)} />
              ))}
            </div>
          )}
          {!results.length && <p className="muted">No item matches “{q}”.</p>}
        </div>
      ) : (
        <>
          <div className="shop">
            {cats.map((c) => (
              <section key={c.slot} className={`shop-col slot-${c.slot}`} style={{ "--slot": c.color } as React.CSSProperties}>
                <header className="shop-col-head">
                  <h2>{c.name}</h2>
                 
                </header>
                {TIERS.map((t) => {
                  const row = filtered.filter((i) => i.slot === c.slot && i.tier === t);
                  if (!row.length) return null;
                  return (
                    <div key={t} className="tier-row">
                      <span className="tier-label">
                        <b>T{t}</b> ◈ {fmtSouls(row[0].cost)}
                      </span>
                      <div className="tier-items">
                        {row.map((i) => (
                          <ItemTile key={i.id} item={i} size={60} onClick={() => setSel(i)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>

          <div className="grid wide" style={{ marginTop: "var(--gap)" }}>
            <Card title="The three item categories">
              {itemsGuide.categories.map((c) => (
                <div key={c.slot} className="cat-explain" style={{ "--slot": c.color } as React.CSSProperties}>
                  <b>{c.name}</b>
                  <p>{c.what}</p>
                  <p className="small muted">{c.bonus}</p>
                </div>
              ))}
            </Card>
            <Card title="Shop rules">
              <dl className="rules">
                {itemsGuide.rules.map((r) => (
                  <div key={r.title}>
                    <dt>{r.title}</dt>
                    <dd>{r.text}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card title="Beginner buying principles">
              <ol className="principles">
                {itemsGuide.principles.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            </Card>
            <Card title="Most common first buys (all heroes)">
              <div className="tier-items">
                {early.map(({ item, avg }) => (
                  <ItemTile key={item.id} item={item} size={60} note={`${avg.toFixed(0)}% avg`} onClick={() => setSel(item)} />
                ))}
              </div>
              <p className="small muted">
                Computed from each hero's early-game purchase data: average share of players who buy it, across all 44 heroes. Good
                universal starter options when you're unsure.
              </p>
            </Card>
          </div>
        </>
      )}

      <SourceList sources={itemsGuide.sources} />
      {itemsGuide.flags.map((f) => (
        <p key={f}>
          <Flag>{f}</Flag>
        </p>
      ))}

      <Modal open={!!sel} onClose={() => setSel(null)} label={sel?.name ?? "Item"}>
        {sel && <ItemDetail item={sel} />}
      </Modal>
    </>
  );
}
