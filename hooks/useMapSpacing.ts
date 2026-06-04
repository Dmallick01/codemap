"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_MAP_SPACING_SCALE,
  clampSpacingScaleState,
  resolveMapSpacing,
  type MapSpacingScale,
} from "@/lib/graph/map-spacing";

const STORAGE_KEY = "codemap-map-spacing";

function readStored(): MapSpacingScale {
  if (typeof window === "undefined") return DEFAULT_MAP_SPACING_SCALE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MAP_SPACING_SCALE;
    const parsed = JSON.parse(raw) as Partial<MapSpacingScale>;
    return clampSpacingScaleState({
      row: typeof parsed.row === "number" ? parsed.row : 1,
      group: typeof parsed.group === "number" ? parsed.group : 1,
      column: typeof parsed.column === "number" ? parsed.column : 1,
    });
  } catch {
    return DEFAULT_MAP_SPACING_SCALE;
  }
}

export function useMapSpacing() {
  const [scale, setScaleState] = useState<MapSpacingScale>(DEFAULT_MAP_SPACING_SCALE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setScaleState(readStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scale));
    } catch {
      /* ignore quota */
    }
  }, [scale, hydrated]);

  const setScale = useCallback((patch: Partial<MapSpacingScale>) => {
    setScaleState((prev) => clampSpacingScaleState({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setScaleState(DEFAULT_MAP_SPACING_SCALE);
  }, []);

  const resolved = useMemo(() => resolveMapSpacing(scale), [scale]);

  return { scale, setScale, reset, resolved, hydrated };
}
