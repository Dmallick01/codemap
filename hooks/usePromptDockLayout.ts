"use client";

import { useMemo } from "react";

/** Bottom explorer chrome (bundle + specimen + toolbar) when panels open */
export const MAP_CHROME_DOCK_PX = 220;

/** Collapsed prompt bar height after compact layout (~2 rows) */
export const PROMPT_DOCK_COLLAPSED_PX = 76;

/** Expanded prompt panel max footprint on the map */
export const PROMPT_DOCK_EXPANDED_PX = 340;

export function usePromptDockLayout(
  expanded: boolean,
  chromeOpen: boolean,
  chromeDockPx: number = MAP_CHROME_DOCK_PX,
) {
  return useMemo(() => {
    const chromePx = chromeOpen ? chromeDockPx : 0;
    const promptPx = expanded ? PROMPT_DOCK_EXPANDED_PX : PROMPT_DOCK_COLLAPSED_PX;
    const reservePx = chromePx + promptPx;
    return {
      chromePx,
      promptPx,
      reservePx,
      promptBottomPx: chromePx,
    };
  }, [expanded, chromeOpen, chromeDockPx]);
}
