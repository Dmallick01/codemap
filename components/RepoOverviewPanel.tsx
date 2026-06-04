"use client";

export type RepoOverviewMeta = {
  lite?: boolean;
  description?: string | null;
  readmePreview?: string | null;
  summary?: string;
  language?: string | null;
  stars?: number;
  totalPaths?: number;
  anchorCount?: number;
  topFolders?: { key: string; count: number }[];
};

export default function RepoOverviewPanel({
  repoName,
  overview,
  mode,
}: {
  repoName: string;
  overview: RepoOverviewMeta | null;
  mode?: string;
}) {
  if (!overview) return null;

  return (
    <div className="panel-blueprint p-4 pointer-events-auto">
      <p className="panel-label mb-1">
        {mode === "lite" || overview.lite ? "CodeMap Lite" : "Project overview"}
      </p>
      <h2
        className="text-sm font-semibold mb-1 truncate"
        style={{ color: "var(--text-primary)" }}
      >
        {repoName}
      </h2>
      {overview.language && (
        <p className="text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>
          Primary language: {overview.language}
          {overview.stars != null && ` · ★ ${overview.stars}`}
          {overview.totalPaths != null &&
            ` · ${overview.totalPaths} paths scanned`}
        </p>
      )}
      <p
        className="text-[11px] leading-relaxed line-clamp-5"
        style={{ color: "var(--text-secondary)" }}
      >
        {overview.summary ?? overview.description ?? "Exploring repository structure."}
      </p>
      {overview.topFolders && overview.topFolders.length > 0 && (
        <div
          className="mt-3 pt-2 border-t"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <p className="panel-label mb-1">Main folders</p>
          <div className="flex flex-wrap gap-1">
            {overview.topFolders.map((f) => (
              <span
                key={f.key}
                className="text-[9px] px-1.5 py-0.5 rounded font-mono border"
                style={{
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-muted)",
                  background: "var(--accent-dim)",
                }}
              >
                {f.key} ({f.count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
