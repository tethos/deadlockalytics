import { useState, type CSSProperties } from "react";
import { matches } from "../lib/data";
import { mapGuide } from "../lib/content";
import { markers, type Marker } from "../lib/mapLayers";
import { fmtClock, type TimelineEvent } from "../lib/timer";
import { ShapeBody, type Shape } from "./MapMarker";

const layerLabel = new Map(mapGuide.layers.map((l) => [l.id, l]));

// ---------------- search ----------------
type Hit = { kind: "marker"; m: Marker } | { kind: "layer"; id: string };

/** Named spots (not the hundreds of crates) plus whole layers, e.g. "snacks" → Healing Snacks layer. */
function search(q: string): Hit[] {
  if (!q.trim()) return [];
  const layers: Hit[] = mapGuide.layers.filter((l) => matches(l.label, q)).map((l) => ({ kind: "layer", id: l.id }));
  const spots: Hit[] = markers
    .filter((m) => !m.dense && matches(`${m.name} ${layerLabel.get(m.layer)?.label ?? ""}`, q))
    .map((m) => ({ kind: "marker", m }));
  return [...layers.slice(0, 3), ...spots].slice(0, 9);
}

export function MapSearch({ onMarker, onLayer }: { onMarker: (m: Marker) => void; onLayer: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const hits = search(q);
  const choose = (h: Hit | undefined) => {
    if (!h) return;
    if (h.kind === "marker") onMarker(h.m);
    else onLayer(h.id);
    setQ("");
    setIdx(0);
  };

  return (
    <div className="map-search">
      <input
        className="search"
        data-search
        type="search"
        placeholder="Find a spot… (press /)"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setIdx(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") (e.preventDefault(), setIdx((i) => Math.min(i + 1, hits.length - 1)));
          else if (e.key === "ArrowUp") (e.preventDefault(), setIdx((i) => Math.max(i - 1, 0)));
          else if (e.key === "Enter") choose(hits[idx]);
        }}
        aria-label="Search the map"
      />
      {q.trim() && (
        <ul className="ms-results" role="listbox">
          {hits.length === 0 && <li className="ms-empty">Nothing named like that on the map.</li>}
          {hits.map((h, i) => {
            const l = layerLabel.get(h.kind === "marker" ? h.m.layer : h.id);
            return (
              <li key={h.kind === "marker" ? h.m.key : `layer-${h.id}`} style={{ "--i": i, "--lc": l?.color } as CSSProperties}>
                <button
                  role="option"
                  aria-selected={i === idx}
                  onMouseEnter={() => setIdx(i)}
                  onMouseDown={(e) => e.preventDefault() /* keep focus so the list doesn't vanish first */}
                  onClick={() => choose(h)}
                >
                  <span className="lb-icon">{l?.icon}</span>
                  <span className="ms-name">{h.kind === "marker" ? h.m.name : `Show all: ${l?.label}`}</span>
                  <span className="ms-kind">{h.kind === "marker" ? l?.label : "layer"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------- up next ----------------
export function UpNext({
  items,
  t,
  live,
  onPick,
}: {
  items: { ev: TimelineEvent; at: number; layer: string }[];
  t: number;
  live: boolean;
  onPick: (layer: string) => void;
}) {
  return (
    <div className="up-next">
      <h3 className="fp-label">{live ? "Up next on the map" : "First spawns"}</h3>
      {items.length === 0 && <p className="muted small">Nothing else on the map in the next 20 minutes.</p>}
      <ul>
        {items.map(({ ev, at, layer }, i) => {
          const l = layerLabel.get(layer);
          const wait = at - t;
          const soon = live && wait <= 30;
          return (
            <li key={`${ev.id}-${at}`} style={{ "--i": i, "--lc": l?.color } as CSSProperties}>
              <button className={`un-row ${soon ? "soon" : ""}`} onClick={() => onPick(layer)} title="Show this layer">
                <span className="lb-icon">{l?.icon}</span>
                <span className="un-name">{ev.name}</span>
                <span className="un-time">{live ? `in ${fmtClock(wait)}` : fmtClock(at)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------- legend ----------------
const LEGEND: { shape: Shape | "arrow" | "dash" | "dim" | "soon"; label: string; color: string }[] = [
  { shape: "diamond", label: "Guardian / Walker / Patron", color: "var(--amber)" },
  { shape: "badge", label: "Point of interest (icon = layer)", color: "var(--vitality)" },
  { shape: "ring", label: "Soul Urn spawn spot", color: "var(--sapphire)" },
  { shape: "dot", label: "Small pickup or prop", color: "#ffd88a" },
  { shape: "square", label: "Crate", color: "#ee9440" },
  { shape: "triangle", label: "Base sentry", color: "var(--sapphire)" },
  { shape: "arrow", label: "Bounce pad → landing", color: "#9fe3ff" },
  { shape: "dash", label: "Teleporter pair", color: "#29b1cc" },
  { shape: "dim", label: "Not spawned yet", color: "var(--vitality)" },
  { shape: "soon", label: "Spawns in under 30s", color: "var(--vitality)" },
];

export function MapLegend() {
  return (
    <ul className="map-legend" aria-label="Map legend">
      {LEGEND.map((e) => (
        <li key={e.label} style={{ "--mc": e.color } as CSSProperties}>
          <svg viewBox="-16 -16 32 32" width="22" height="22" aria-hidden className={`lg-${e.shape}`}>
            {e.shape === "arrow" ? (
              <path className="lg-line" d="M-12,8 Q0,-14 11,6" markerEnd="url(#arrowhead)" />
            ) : e.shape === "dash" ? (
              <path className="lg-line dashed" d="M-13,6 Q0,-10 13,6" />
            ) : e.shape === "dim" || e.shape === "soon" ? (
              <>
                {e.shape === "soon" && <circle className="mk-soon" r={13} />}
                <circle className="mk-body" r={8} />
              </>
            ) : (
              <ShapeBody shape={e.shape} r={e.shape === "dot" || e.shape === "square" ? 6 : 9} />
            )}
          </svg>
          {e.label}
        </li>
      ))}
    </ul>
  );
}
