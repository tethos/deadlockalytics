import type { Item } from "../lib/data";
import { slotColor } from "../lib/content";
import { Img, Rich } from "./common";

export const fmtSouls = (n: number) => n.toLocaleString("en-US");

/** Square item tile with category-colored frame. */
export function ItemTile({ item, onClick, size = 64, note }: { item: Item; onClick?: () => void; size?: number; note?: string }) {
  return (
    <button
      className={`item-tile slot-${item.slot}`}
      style={{ "--slot": slotColor[item.slot], "--size": `${size}px` } as React.CSSProperties}
      onClick={onClick}
      title={`${item.name} — ${fmtSouls(item.cost)} souls${item.active ? " (active)" : ""}`}
    >
      <span className="item-icon">
        <Img src={item.image} alt={item.name} size={size - 18} />
        {item.active && <span className="active-badge">A</span>}
      </span>
      <span className="item-name">{item.name}</span>
      {note && <span className="item-note">{note}</span>}
    </button>
  );
}

/** Full item description (used in the item modal and in search results). */
export function ItemDetail({ item }: { item: Item }) {
  return (
    <div className="item-detail" style={{ "--slot": slotColor[item.slot] } as React.CSSProperties}>
      <div className="item-detail-head">
        <span className="item-icon big">
          <Img src={item.image} alt={item.name} size={60} />
        </span>
        <div>
          <h3>{item.name}</h3>
          <div className="item-meta">
            <span className="cost">◈ {fmtSouls(item.cost)}</span>
            <span className="slot-tag">{item.slot}</span>
            <span>Tier {item.tier}</span>
            {item.active && <span className="active-tag">ACTIVE</span>}
          </div>
        </div>
      </div>
      {item.text && (
        <p className="item-text">
          <Rich html={item.text} />
        </p>
      )}
      {item.props.length > 0 && (
        <ul className="props">
          {item.props.map((p) => (
            <li key={p.label}>
              <b>{p.value}</b> {p.label}
            </li>
          ))}
        </ul>
      )}
      {item.components.length > 0 && <p className="small muted">Builds from: {item.components.join(", ")} (its price is subtracted)</p>}
    </div>
  );
}
