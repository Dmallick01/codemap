"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/** Breathing room between map canvas bottom and the top of stacked docks */
export const MAP_CANVAS_DOCK_GAP_PX = 8;

/** Fallback when ref not mounted yet */
export const PROMPT_DOCK_FALLBACK_COLLAPSED_PX = 88;
export const PROMPT_DOCK_FALLBACK_EXPANDED_PX = 320;
export const CHROME_DOCK_FALLBACK_PX = 220;
export const UI_CHROME_DOCK_FALLBACK_PX = 52;

export type MapDockHeights = {
  promptPx: number;
  chromePx: number;
  reservePx: number;
  promptBottomPx: number;
};

function readHeight(el: HTMLElement | null, fallback: number): number {
  if (!el) return fallback;
  const h = el.getBoundingClientRect().height;
  return h > 0 ? Math.ceil(h) : fallback;
}

export function useMeasuredMapDock(
  promptRef: RefObject<HTMLElement | null>,
  chromeRef: RefObject<HTMLElement | null>,
  options: {
    chromeOpen: boolean;
    promptExpanded: boolean;
    chromeFallbackPx?: number;
  },
): MapDockHeights {
  const {
    chromeOpen,
    promptExpanded,
    chromeFallbackPx = CHROME_DOCK_FALLBACK_PX,
  } = options;

  const promptFallback = promptExpanded
    ? PROMPT_DOCK_FALLBACK_EXPANDED_PX
    : PROMPT_DOCK_FALLBACK_COLLAPSED_PX;

  const [heights, setHeights] = useState<MapDockHeights>(() => ({
    promptPx: promptFallback,
    chromePx: chromeOpen ? chromeFallbackPx : 0,
    reservePx:
      promptFallback +
      (chromeOpen ? chromeFallbackPx : 0) +
      MAP_CANVAS_DOCK_GAP_PX,
    promptBottomPx: chromeOpen ? chromeFallbackPx : 0,
  }));

  useLayoutEffect(() => {
    const measure = () => {
      const promptPx = readHeight(promptRef.current, promptFallback);
      const chromePx = chromeOpen
        ? readHeight(chromeRef.current, chromeFallbackPx)
        : 0;
      const reservePx = promptPx + chromePx + MAP_CANVAS_DOCK_GAP_PX;
      setHeights({
        promptPx,
        chromePx,
        reservePx,
        promptBottomPx: chromePx,
      });
    };

    measure();

    const ro = new ResizeObserver(measure);
    if (promptRef.current) ro.observe(promptRef.current);
    if (chromeRef.current) ro.observe(chromeRef.current);
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [
    promptRef,
    chromeRef,
    chromeOpen,
    promptExpanded,
    promptFallback,
    chromeFallbackPx,
  ]);

  return heights;
}
