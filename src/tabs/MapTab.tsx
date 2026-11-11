import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { TabHeader, Card, Flag, SourceList } from "../components/common";
import { MapCanvas, type Level } from "../components/MapCanvas";
import { MapLegend, MapSearch, UpNext } from "../components/MapPanels";
import { mapGuide, type MapLayerDef } from "../lib/content";
import { countByLayer, layerSpawn, type Marker } from "../lib/mapLayers";
import { fmtClock, timeline, upcoming, useClock } from "../lib/timer";

const LAYERS_KEY = "dla.map.layers";
const LEVEL_KEY = "dla.map.level";
const DEFAULT_ON = mapGuide.layers.filter((l) => l.on).map((l) => l.id);
const ALL = mapGuide.layers.map((l) => l.id);
/** timeline event id → map layer it spawns on */
const EVENT_LAYER = new Map(Object.entries(mapGuide.spawns).flatMap(([layer, ids]) => ids.map((id) => [id, layer] as const)));
const SOON = 30; // seconds

const LEVELS: { id: Level; label: string }[] = [
  { id: "street", label: "Street" },
  { id: "mid_tunnels", label: "Mid tunnels" },
  { id: "rat_tunnels", label: "Rat tunnels" },
];

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v) return JSON.parse(v) as T;
  } catch {
    /* storage unavailable */
  }
  return fallback;
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export function MapTab() {
  const [on, setOn] = useState(() => new Set(load<string[]>(LAYERS_KEY, DEFAULT_ON).filter((id) => ALL.includes(id))));
  const [level, setLevel] = useState<Level>(() => {
    const v = load<string>(LEVEL_KEY, "street");
    return LEVELS.some((l) => l.id === v) ? (v as Level) : "street";
  });
  const [selected, setSelected] = useState<Marker | null>(null);
  const [focus, setFocus] = useState<string | null>(null); // layer whose description is shown
  const [jump, setJump] = useState<{ key: string; n: number } | null>(null);
  const c = useClock();
  const live = c.running || c.t > 0;

  useEffect(() => save(LAYERS_KEY, [...on]), [on]);
  useEffect(() => save(LEVEL_KEY, level), [level]);

  const toggle = (id: string) => {
    setFocus(id);
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  // Only changes when a spawn time is crossed, so the (memoised) map doesn't redraw every clock tick.
  const pendingKey = live
    ? timeline.events
        .filter((e) => c.t < e.at)
        .map((e) => e.id)
        .join()
    : "";
  const isPending = useMemo(() => {
    const ids = new Set(pendingKey.split(","));
    return (m: Marker) => m.spawn != null && ids.has(m.spawn);
  }, [pendingKey]);

  // Next occurrence of each map event (repeating ones like the Urn included).
  const tNow = Math.floor(c.t);
  const next = useMemo(
    () =>
      upcoming(tNow, c.bossKills)
        .filter((u) => EVENT_LAYER.has(u.ev.id))
        .map((u) => ({ ...u, layer: EVENT_LAYER.get(u.ev.id)! })),
    [tNow, c.bossKills],
  );
  const soonKey = live
    ? [...new Set(next.filter((u) => u.at - c.t <= SOON).map((u) => u.ev.id))].join()
    : "";
  const isSoon = useMemo(() => {
    const ids = new Set(soonKey.split(","));
    return (m: Marker) => m.spawn != null && ids.has(m.spawn);
  }, [soonKey]);

  const showLayer = useCallback((id: string) => {
    setOn((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    setFocus(id);
    setSelected(null);
  }, []);
  const jumpTo = useCallback((m: Marker) => {
    setOn((prev) => (prev.has(m.layer) ? prev : new Set(prev).add(m.layer)));
    setSelected(m);
    setJump((j) => ({ key: m.key, n: (j?.n ?? 0) + 1 }));
  }, []);

  const shownLayer = mapGuide.layers.find((l) => l.id === (selected?.layer ?? focus));

  return (
    <>
      <TabHeader
        title="Map & Objectives"
        eyebrow="Know where to go"
        subtitle="The current map with toggleable layers. Click a marker for details. Zoom with Ctrl + scroll, double-click or the + / − buttons, and drag to pan. With the match timer running, things that haven't spawned yet are dimmed and things about to spawn glow."
        contentAsOf={mapGuide.asOfPatch}
      />

      <div className="map-layout">
        <section className="map-stage">
          <div className="map-toolbar">
            <div className="seg" role="tablist" aria-label="Map level">
              {LEVELS.map((l) => (
                <button key={l.id} className="seg-btn" role="tab" aria-selected={level === l.id} onClick={() => setLevel(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
            <MapSearch onMarker={jumpTo} onLayer={showLayer} />
            {live && (
              <span className={`map-live ${c.running ? "running" : ""}`}>
                <span className="live-dot" /> Match clock {fmtClock(c.t)}
              </span>
            )}
          </div>
          <MapCanvas on={on} level={level} selected={selected} onSelect={setSelected} isPending={isPending} isSoon={isSoon} jump={jump} />
          <MapLegend />
        </section>

        <aside className="map-side">
          <Card className="static map-info" title={shownLayer ? <LayerTitle l={shownLayer} /> : "How to read the map"}>
            {shownLayer ? (
              <LayerInfo l={shownLayer} marker={selected} t={c.t} live={live} />
            ) : (
              <ul className="map-howto">
                <li>Amber is the south team, sapphire the north team. Each base sends 3 lanes towards the other.</li>
                <li>Toggle layers below; your choice is remembered. Press / to search for a spot.</li>
                <li>Zoom with Ctrl + scroll or double-click; a normal scroll just scrolls the page.</li>
                <li>Switch to the tunnel views to see what's underground.</li>
              </ul>
            )}
          </Card>

          <UpNext items={next.slice(0, 3)} t={c.t} live={live} onPick={showLayer} />

          <div className="map-presets">
            <button className="chip" onClick={() => setOn(new Set(DEFAULT_ON))}>
              Beginner view
            </button>
            <button className="chip" onClick={() => setOn(new Set(ALL))}>
              Show all
            </button>
            <button className="chip clear" onClick={() => setOn(new Set())}>
              Hide all
            </button>
          </div>

          {mapGuide.groups.map((g, gi) => (
            <div key={g.id} className="layer-group">
              <h3 className="fp-label">{g.label}</h3>
              <div className="layer-list">
                {mapGuide.layers
                  .filter((l) => l.group === g.id)
                  .map((l, i) => {
                    const at = layerSpawn(l.id);
                    const wait = live && at != null && c.t < at ? at - c.t : null;
                    return (
                      <button
                        key={l.id}
                        className="layer-btn"
                        aria-pressed={on.has(l.id)}
                        onClick={() => toggle(l.id)}
                        style={{ "--lc": l.color, "--i": gi * 4 + i } as CSSProperties}
                      >
                        <span className="lb-icon">{l.icon}</span>
                        <span className="lb-name">{l.label}</span>
                        {at != null && <span className={`lb-time ${wait != null ? "wait" : ""}`}>{wait != null ? `in ${fmtClock(wait)}` : fmtClock(at)}</span>}
                        <span className="lb-count">{countByLayer[l.id] ?? 0}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </aside>
      </div>

      <Card className="static map-notes" title="Notes on this map">
        <ul className="flag-list">
          {mapGuide.flags.map((f) => (
            <li key={f}>
              <Flag>{f}</Flag>
            </li>
          ))}
        </ul>
        <SourceList sources={[...mapGuide.sources, ...timeline.sources.filter((s) => !mapGuide.sources.some((m) => m.url === s.url))]} />
      </Card>
    </>
  );
}

function LayerTitle({ l }: { l: MapLayerDef }) {
  return (
    <span className="li-title" style={{ "--lc": l.color } as CSSProperties}>
      <span className="lb-icon">{l.icon}</span> {l.label}
    </span>
  );
}

function LayerInfo({ l, marker, t, live }: { l: MapLayerDef; marker: Marker | null; t: number; live: boolean }) {
  const events = (mapGuide.spawns[l.id] ?? []).map((id) => timeline.events.find((e) => e.id === id)).filter((e) => e != null);
  const mine = marker?.spawn ? events.filter((e) => e.id === marker.spawn) : events;
  return (
    <div className="li-body" key={marker?.key ?? l.id}>
      {marker && <p className="li-marker">{marker.name}</p>}
      <p>{l.text}</p>
      {mine.length > 0 && (
        <ul className="li-spawns">
          {mine.map((e) => {
            const wait = live && t < e.at ? e.at - t : null;
            return (
              <li key={e.id}>
                <b>{fmtClock(e.at)}</b> {e.name}
                {e.every ? <span className="muted"> · then every {fmtClock(e.every)}</span> : null}
                {wait != null && <span className="li-wait"> · in {fmtClock(wait)}</span>}
                {(e.flag || e.approx) && <Flag>timing unverified</Flag>}
              </li>
            );
          })}
        </ul>
      )}
      {l.flag && <Flag>Positions or labels for this layer are partly inferred — see notes below.</Flag>}
    </div>
  );
}
