import { useMemo, useState, type CSSProperties } from "react";
import { TabHeader, Card, Flag, SourceList } from "../components/common";
import { Keyboard, type KeyState } from "../components/Keyboard";
import { settingsGuide as g } from "../lib/content";

const srcLabel = (id: string) => g.sources.find((s) => s.id === id);
const groupColor = Object.fromEntries(g.groups.map((x) => [x.id, x.color]));

function SrcTag({ id }: { id: string }) {
  const s = srcLabel(id);
  if (!s) return null;
  return (
    <a className="kb-src" href={s.url} target="_blank" rel="noreferrer" title={s.label}>
      {s.label.split(":")[0]}
    </a>
  );
}

export function Settings() {
  const [groups, setGroups] = useState<Set<string>>(() => new Set(g.groups.map((x) => x.id)));
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [hoverBind, setHoverBind] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  const visible = useMemo(() => g.binds.filter((b) => groups.has(b.group)), [groups]);

  const keyStates = useMemo(() => {
    const m: Record<string, KeyState> = {};
    for (const b of visible)
      for (const k of b.keys) {
        m[k] ??= { color: groupColor[b.group], count: 0 };
        m[k].count++;
      }
    return m;
  }, [visible]);

  // What's lit: a hovered bind wins, then a hovered key, then a pinned key.
  const activeKey = hoverKey ?? pinned;
  const litKeys = useMemo(() => {
    if (hoverBind) return new Set(g.binds.find((b) => b.id === hoverBind)?.keys ?? []);
    return activeKey ? new Set([activeKey]) : new Set<string>();
  }, [hoverBind, activeKey]);
  const litBinds = useMemo(
    () => new Set(hoverBind ? [hoverBind] : activeKey ? visible.filter((b) => b.keys.includes(activeKey)).map((b) => b.id) : []),
    [hoverBind, activeKey, visible],
  );

  const toggleGroup = (id: string) => {
    const s = new Set(groups);
    s.has(id) ? s.delete(id) : s.add(id);
    setGroups(s.size ? s : new Set(g.groups.map((x) => x.id)));
  };

  return (
    <>
      <TabHeader
        title="Settings & Keybinds"
        eyebrow="Set up once"
        subtitle="The default keys, with a few settings changes the guides agree help new players. Hover a key or an action to match them up. Click a key to pin it."
        contentAsOf={g.asOfPatch}
      />

      <Card className="static kb-first" title={<><span className="concept-icon">★</span> First three changes</>}>
        <p className="muted">{g.firstChanges.intro}</p>
        <ol className="kb-first-list">
          {g.firstChanges.items.map((t, i) => (
            <li key={t} style={{ "--i": i } as CSSProperties}>
              {t}
            </li>
          ))}
        </ol>
        <SrcTag id={g.firstChanges.src} />
      </Card>

      <h2 className="sec">Default keybinds</h2>
      <p>
        <Flag>{g.flags[0]}</Flag>
      </p>
      <div className="chips kb-legend">
        {g.groups.map((x) => (
          <button
            key={x.id}
            className="chip kb-chip"
            style={{ "--c": x.color } as CSSProperties}
            aria-pressed={groups.has(x.id)}
            onClick={() => toggleGroup(x.id)}
          >
            <i /> {x.label}
          </button>
        ))}
        {pinned && (
          <button className="chip clear" onClick={() => setPinned(null)}>
            ✕ Unpin key
          </button>
        )}
      </div>

      <div className="kb-layout">
        <Card className="static kb-card">
          <Keyboard keys={keyStates} lit={litKeys} onHover={setHoverKey} onPick={(k) => setPinned((p) => (p === k ? null : k))} />
        </Card>

        <div className="kb-lists">
          {g.groups
            .filter((x) => groups.has(x.id))
            .map((x, gi) => (
              <section key={x.id} className="card static kb-group" style={{ "--c": x.color, "--i": gi } as CSSProperties}>
                <h3 className="kb-group-title">{x.label}</h3>
                <ul>
                  {visible
                    .filter((b) => b.group === x.id)
                    .map((b) => (
                      <li
                        key={b.id}
                        className={`kb-bind ${litBinds.has(b.id) ? "lit" : ""} ${litBinds.size && !litBinds.has(b.id) ? "dim" : ""}`}
                        onMouseEnter={() => setHoverBind(b.id)}
                        onMouseLeave={() => setHoverBind(null)}
                      >
                        <span className="kb-act">
                          {b.action} {b.flag && <Flag>check</Flag>}
                          {b.note && <span className="kb-note">{b.note}</span>}
                        </span>
                        <kbd>{b.label}</kbd>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
        </div>
      </div>

      <h2 className="sec">Recommended settings</h2>
      <p className="small muted">{g.method}</p>
      <p>
        <Flag>{g.flags[1]}</Flag>
      </p>
      <div className="grid">
        {g.settings.map((s, si) => (
          <section key={s.id} className="card static kb-set" style={{ "--i": si } as CSSProperties}>
            <h2 className="card-title">
              <span className="concept-icon">{s.icon}</span> {s.title}
            </h2>
            <dl>
              {s.recs.map((r) => (
                <div key={r.setting} className="kb-rec">
                  <dt>
                    {r.setting} {r.flag && <Flag>check</Flag>}
                  </dt>
                  <dd>
                    <b>{r.value}</b>
                    <span>{r.why}</span>
                    <SrcTag id={r.src} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <SourceList sources={g.sources} />
    </>
  );
}
