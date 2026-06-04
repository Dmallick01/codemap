"use client";

import { PROMPT_MODE_META } from "@/lib/export/repo-prompt-generator";

const MODES = ["build-ui", "build-system", "explain-repo"] as const;

export default function PromptGeneratorShowcase() {
  return (
    <section className="w-full max-w-3xl mt-12 px-2">
      <div className="text-center mb-6">
        <p className="panel-label mb-2">Repo prompt generator</p>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Ask about any GitHub repo in plain English
        </h2>
        <p className="text-[14px] mt-2 mx-auto max-w-lg leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          On every map, use the bottom bar: type what you want (e.g. build a sidebar like this repo), hit{" "}
          <strong>Generate prompt</strong>, then copy into Cursor or Claude. Press{" "}
          <kbd className="px-1.5 py-0.5 rounded border font-mono text-[13px]" style={{ borderColor: "var(--border-default)" }}>G</kbd>{" "}
          to focus the ask field.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {MODES.map((m) => {
          const meta = PROMPT_MODE_META[m];
          return (
            <div key={m} className="feature-card">
              <p className="text-[13px] font-semibold mb-1" style={{ color: "var(--accent)" }}>
                {meta.label}
              </p>
              <p className="text-[14px] font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                {meta.headline}
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {meta.description}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-2 mt-6">
        <span className="stat-pill">Map-anchored paths</span>
        <span className="stat-pill">Explain improvements</span>
        <span className="stat-pill">Agent / LLM systems</span>
        <span className="stat-pill">Download .md</span>
      </div>
    </section>
  );
}
