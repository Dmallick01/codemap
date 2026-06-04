"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = (repoId: string) => `codemap-quickstart-${repoId}`;

type Props = {
  repoId: string;
  variant: "map" | "ui";
};

export default function MapQuickStartBanner({ repoId, variant }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY(repoId)) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [repoId]);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY(repoId), "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 max-w-md w-[calc(100%-2rem)] panel-blueprint px-3 py-2.5 pointer-events-auto"
      role="status"
    >
      <p className="panel-label mb-1">{variant === "ui" ? "UI Studio" : "Architecture map"} · quick start</p>
      <ul className="text-[10px] space-y-0.5" style={{ color: "var(--text-secondary)" }}>
        <li>
          <kbd className="font-mono" style={{ color: "var(--accent)" }}>G</kbd> Prompts ·{" "}
          <kbd className="font-mono" style={{ color: "var(--accent)" }}>S</kbd> Security · Export in HUD
        </li>
        <li>
          Prompts: build UI, subsystem (agents/LLM), or <strong>explain this GitHub</strong> (wiki + improvements)
        </li>
        <li>
          <kbd className="font-mono" style={{ color: "var(--accent)" }}>L</kbd> GitHub Lab ·{" "}
          <kbd className="font-mono" style={{ color: "var(--accent)" }}>N</kbd>/<kbd className="font-mono" style={{ color: "var(--accent)" }}>P</kbd> tour files
          {variant === "map" && (
            <>
              {" "}
              · <kbd className="font-mono" style={{ color: "var(--accent)" }}>?</kbd> panels
            </>
          )}
          {variant === "ui" && (
            <>
              {" "}
              · <kbd className="font-mono" style={{ color: "var(--accent)" }}>E</kbd> export DESIGN.md
            </>
          )}
        </li>
      </ul>
      <button type="button" onClick={dismiss} className="btn-blueprint mt-2 text-[10px]">
        Got it
      </button>
    </div>
  );
}
