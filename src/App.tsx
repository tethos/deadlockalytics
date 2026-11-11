import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { StartHere, Timeline, MapTab, Heroes, Items, Stats, Settings, Videos, Mistakes } from "./tabs";
import { useMotionPref } from "./lib/motion";
import { useClock, fmtClock } from "./lib/timer";

type TabDef = { id: string; label: string; short: string; icon: string; Comp: ComponentType };

export const TABS: TabDef[] = [
  { id: "start", label: "Start Here", short: "Start", icon: "◆", Comp: StartHere },
  { id: "timeline", label: "Match Timeline", short: "Timeline", icon: "◷", Comp: Timeline },
  { id: "map", label: "Map & Objectives", short: "Map", icon: "⌖", Comp: MapTab },
  { id: "heroes", label: "Heroes", short: "Heroes", icon: "☻", Comp: Heroes },
  { id: "items", label: "Items / Shop", short: "Items", icon: "⬢", Comp: Items },
  { id: "stats", label: "Stats & Meta", short: "Stats", icon: "▤", Comp: Stats },
  { id: "settings", label: "Settings & Keys", short: "Settings", icon: "⚙", Comp: Settings },
  { id: "videos", label: "Video Lessons", short: "Videos", icon: "▶", Comp: Videos },
  { id: "mistakes", label: "Beginner Mistakes", short: "Mistakes", icon: "✓", Comp: Mistakes },
];

const fromHash = () => {
  const id = location.hash.replace("#", "");
  return TABS.some((t) => t.id === id) ? id : "start";
};

/** Sliding highlight that glides between tabs (works for the top strip and the side rail). */
function useTabIndicator(active: string) {
  const listRef = useRef<HTMLUListElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
      if (el) setBox({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (listRef.current) ro.observe(listRef.current);
    return () => ro.disconnect();
  }, [active]);

  return { listRef, box };
}

export default function App() {
  const [tab, setTab] = useState(fromHash);
  const [motion, toggleMotion] = useMotionPref();
  const { listRef, box } = useTabIndicator(tab);

  useEffect(() => {
    const onHash = () => setTab(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Keyboard: 1–9 switch tabs, "/" focuses the current tab's search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
      if (e.key === "Escape" && typing) return (t as HTMLInputElement).blur();
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key)) {
        const next = TABS[+e.key - 1];
        if (next) location.hash = next.id;
      } else if (e.key === "/") {
        const input = document.querySelector<HTMLInputElement>("[data-search]");
        if (input) {
          e.preventDefault();
          input.focus();
          input.select();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = TABS.find((t) => t.id === tab)!;
  const Comp = active.Comp;

  return (
    <div className="app">
      <div className="backdrop" aria-hidden>
        <div className="glow glow-amber" />
        <div className="glow glow-sapphire" />
        <div className="deco-grid" />
        <div className="grain" />
      </div>

      <nav className="tabbar" aria-label="Sections">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <span>D</span>
          </span>
          <span className="brand-text">
            <span className="brand-name">Deadlockalytics</span>
            <span className="brand-sub">Field guide to the Cursed Apple</span>
          </span>
        </div>
        <ul ref={listRef}>
          {box && (
            <li
              className="tab-indicator"
              aria-hidden
              style={{ transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h }}
            />
          )}
          {TABS.map((t, i) => (
            <li key={t.id} data-tab={t.id}>
              <a
                href={`#${t.id}`}
                className={t.id === tab ? "active" : ""}
                aria-current={t.id === tab ? "page" : undefined}
                onMouseUp={(e) => e.currentTarget.blur()}
              >
                <span className="tab-icon" aria-hidden>
                  {t.icon}
                </span>
                <span className="tab-label">
                  <span className="long">{t.label}</span>
                  <span className="short">{t.short}</span>
                </span>
                <kbd>{i + 1}</kbd>
              </a>
            </li>
          ))}
        </ul>
        <div className="rail-foot">
          <MiniClock />
          <p className="hint">
            <kbd>1</kbd>–<kbd>9</kbd> tabs · <kbd>/</kbd> search
          </p>
          <button className="motion-toggle" onClick={toggleMotion} aria-pressed={motion} title="Toggle animations">
            <span className="dot" /> Motion {motion ? "on" : "off"}
          </button>
        </div>
      </nav>

      <main className="content">
        <div className="tab-anim" key={tab}>
          <Comp />
        </div>
        <footer className="footer">
          <p>
            Personal, non-commercial fan tool. Deadlock and all hero/item artwork © Valve Corporation; not affiliated with or
            endorsed by Valve. Game data and images hot-loaded from{" "}
            <a href="https://deadlock-api.com" target="_blank" rel="noreferrer">
              deadlock-api.com
            </a>{" "}
            (MIT). Facts cross-checked with{" "}
            <a href="https://deadlock.wiki" target="_blank" rel="noreferrer">
              deadlock.wiki
            </a>{" "}
            and official patch notes on{" "}
            <a href="https://forums.playdeadlock.com/forums/changelog.10/" target="_blank" rel="noreferrer">
              forums.playdeadlock.com
            </a>
            . Per-section sources are listed under each section.
          </p>
        </footer>
      </main>
    </div>
  );
}

/** Small running match clock visible from every tab; click → Match Timeline. */
function MiniClock() {
  const c = useClock();
  if (c.t <= 0) return null;
  return (
    <a className={`mini-clock ${c.running ? "running" : ""}`} href="#timeline" title="Match timer — open Match Timeline">
      <span className="mc-dot" /> {fmtClock(c.t)}
    </a>
  );
}
