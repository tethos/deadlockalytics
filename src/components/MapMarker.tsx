import { memo, type CSSProperties } from "react";
import { mapGuide, type MapLayerDef } from "../lib/content";
import { teamColor, type Marker } from "../lib/mapLayers";

const S = 1000;
export const layerDef = new Map<string, MapLayerDef>(mapGuide.layers.map((l) => [l.id, l]));
export type Shape = "diamond" | "badge" | "ring" | "triangle" | "square" | "dot";

/** One shape vocabulary for the map and its legend. */
export function shapeOf(m: Pick<Marker, "layer" | "size" | "dense">): Shape {
  if (m.layer === "objectives") return "diamond";
  if (m.layer === "sentries") return "triangle";
  if (m.layer === "urn" && m.size !== 2) return "ring";
  if (m.layer === "tough" || m.layer === "crates") return "square";
  return m.dense ? "dot" : "badge";
}

/** Plain SVG path/element for a shape of radius r (shared with the legend). */
export function ShapeBody({ shape, r, className = "mk-body" }: { shape: Shape; r: number; className?: string }) {
  switch (shape) {
    case "diamond":
      return <path className={className} d={`M0,${-r * 1.3} L${r * 1.3},0 L0,${r * 1.3} L${-r * 1.3},0 Z`} />;
    case "triangle":
      return <path className={className} d={`M0,${-r * 1.3} L${r * 1.2},${r} L${-r * 1.2},${r} Z`} />;
    case "square":
      return <rect className={className} x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.3} />;
    case "ring":
      return <circle className={`${className} hollow`} r={r} />;
    default:
      return <circle className={className} r={r} />;
  }
}

export const MarkerShape = memo(function MarkerShape({
  m,
  k,
  i,
  small,
  pending,
  soon,
  active,
  onHover,
  onPick,
}: {
  m: Marker;
  k: number;
  i: number;
  small: boolean;
  pending: boolean;
  soon: boolean;
  active: boolean;
  onHover: (m: Marker | null) => void;
  onPick: (m: Marker) => void;
}) {
  const def = layerDef.get(m.layer);
  const color = m.team != null ? teamColor(m.team) : def?.color ?? "var(--gold)";
  const shape = shapeOf(m);
  const r = (m.dense ? (small ? 3.5 : 5.5) : 12 + (m.size ?? 1) * 3) * k;
  const style = { "--mc": color, "--i": Math.min(i, 60) } as CSSProperties;

  return (
    <g
      className={`mk mk-${m.layer} ${m.dense ? "dense" : ""} ${pending ? "pending" : ""} ${soon ? "soon" : ""} ${active ? "active" : ""}`}
      style={style}
      transform={`translate(${m.x * S} ${m.y * S})`}
      onPointerEnter={() => onHover(m)}
      onPointerLeave={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onPick(m);
      }}
    >
      <g className="mk-in">
        {(m.layer === "objectives" || m.layer === "rift") && <circle className="mk-pulse" r={r * 1.6} />}
        {soon && <circle className="mk-soon" r={r * 1.5} />}
        {active && <circle className="mk-ring" r={r * 1.9} />}
        <ShapeBody shape={shape} r={r} />
        {shape === "badge" && (
          <text className="mk-glyph" style={{ fontSize: r * 1.15 }} dy="0.36em">
            {def?.icon}
          </text>
        )}
        {/* bigger invisible hit area for small markers */}
        <circle className="mk-hit" r={Math.max(r, 10 * k) * 1.4} />
      </g>
    </g>
  );
});
