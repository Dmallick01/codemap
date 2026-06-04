"use client";

type Props = {
  repoUrl: string | null;
  className?: string;
};

export default function MapCapabilitiesBanner({ repoUrl, className = "" }: Props) {
  if (repoUrl?.includes("github.com")) return null;

  return (
    <div
      className={`panel-blueprint px-3 py-2 text-[10px] pointer-events-auto ${className}`}
      style={{ borderColor: "var(--border-default)" }}
    >
      <p className="font-semibold mb-0.5" style={{ color: "#fbbf24" }}>
        Limited map — no GitHub URL
      </p>
      <p style={{ color: "var(--text-muted)" }}>
        GitHub Lab, DESIGN.md extract, and live security pulls need a linked repo. Re-map
        from a GitHub URL or include <code className="font-mono">url</code> in your{" "}
        <code className="font-mono">.codemap.json</code> import.
      </p>
    </div>
  );
}
