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
    <div className="absolute top-4 left-4 z-10 max-w-sm rounded-lg border border-gray-800 bg-gray-950/95 backdrop-blur-sm p-4 shadow-xl">
      <p className="text-[9px] uppercase tracking-widest text-emerald-500/90 font-semibold mb-1">
        {mode === "lite" || overview.lite ? "CodeMap Lite" : "Project overview"}
      </p>
      <h2 className="text-sm font-semibold text-gray-100 mb-1 truncate">
        {repoName}
      </h2>
      {overview.language && (
        <p className="text-[10px] text-gray-500 mb-2">
          Primary language: {overview.language}
          {overview.stars != null && ` · ★ ${overview.stars}`}
          {overview.totalPaths != null &&
            ` · ${overview.totalPaths} paths scanned`}
        </p>
      )}
      <p className="text-[11px] text-gray-300 leading-relaxed line-clamp-5">
        {overview.summary ?? overview.description ?? "Exploring repository structure."}
      </p>
      {overview.topFolders && overview.topFolders.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-800">
          <p className="text-[9px] uppercase tracking-wider text-gray-600 mb-1">
            Main folders
          </p>
          <div className="flex flex-wrap gap-1">
            {overview.topFolders.map((f) => (
              <span
                key={f.key}
                className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono"
              >
                {f.key} ({f.count})
              </span>
            ))}
          </div>
        </div>
      )}
      {(overview.lite || mode === "lite") && (
        <p className="text-[9px] text-gray-600 mt-2">
          Anchor files only — no full download. Use Re-analyze → Deep for code-level imports.
        </p>
      )}
    </div>
  );
}
