"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RepoComparePanel from "@/components/RepoComparePanel";

type Repo = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  url: string | null;
  mode?: string;
  fileCount?: number;
};

function LibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [leftId, setLeftId] = useState(searchParams.get("left") ?? "");
  const [rightId, setRightId] = useState(searchParams.get("right") ?? "");
  const [compareOpen, setCompareOpen] = useState(
    !!(searchParams.get("left") && searchParams.get("right")),
  );

  useEffect(() => {
    fetch("/api/repos?limit=50")
      .then((r) => r.json())
      .then((data) => setRepos(data.repos || []))
      .catch(() => setRepos([]))
      .finally(() => setLoading(false));
  }, []);

  const ready = repos.filter((r) => r.status === "done");

  const syncUrl = useCallback(
    (l: string, r: string) => {
      const params = new URLSearchParams();
      if (l) params.set("left", l);
      if (r) params.set("right", r);
      const q = params.toString();
      router.replace(q ? `/library?${q}` : "/library", { scroll: false });
    },
    [router],
  );

  function runCompare() {
    if (!leftId || !rightId || leftId === rightId) return;
    setCompareOpen(true);
    syncUrl(leftId, rightId);
  }

  const selectClass =
    "flex-1 text-xs rounded px-3 py-2 font-mono outline-none border";
  const selectStyle = {
    background: "var(--bg-elevated)",
    borderColor: "var(--border-default)",
    color: "var(--text-primary)",
  };

  return (
    <main
      className="blueprint-grid min-h-[calc(100vh-var(--header-h))]"
      style={{ color: "var(--text-primary)" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-12">
        <p className="panel-label mb-2">Saved maps</p>
        <h1 className="text-2xl font-bold mb-2">Repo library</h1>
        <p className="text-sm mb-8 max-w-2xl" style={{ color: "var(--text-secondary)" }}>
          Revisit mapped repos, compare two architectures side-by-side, and export
          selective capability bundles from any tour.
        </p>

        <section className="panel-blueprint p-5 mb-12">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            Compare two repos
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <select
              value={leftId}
              onChange={(e) => setLeftId(e.target.value)}
              className={selectClass}
              style={selectStyle}
            >
              <option value="">Repository A…</option>
              {ready.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.mode ?? "lite"}, {r.fileCount ?? "?"} files)
                </option>
              ))}
            </select>
            <select
              value={rightId}
              onChange={(e) => setRightId(e.target.value)}
              className={selectClass}
              style={selectStyle}
            >
              <option value="">Repository B…</option>
              {ready.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.mode ?? "lite"}, {r.fileCount ?? "?"} files)
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={runCompare}
              disabled={!leftId || !rightId || leftId === rightId || loading}
              className="btn-blueprint-primary shrink-0 px-4 py-2 disabled:opacity-40"
            >
              Compare
            </button>
          </div>

          {compareOpen && leftId && rightId && leftId !== rightId && (
            <RepoComparePanel leftId={leftId} rightId={rightId} />
          )}
        </section>

        <p className="panel-label mb-3">All mapped repos</p>

        {loading && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading mapped repositories…
          </p>
        )}

        {!loading && ready.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No completed maps yet.{" "}
            <Link href="/" style={{ color: "var(--accent)" }}>
              Map your first repo
            </Link>
            .
          </p>
        )}

        <ul className="space-y-3">
          {ready.map((repo) => (
            <li key={repo.id}>
              <div className="panel-blueprint px-4 py-3 flex flex-wrap items-center gap-2 hover:border-[var(--border-strong)] transition-colors">
                <Link href={`/analyze/${repo.id}`} className="flex-1 min-w-0">
                  <p className="font-medium">{repo.name}</p>
                  {repo.url && (
                    <p
                      className="text-[11px] font-mono truncate mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {repo.url}
                    </p>
                  )}
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {repo.fileCount ?? "—"} anchors ·{" "}
                    <span
                      style={{
                        color:
                          repo.mode === "deep"
                            ? "var(--role-core)"
                            : "var(--role-api)",
                      }}
                    >
                      {repo.mode ?? "lite"}
                    </span>
                    {" · "}
                    {new Date(repo.createdAt).toLocaleDateString()}
                  </p>
                </Link>
                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/analyze/${repo.id}`}
                    className="btn-blueprint"
                    title="Open map — press G for prompt generator"
                  >
                    Prompts
                  </Link>
                  <Link
                    href={`/analyze/${repo.id}/ui`}
                    className="btn-blueprint"
                  >
                    UI Studio
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setLeftId(repo.id);
                      if (rightId === repo.id) setRightId("");
                    }}
                    className="btn-blueprint"
                  >
                    Compare A
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRightId(repo.id);
                      if (leftId === repo.id) setLeftId("");
                    }}
                    className="btn-blueprint"
                  >
                    Compare B
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {!loading && repos.length > ready.length && (
          <p className="text-xs mt-6" style={{ color: "var(--text-muted)" }}>
            {repos.length - ready.length} repo(s) still processing or failed.
          </p>
        )}
      </div>
    </main>
  );
}

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <main
          className="blueprint-grid min-h-[calc(100vh-var(--header-h))] px-6 py-12"
          style={{ color: "var(--text-muted)" }}
        >
          <p className="text-sm">Loading library…</p>
        </main>
      }
    >
      <LibraryContent />
    </Suspense>
  );
}
