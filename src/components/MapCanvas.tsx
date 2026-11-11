import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { mapData } from "../lib/data";
import { bases, lanes, markers, markerByKey, type Marker } from "../lib/mapLayers";
import { MarkerShape } from "./MapMarker";

const S = 1000; // viewBox units per map side
const MIN_W = S / 6; // max zoom = 6×

export type Level = "street" | "mid_tunnels" | "rat_tunnels";
type View = { x: number; y: number; w: number };
const FULL: View = { x: 0, y: 0, w: S };
const clampView = (v: View): View => {
  const w = Math.min(S, Math.max(MIN_W, v.w));
  return { w, x: Math.min(S - w, Math.max(0, v.x)), y: Math.min(S - w, Math.max(0, v.y)) };
};
const motionOn = () => document.documentElement.dataset.motion !== "off";
const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

export const MapCanvas = memo(function MapCanvas({
  on,
  level,
  selected,
  onSelect,
  isPending,
  isSoon,
  jump,
}: {
  on: Set<string>;
  level: Level;
  selected: Marker | null;
  onSelect: (m: Marker | null) => void;
  /** the match clock says this marker hasn't spawned yet */
  isPending: (m: Marker) => boolean;
  /** this marker's next spawn is less than 30s away */
  isSoon: (m: Marker) => boolean;
  /** zoom to a marker; `n` changes on every request so the same marker can be jumped to twice */
  jump: { key: string; n: number } | null;
}) {
  const [view, setViewState] = useState<View>(FULL);
  const [hover, setHover] = useState<Marker | null>(null);
  const [hint, setHint] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewRef = useRef(view);
  const anim = useRef(0);
  const hintTimer = useRef(0);
  const drag = useRef<{ px: number; py: number; v: View; moved: boolean } | null>(null);
  const selRef = useRef(selected);
  selRef.current = selected;
  const pick = useCallback((m: Marker) => onSelect(selRef.current?.key === m.key ? null : m), [onSelect]);

  const setView = (v: View) => {
    cancelAnimationFrame(anim.current);
    viewRef.current = v;
    setViewState(v);
  };
  /** Smooth glide to a view (instant when motion is off). */
  const glideTo = (target: View) => {
    const to = clampView(target);
    cancelAnimationFrame(anim.current);
    if (!motionOn()) return setView(to);
    const from = viewRef.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 420);
      const e = 1 - Math.pow(1 - p, 3);
      const v = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e };
      viewRef.current = v;
      setViewState(v);
      if (p < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };
  const toMap = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: v.x + ((clientX - r.left) / r.width) * v.w, y: v.y + ((clientY - r.top) / r.height) * v.w };
  };
  const zoomed = (factor: number, cx?: number, cy?: number): View => {
    const v = viewRef.current;
    const x = cx ?? v.x + v.w / 2;
    const y = cy ?? v.y + v.w / 2;
    const w = Math.min(S, Math.max(MIN_W, v.w * factor));
    return clampView({ w, x: x - ((x - v.x) / v.w) * w, y: y - ((y - v.y) / v.w) * w });
  };

  // Plain scroll always scrolls the page. Ctrl/⌘ + scroll (or a trackpad pinch) zooms and never scrolls the page.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setHint(true);
        clearTimeout(hintTimer.current);
        hintTimer.current = window.setTimeout(() => setHint(false), 1400);
        return;
      }
      e.preventDefault();
      setHint(false);
      const p = toMap(e.clientX, e.clientY);
      setView(zoomed(Math.exp(Math.max(-1, Math.min(1, e.deltaY / 100)) * 0.25), p.x, p.y));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(hintTimer.current);
      cancelAnimationFrame(anim.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jump to a marker (search, "up next" list).
  useEffect(() => {
    const m = jump && markerByKey.get(jump.key);
    if (!m) return;
    const w = Math.min(viewRef.current.w, S / 3);
    glideTo({ w, x: m.x * S - w / 2, y: m.y * S - w / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump?.n]);

  const onDown = (e: RPointerEvent) => {
    if (viewRef.current.w >= S) return;
    drag.current = { px: e.clientX, py: e.clientY, v: viewRef.current, moved: false };
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const r = svgRef.current!.getBoundingClientRect();
    const dx = ((e.clientX - d.px) / r.width) * d.v.w;
    const dy = ((e.clientY - d.py) / r.height) * d.v.w;
    if (!d.moved && Math.abs(e.clientX - d.px) + Math.abs(e.clientY - d.py) > 4) {
      d.moved = true;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
    if (d.moved) setView(clampView({ ...d.v, x: d.v.x - dx, y: d.v.y - dy }));
  };
  const onUp = (e: RPointerEvent) => {
    const moved = drag.current?.moved;
    drag.current = null;
    if (!moved && !(e.target as Element).closest(".mk")) onSelect(null);
  };
  const onDouble = (e: React.MouseEvent) => {
    if ((e.target as Element).closest(".mk")) return;
    const p = toMap(e.clientX, e.clientY);
    glideTo(zoomed(e.shiftKey ? 2 : 0.5, p.x, p.y));
  };

  const k = view.w / S; // keeps markers the same on-screen size at any zoom
  const visible = markers.filter((m) => on.has(m.layer));
  // Lots of small pickups at full view → shrink them so the important markers stay readable.
  const denseCount = visible.filter((m) => m.dense).length;
  const crowd = view.w >= S * 0.7 && denseCount > 150;
  const img = mapData.images;
  const pct = (v: number, o: number) => `${((v * S - o) / view.w) * 100}%`;
  const isZoomed = view.w < S - 0.5;

  return (
    <div className={`map-canvas ${isZoomed ? "zoomed" : ""} ${crowd ? "crowded" : ""}`}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
        role="img"
        aria-label="Annotated Deadlock map"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onDoubleClick={onDouble}
        onPointerLeave={() => setHover(null)}
        style={{ "--k": k } as CSSProperties}
      >
        <defs>
          <filter id="mglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="mvignette">
            <stop offset="55%" stopColor="#e9b24c" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#e9b24c" stopOpacity="0" />
          </radialGradient>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#9fe3ff" />
          </marker>
        </defs>

        <circle cx={S / 2} cy={S / 2} r={S / 2} fill="url(#mvignette)" />
        <image href={img.minimap} width={S} height={S} className={`map-img ${level === "street" ? "" : "dim"}`} />
        {level !== "street" && img[level] && <image key={level} href={img[level]} width={S} height={S} className="map-img tunnels" />}

        {on.has("lanes") && (
          <g className="lanes">
            {lanes.map((l, i) => {
              const pts = l.points.map((p) => `${p.x * S},${p.y * S}`).join(" ");
              return (
                <g key={l.color} style={{ "--lc": l.color, "--i": i } as CSSProperties}>
                  <polyline className="zip" points={pts} pathLength={1} filter="url(#mglow)" />
                  <polyline className="zip-flow" points={pts} />
                </g>
              );
            })}
          </g>
        )}

        {on.has("teleporters") && (
          <g className="tp-links">
            {markers
              .filter((m) => m.layer === "teleporters" && m.to && m.x < m.to.x)
              .map((m) => {
                const x1 = m.x * S, y1 = m.y * S, x2 = m.to!.x * S, y2 = m.to!.y * S;
                return <path key={m.key} d={`M${x1},${y1} Q${(x1 + x2) / 2},${(y1 + y2) / 2 - 60} ${x2},${y2}`} style={{ strokeWidth: 2.5 * k }} />;
              })}
          </g>
        )}

        {on.has("bounce") && (
          <g className="bounce-links">
            {markers
              .filter((m) => m.layer === "bounce" && m.to)
              .map((m) => {
                const x1 = m.x * S, y1 = m.y * S, x2 = m.to!.x * S, y2 = m.to!.y * S;
                const len = Math.hypot(x2 - x1, y2 - y1);
                // arc bulges to the left of travel direction, like a jump
                const cx = (x1 + x2) / 2 + ((y1 - y2) / len) * len * 0.3;
                const cy = (y1 + y2) / 2 + ((x2 - x1) / len) * len * 0.3;
                return (
                  <g key={m.key}>
                    <path d={`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`} markerEnd="url(#arrowhead)" style={{ strokeWidth: 2.2 * k }} />
                    <circle className="bounce-land" cx={x2} cy={y2} r={4 * k} />
                  </g>
                );
              })}
          </g>
        )}

        <g className="markers">
          {visible.map((m, i) => (
            <MarkerShape
              key={m.key}
              m={m}
              k={k}
              i={i}
              small={crowd}
              pending={isPending(m)}
              soon={isSoon(m)}
              active={selected?.key === m.key}
              onHover={setHover}
              onPick={pick}
            />
          ))}
        </g>

        {on.has("lanes") && (
          <g className="labels">
            {lanes.map((l) => (
              <text
                key={l.color}
                className="lane-label"
                x={l.label.x * S}
                y={l.label.y * S}
                transform={`rotate(-90 ${l.label.x * S} ${l.label.y * S})`}
                dy={-12 * k}
                style={{ fill: l.color, fontSize: 19 * k }}
              >
                {l.name.toUpperCase()}
              </text>
            ))}
            {bases.map((b) => (
              <text key={b.team} className="base-label" x={b.x * S} y={b.y * S} style={{ fill: b.color, fontSize: 23 * k }}>
                {b.label}
              </text>
            ))}
          </g>
        )}
      </svg>

      {hover && (
        <div className="map-tip" style={{ left: pct(hover.x, view.x), top: pct(hover.y, view.y) }}>
          <b>{hover.name}</b>
          {isSoon(hover) ? <span className="soon"> · spawning soon</span> : isPending(hover) && <span> · not spawned yet</span>}
        </div>
      )}

      <div className={`map-hint ${hint ? "show" : ""}`} aria-hidden>
        Hold <kbd>{isMac ? "⌘" : "Ctrl"}</kbd> and scroll to zoom · double-click to zoom in
      </div>

      <div className="map-zoom" role="group" aria-label="Zoom">
        <button className="btn small-btn" onClick={() => glideTo(zoomed(0.6))} aria-label="Zoom in" disabled={view.w <= MIN_W + 0.5}>
          +
        </button>
        <button className="btn small-btn" onClick={() => glideTo(zoomed(1 / 0.6))} aria-label="Zoom out" disabled={!isZoomed}>
          −
        </button>
        <button className="btn small-btn" onClick={() => glideTo(FULL)} disabled={!isZoomed}>
          Reset
        </button>
      </div>
    </div>
  );
});
