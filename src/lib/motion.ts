import { useCallback, useEffect, useState } from "react";

const KEY = "dla.motion";

/** Motion on/off. Defaults to the OS "reduce motion" preference; remembered per browser. */
export function useMotionPref(): [boolean, () => void] {
  const [on, setOn] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved !== null) return saved === "on";
    } catch {
      /* storage unavailable */
    }
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    document.documentElement.dataset.motion = on ? "on" : "off";
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      /* ignore */
    }
  }, [on]);

  return [on, useCallback(() => setOn((v) => !v), [])];
}
