"use client";

import { useEffect, useState } from "react";
import type { ColorMode } from "@xyflow/react";

/** Keep React Flow minimap/defaults aligned with `data-theme` on <html>. */
export function useCodemapColorMode(): ColorMode {
  const [mode, setMode] = useState<ColorMode>("dark");

  useEffect(() => {
    const read = () => {
      const t = document.documentElement.getAttribute("data-theme");
      setMode(t === "light" ? "light" : "dark");
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  return mode;
}
