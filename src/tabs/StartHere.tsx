import type { CSSProperties } from "react";
import { TabHeader, Card, Flag, SourceList } from "../components/common";
import { concepts } from "../lib/content";

export function StartHere() {
  return (
    <>
      <TabHeader
        title="Start Here"
        eyebrow="Core concepts"
        subtitle="Everything you need for your first matches, in reading order."
        contentAsOf={concepts.asOfPatch}
      />

      <section className="tldr">
        <span className="eyebrow">The 30-second version</span>
        <ol>
          {concepts.tldr.map((x, i) => (
            <li key={x} style={{ "--i": i } as CSSProperties}>
              <span className="tldr-n">{i + 1}</span>
              {x}
            </li>
          ))}
        </ol>
      </section>

      <Card title="How you win: the tower chain" className="static">
        <p className="muted small">Each lane's buildings must fall in this order. The last one standing between you and victory is the Patron.</p>
        <ol className="chain">
          {concepts.chain.map((c, i) => (
            <li key={c.name} style={{ "--i": i } as CSSProperties}>
              <div className="chain-node">
                <span className="chain-step">{i + 1}</span>
                <b>{c.name}</b>
                <span className="chain-count">{c.count}</span>
              </div>
              <ul>
                {c.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid wide concept-grid">
        {concepts.sections.map((s, i) => (
          <section key={s.id} className="card concept" style={{ "--i": i } as CSSProperties}>
            <h2 className="card-title">
              <span className="concept-icon">{s.icon}</span> {s.title}
            </h2>
            <ul>
              {s.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Card title="Your first matches" accent="var(--ok)" className="static">
        <ol className="first-list">
          {concepts.firstMatches.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
        <p className="small muted">
          Next: <a href="#timeline">Match Timeline</a> (what happens when) · <a href="#heroes">Heroes</a> · <a href="#mistakes">Beginner Mistakes</a>
        </p>
      </Card>

      {concepts.flags.map((f) => (
        <p key={f}>
          <Flag>{f}</Flag>
        </p>
      ))}
      <SourceList sources={concepts.sources} />
    </>
  );
}
