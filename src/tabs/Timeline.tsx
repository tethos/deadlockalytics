import { useState, type CSSProperties } from "react";
import { TabHeader, Card, Flag, SourceList } from "../components/common";
import { clock, fmtClock, parseClock, respawnAt, timeline, upcoming, useClock, waveInterval, type TimelineEvent } from "../lib/timer";

const KIND: Record<string, { icon: string; color: string; label: string }> = {
  objective: { icon: "◆", color: "var(--gold)", label: "Objective" },
  boss: { icon: "☠", color: "#ff5d73", label: "Boss" },
  camp: { icon: "☗", color: "var(--vitality)", label: "Haunts" },
  loot: { icon: "✚", color: "var(--sapphire)", label: "Loot" },
  buff: { icon: "✦", color: "var(--spirit)", label: "Buff" },
  lane: { icon: "≡", color: "var(--muted)", label: "Lane" },
};
const SCALE = 2400; // the strip shows 0:00 – 40:00

const phaseAt = (t: number) => timeline.phases.find((p) => t >= p.from && (p.to == null || t < p.to)) ?? timeline.phases[0];

export function Timeline() {
  const c = useClock();
  const t = c.t;
  const phase = phaseAt(t);
  const next = upcoming(Math.max(0, t - 15), c.bossKills).slice(0, 6);
  const resp = respawnAt(t);

  return (
    <>
      <TabHeader
        title="Match Timeline"
        eyebrow="Game plan · timer"
        subtitle="Press Start when the in-game clock starts, or type the current time to sync. The timer keeps running when you switch tabs."
        contentAsOf={timeline.asOfPatch}
      />

      <section className={`timer-panel ${c.running ? "running" : ""}`} style={{ "--pc": phase.color } as CSSProperties}>
        <div className="tp-main">
          <span className="tp-phase">{phase.name}</span>
          <span className="tp-clock" aria-live="off">
            {fmtClock(t)}
          </span>
          <span className="tp-goal">{phase.goal}</span>
        </div>
        <div className="tp-controls">
          <div className="tp-row">
            {c.running ? (
              <button className="btn primary big" onClick={clock.pause}>
                ❚❚ Pause
              </button>
            ) : (
              <button className="btn primary big" onClick={clock.start}>
                ▶ {t > 0 ? "Resume" : "Start"}
              </button>
            )}
            <button className="btn" onClick={() => confirmReset() && clock.reset()}>
              ↺ Reset
            </button>
            <SetTime />
          </div>
          <div className="tp-row">
            <span className="fp-label">Nudge</span>
            {[-10, -1, 1, 10].map((d) => (
              <button key={d} className="chip" onClick={() => clock.nudge(d)}>
                {d > 0 ? `+${d}` : d}s
              </button>
            ))}
          </div>
          <div className="tp-row">
            <button className="btn boss" onClick={clock.bossKilled} disabled={t <= 0}>
              ☠ Mid-Boss killed
            </button>
            {c.bossKills.length > 0 && (
              <button className="chip" onClick={clock.undoBoss}>
                undo ({c.bossKills.length})
              </button>
            )}
          </div>
        </div>
        <div className="tp-stats">
          <span className="stat">
            <b>{resp == null ? "short" : t > 2400 ? "85–90s" : `~${Math.round(resp)}s`}</b>
            <span>respawn time</span>
          </span>
          <span className="stat">
            <b>{waveInterval(t)}s</b>
            <span>between waves</span>
          </span>
          <span className="stat">
            <b>{c.bossKills.length}</b>
            <span>Mid-Boss kills</span>
          </span>
        </div>
        <Strip t={t} />
      </section>

      <Card title="Up next" className="static">
        <ol className="upnext">
          {next.map(({ ev, at }, i) => (
            <UpNext key={`${ev.id}-${at}`} ev={ev} at={at} t={t} i={i} />
          ))}
          {!next.length && <li className="muted">Nothing scheduled in the next 20 minutes.</li>}
        </ol>
      </Card>

      <div className="grid phases-grid">
        {timeline.phases.map((p, i) => (
          <section key={p.id} className={`card phase-card ${p.id === phase.id ? "current" : ""}`} style={{ "--pc": p.color, "--i": i } as CSSProperties}>
            <span className="eyebrow">
              {fmtClock(p.from)}
              {p.to ? ` – ${fmtClock(p.to)}` : "+"} {p.id === phase.id && "· now"}
            </span>
            <h2 className="card-title">{p.name}</h2>
            <p className="phase-goal">{p.goal}</p>
            <ul className="do-list">
              {p.do.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <ul className="avoid-list">
              {p.avoid.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Card title="Full schedule" className="static">
        <ul className="schedule">
          {timeline.events
            .filter((e) => !e.hidden)
            .map((e) => (
              <li key={e.id} className={e.at <= t && !e.every && e.id !== "midboss" ? "past" : ""}>
                <span className="sch-time">
                  {e.approx && "~"}
                  {fmtClock(e.at)}
                  {e.every && <small>every {fmtClock(e.every)}</small>}
                </span>
                <KindIcon k={e.kind} />
                <span>
                  <b>{e.name}</b> {e.flag && <Flag>check</Flag>}
                  <span className="muted small"> {e.what}</span>
                </span>
              </li>
            ))}
        </ul>
        <p className="small muted">
          Respawn (wiki): 8s at 5:00 · 38s at 20:00 · 70s at 30:00 · 85s at 40:00 · max {timeline.respawn.cap}s, rising evenly in between.{" "}
          {timeline.respawn.notes.join(" ")}
        </p>
      </Card>

      {timeline.flags.map((f) => (
        <p key={f}>
          <Flag>{f}</Flag>
        </p>
      ))}
      <SourceList sources={timeline.sources} />
    </>
  );
}

function confirmReset() {
  return window.confirm("Reset the match timer to 0:00?");
}

function SetTime() {
  const [v, setV] = useState("");
  const bad = v !== "" && parseClock(v) == null;
  return (
    <form
      className="set-time"
      onSubmit={(e) => {
        e.preventDefault();
        const s = parseClock(v);
        if (s != null) {
          clock.setTo(s);
          setV("");
          (document.activeElement as HTMLElement | null)?.blur();
        }
      }}
    >
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="set m:ss" aria-label="Set match time (m:ss)" className={bad ? "bad" : ""} inputMode="numeric" />
      <button className="btn" disabled={v === "" || bad}>
        Set
      </button>
    </form>
  );
}

function KindIcon({ k }: { k: string }) {
  const m = KIND[k] ?? KIND.lane;
  return (
    <span className="kind-icon" style={{ color: m.color }} title={m.label}>
      {m.icon}
    </span>
  );
}

function UpNext({ ev, at, t, i }: { ev: TimelineEvent; at: number; t: number; i: number }) {
  const left = at - t;
  const state = left <= 0 ? "now" : left <= 30 ? "soon" : left <= 90 ? "near" : "";
  const m = KIND[ev.kind] ?? KIND.lane;
  return (
    <li className={`un ${state}`} style={{ "--kc": m.color, "--i": i } as CSSProperties}>
      <span className="un-count">{left <= 0 ? "NOW" : `${ev.approx ? "~" : ""}${fmtClock(left)}`}</span>
      <span className="un-icon">{m.icon}</span>
      <span className="un-body">
        <b>{ev.name}</b>
        <span className="small muted">{ev.what}</span>
      </span>
      <span className="un-at">at {fmtClock(at)}</span>
    </li>
  );
}

function Strip({ t }: { t: number }) {
  const ticks = [0, 300, 600, 900, 1200, 1500, 1800, 2100, 2400];
  const marks = timeline.events.filter((e) => !e.hidden && e.at > 0 && e.at < SCALE);
  return (
    <div className="strip" aria-hidden>
      <div className="strip-bar">
        {timeline.phases.map((p) => {
          const to = p.to ?? SCALE;
          return <span key={p.id} className="strip-phase" style={{ left: `${(p.from / SCALE) * 100}%`, width: `${((to - p.from) / SCALE) * 100}%`, background: p.color }} />;
        })}
        <span className="strip-fill" style={{ width: `${Math.min(1, t / SCALE) * 100}%` }} />
        {marks.map((e) => (
          <span key={e.id} className="strip-mark" style={{ left: `${(e.at / SCALE) * 100}%`, color: (KIND[e.kind] ?? KIND.lane).color }} title={`${fmtClock(e.at)} ${e.name}`} />
        ))}
        <span className="strip-now" style={{ left: `${Math.min(1, t / SCALE) * 100}%` }} />
      </div>
      <div className="strip-ticks">
        {ticks.map((x) => (
          <span key={x} style={{ left: `${(x / SCALE) * 100}%` }}>
            {x / 60}
          </span>
        ))}
      </div>
    </div>
  );
}
