import { useState, type CSSProperties } from "react";
import { TabHeader, Flag, SourceList } from "../components/common";
import { mistakes } from "../lib/content";

const KEY = "dla.mistakes";
const load = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};

export function Mistakes() {
  const [done, setDone] = useState<Set<string>>(() => new Set(load()));
  const save = (s: Set<string>) => {
    setDone(s);
    try {
      localStorage.setItem(KEY, JSON.stringify([...s]));
    } catch {
      /* ignore */
    }
  };
  const toggle = (id: string) => {
    const s = new Set(done);
    s.has(id) ? s.delete(id) : s.add(id);
    save(s);
  };
  const total = mistakes.groups.reduce((n, g) => n + g.items.length, 0);
  const pct = total ? done.size / total : 0;

  return (
    <>
      <TabHeader
        title="Beginner Mistakes"
        eyebrow="Per-match checklist"
        subtitle="Tick each one you avoided this match. Reset before the next game."
        contentAsOf={mistakes.asOfPatch}
      />

      <div className="mk-bar">
        <span className="mk-ring" style={{ "--p": pct } as CSSProperties}>
          <b>{done.size}</b>/{total}
        </span>
        <span className="mk-msg">{done.size === total ? "Clean game. Nice." : done.size === 0 ? "Fresh match — good luck." : `${total - done.size} left to watch for`}</span>
        <button className="btn" onClick={() => save(new Set())} disabled={!done.size}>
          ↺ New match
        </button>
      </div>

      <div className="grid wide">
        {mistakes.groups.map((g, gi) => {
          const n = g.items.filter((x) => done.has(`${g.id}.${x.id}`)).length;
          return (
            <section key={g.id} className="card mk-group" style={{ "--i": gi } as CSSProperties}>
              <h2 className="card-title">
                <span className="concept-icon">{g.icon}</span> {g.title}
                <span className="mk-count">
                  {n}/{g.items.length}
                </span>
              </h2>
              <ul className="mk-list">
                {g.items.map((x) => {
                  const id = `${g.id}.${x.id}`;
                  const on = done.has(id);
                  return (
                    <li key={id}>
                      <button className={`mk-item ${on ? "on" : ""}`} onClick={() => toggle(id)} aria-pressed={on}>
                        <span className="mk-box" aria-hidden>
                          {on ? "✓" : ""}
                        </span>
                        <span>
                          <b>{x.bad}</b>
                          <span className="mk-fix">
                            {x.fix} {x.flag && <Flag>check</Flag>}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="small muted">{mistakes.method}</p>
      {mistakes.flags.map((f) => (
        <p key={f}>
          <Flag>{f}</Flag>
        </p>
      ))}
      <SourceList sources={mistakes.sources} />
    </>
  );
}
