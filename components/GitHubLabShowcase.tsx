"use client";

import {
  LAB_TOOL_REGISTRY,
  LAB_CATEGORY_LABELS,
  type LabToolCategory,
} from "@/lib/github/lab-tool-registry";

const CATEGORY_ORDER: LabToolCategory[] = [
  "telemetry",
  "topology",
  "forensics",
  "signals",
];

export default function GitHubLabShowcase() {
  return (
    <section className="w-full max-w-3xl mt-14 px-2">
      <div className="text-center mb-6">
        <p className="panel-label mb-2">GitHub Lab</p>
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          20 scientific instruments
        </h2>
        <p className="text-xs mt-2 mx-auto max-w-md" style={{ color: "var(--text-secondary)" }}>
          Live Octokit probes on any mapped repo — commits, languages, CI, blame,
          manifests, rate limits, and more. Open the lab from the architecture map.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CATEGORY_ORDER.map((cat) => {
          const tools = LAB_TOOL_REGISTRY.filter((t) => t.category === cat);
          return (
            <div key={cat} className="feature-card">
              <p className="panel-label mb-2">{LAB_CATEGORY_LABELS[cat]}</p>
              <ul className="space-y-1.5">
                {tools.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start gap-2 text-[10px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <span
                      className="shrink-0 w-5 text-center font-mono"
                      style={{ color: "var(--lab-accent)" }}
                    >
                      {t.icon}
                    </span>
                    <span>
                      <strong style={{ color: "var(--text-primary)" }}>{t.name}</strong>
                      {" — "}
                      {t.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-2 mt-6">
        <span className="stat-pill">Octokit REST</span>
        <span className="stat-pill">Optional GITHUB_TOKEN</span>
        <span className="stat-pill">Map-aware paths</span>
        <span className="stat-pill">Session history</span>
      </div>
    </section>
  );
}
