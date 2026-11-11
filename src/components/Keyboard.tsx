import type { CSSProperties } from "react";

/** Left-hand keyboard cluster + mouse. Each key: [id, label, width in key units]. */
type K = [string, string, number?];
export const KEY_ROWS: K[][] = [
  [["F1", "F1"], ["F2", "F2"], ["F3", "F3"], ["F4", "F4"], ["F5", "F5"], ["F6", "F6"], ["F7", "F7"]],
  [["`", "`"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"], ["6", "6"], ["7", "7"]],
  [["Tab", "Tab", 1.5], ["Q", "Q"], ["W", "W"], ["E", "E"], ["R", "R"], ["T", "T"], ["Y", "Y"], ["U", "U"]],
  [["Caps", "Caps", 1.75], ["A", "A"], ["S", "S"], ["D", "D"], ["F", "F"], ["G", "G"], ["H", "H"], ["J", "J"]],
  [["LShift", "Shift", 2.25], ["Z", "Z"], ["X", "X"], ["C", "C"], ["V", "V"], ["B", "B"], ["N", "N"], ["Enter", "Enter", 1.5]],
  [["LCtrl", "Ctrl", 1.25], ["Win", "Win", 1.25], ["LAlt", "Alt", 1.25], ["Space", "Space", 5.5]],
];
const MOUSE: K[] = [["M1", "LMB"], ["M3", "Wheel"], ["M2", "RMB"]];

export interface KeyState {
  /** colour of the first visible bind on this key, if any */
  color?: string;
  count: number;
}

export function Keyboard({
  keys,
  lit,
  onHover,
  onPick,
}: {
  keys: Record<string, KeyState>;
  lit: Set<string>;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
}) {
  let i = 0;
  const key = ([id, label, w = 1]: K) => {
    const st = keys[id];
    const style = { "--w": w, "--c": st?.color, "--i": i++ } as CSSProperties;
    return (
      <button
        key={id}
        className={`kb-key ${st ? "bound" : ""} ${lit.has(id) ? "lit" : ""} ${lit.size && !lit.has(id) ? "dim" : ""}`}
        style={style}
        disabled={!st}
        onMouseEnter={() => onHover(id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(id)}
        onBlur={() => onHover(null)}
        onClick={() => onPick(id)}
        aria-label={`${label}${st ? `, ${st.count} action${st.count > 1 ? "s" : ""}` : ""}`}
      >
        {label}
        {st && st.count > 1 && <i className="kb-n">{st.count}</i>}
      </button>
    );
  };
  return (
    <div className="kb">
      <div className="kb-board">
        {KEY_ROWS.map((row, r) => (
          <div className="kb-row" key={r}>
            {row.map(key)}
          </div>
        ))}
      </div>
      <div className="kb-mouse" aria-label="Mouse">
        <div className="kb-mouse-top">{MOUSE.map(key)}</div>
        <div className="kb-mouse-body" aria-hidden />
      </div>
    </div>
  );
}
