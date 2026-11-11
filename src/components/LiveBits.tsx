// Small pieces shared by the live-stats tabs (Heroes, Stats & Meta).
import { useState } from "react";
import { ranks } from "../lib/data";
import { WINDOWS, type WindowId } from "../lib/trends";
import { Img } from "./common";

export const rankName = (t: number) => ranks.find((r) => r.tier === t)?.name ?? `Tier ${t}`;
export const rankImg = (t: number) => ranks.find((r) => r.tier === t)?.image ?? null;
export const fmtDay = (unix: number) => new Date(unix * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

/** Remembered per browser (view, filters). */
export function usePersisted<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? (JSON.parse(s) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = (nv: T) => {
    setV(nv);
    try {
      localStorage.setItem(key, JSON.stringify(nv));
    } catch {
      /* ignore */
    }
  };
  return [v, set];
}

export function RankSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span className="rank-select">
      <Img src={rankImg(value)} alt={rankName(value)} size={26} />
      <select value={value} onChange={(e) => onChange(+e.target.value)} aria-label="Rank">
        {ranks.map((r) => (
          <option key={r.tier} value={r.tier}>
            {r.name}
          </option>
        ))}
      </select>
    </span>
  );
}

export function Delta({ v, unit = "pp", digits = 1 }: { v: number | null; unit?: string; digits?: number }) {
  if (v == null) return <span className="delta na">new</span>;
  const cls = Math.abs(v) < 0.05 ? "flat" : v > 0 ? "up" : "down";
  return (
    <span className={`delta ${cls}`}>
      {v > 0 ? "▲" : v < 0 ? "▼" : "•"} {v > 0 ? "+" : ""}
      {v.toFixed(digits)}
      {unit}
    </span>
  );
}

/** Rank range + period chips + refresh, as used on the Heroes tab. */
export function RankPeriodRow({
  rMin, rMax, setRMin, setRMax, win, setWin, onRefresh, loading,
}: {
  rMin: number; rMax: number; setRMin: (v: number) => void; setRMax: (v: number) => void;
  win: WindowId; setWin: (w: WindowId) => void; onRefresh: () => void; loading: boolean;
}) {
  return (
    <div className="fp-row">
      <span className="fp-label">Rank</span>
      <RankSelect value={rMin} onChange={(v) => { setRMin(v); if (v > rMax) setRMax(v); }} />
      <span className="muted">to</span>
      <RankSelect value={rMax} onChange={(v) => { setRMax(v); if (v < rMin) setRMin(v); }} />
      {(rMin !== 0 || rMax !== 11) && (
        <button className="chip" onClick={() => { setRMin(0); setRMax(11); }}>
          All ranks
        </button>
      )}
      <span className="chip-sep" />
      <span className="fp-label">Period</span>
      {WINDOWS.map((w) => (
        <button key={w.id} className="chip" aria-pressed={win === w.id} onClick={() => setWin(w.id)}>
          {w.label}
        </button>
      ))}
      <button className="btn small-btn" onClick={onRefresh} disabled={loading} title="Fetch fresh numbers">
        ⟳ Refresh
      </button>
    </div>
  );
}
