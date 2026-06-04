import Link from "next/link";
import type { RepoStats } from "@/lib/repos/stats";

type Props = {
  stats: RepoStats;
  highlightRoles?: Set<string>;
};

export default function RepoCompareColumn({
  stats,
  highlightRoles,
}: Props) {
  const maxRole = Math.max(1, ...stats.roles.map((r) => r.count));

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 flex flex-col min-h-[280px]">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-100 truncate">{stats.name}</h3>
          {stats.url && (
            <p className="text-[10px] text-gray-500 font-mono truncate mt-0.5">
              {stats.url}
            </p>
          )}
        </div>
        <span
          className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded shrink-0 ${
            stats.mode === "deep"
              ? "bg-amber-500/15 text-amber-400"
              : "bg-emerald-500/15 text-emerald-400"
          }`}
        >
          {stats.mode}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-[11px] mb-4">
        <div>
          <dt className="text-gray-600">Anchors</dt>
          <dd className="text-gray-200 font-medium">{stats.fileCount}</dd>
        </div>
        <div>
          <dt className="text-gray-600">Connections</dt>
          <dd className="text-gray-200 font-medium">{stats.edgeCount}</dd>
        </div>
      </dl>

      {stats.overview?.readmePreview && (
        <p className="text-[11px] text-gray-400 line-clamp-3 mb-3 leading-relaxed">
          {stats.overview.readmePreview}
        </p>
      )}

      <p className="text-[9px] uppercase tracking-wider text-gray-600 mb-2">
        Architecture layers
      </p>
      <ul className="space-y-1.5 flex-1">
        {stats.roles.map((r) => {
          const emphasized = highlightRoles?.has(r.role);
          return (
            <li key={r.role} className="flex items-center gap-2">
              <span
                className="text-[10px] w-20 truncate shrink-0"
                style={{ color: r.color }}
              >
                {r.label}
              </span>
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(r.count / maxRole) * 100}%`,
                    background: r.color,
                    opacity: emphasized ? 1 : 0.55,
                  }}
                />
              </div>
              <span className="text-[10px] text-gray-500 w-4 text-right">
                {r.count}
              </span>
            </li>
          );
        })}
      </ul>

      {stats.overview?.topFolders && stats.overview.topFolders.length > 0 && (
        <p className="text-[10px] text-gray-600 mt-3 truncate">
          Top:{" "}
          {stats.overview.topFolders
            .slice(0, 3)
            .map((f) => f.key)
            .join(", ")}
        </p>
      )}

      <Link
        href={`/analyze/${stats.repoId}`}
        className="mt-4 text-center text-xs py-2 rounded-lg border border-violet-500/40 text-violet-300 hover:bg-violet-500/10 transition-colors"
      >
        Open tour →
      </Link>
    </div>
  );
}
