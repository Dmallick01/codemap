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

  return (
    <main className="min-h-[calc(100vh-3rem)] bg-gray-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Link
          href="/"
          className="text-xs text-gray-500 hover:text-gray-300 mb-6 inline-block"
        >
          ← Map a new repo
        </Link>

        <h1 className="text-2xl font-bold mb-2">Repo library</h1>
        <p className="text-sm text-gray-400 mb-8 max-w-2xl">
          Revisit mapped repos, compare two architectures side-by-side, and export
          selective capability bundles from any tour.
        </p>

        <section className="mb-12 rounded-xl border border-gray-800 bg-gray-900/30 p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Compare two repos
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <select
              value={leftId}
              onChange={(e) => setLeftId(e.target.value)}
              className="flex-1 text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-200"
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
              className="flex-1 text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-200"
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
              disabled={
                !leftId || !rightId || leftId === rightId || loading
              }
              className="text-xs font-medium px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 shrink-0"
            >
              Compare
            </button>
          </div>

          {compareOpen && leftId && rightId && leftId !== rightId && (
            <RepoComparePanel leftId={leftId} rightId={rightId} />
          )}
        </section>

        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          All mapped repos
        </h2>

        {loading && (
          <p className="text-sm text-gray-500">Loading mapped repositories…</p>
        )}

        {!loading && ready.length === 0 && (
          <p className="text-sm text-gray-500">
            No completed maps yet.{" "}
            <Link href="/" className="text-blue-400 hover:underline">
              Map your first repo
            </Link>
            .
          </p>
        )}

        <ul className="space-y-3">
          {ready.map((repo) => (
            <li key={repo.id}>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3 hover:border-violet-500/30 transition-colors">
                <Link
                  href={`/analyze/${repo.id}`}
                  className="flex-1 min-w-0"
                >
                  <p className="font-medium text-gray-100">{repo.name}</p>
                  {repo.url && (
                    <p className="text-[11px] text-gray-500 font-mono truncate mt-0.5">
                      {repo.url}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-600 mt-1">
                    {repo.fileCount ?? "—"} anchors ·{" "}
                    <span
                      className={
                        repo.mode === "deep"
                          ? "text-amber-500/80"
                          : "text-emerald-500/80"
                      }
                    >
                      {repo.mode ?? "lite"}
                    </span>
                    {" · "}
                    {new Date(repo.createdAt).toLocaleDateString()}
                  </p>
                </Link>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setLeftId(repo.id);
                      if (rightId === repo.id) setRightId("");
                    }}
                    className="text-[10px] px-2 py-1 rounded border border-gray-700 text-gray-500 hover:text-violet-300"
                  >
                    Compare A
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRightId(repo.id);
                      if (leftId === repo.id) setLeftId("");
                    }}
                    className="text-[10px] px-2 py-1 rounded border border-gray-700 text-gray-500 hover:text-violet-300"
                  >
                    Compare B
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {!loading && repos.length > ready.length && (
          <p className="text-xs text-gray-600 mt-6">
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
        <main className="min-h-[calc(100vh-3rem)] bg-gray-950 text-white px-6 py-12">
          <p className="text-sm text-gray-500">Loading library…</p>
        </main>
      }
    >
      <LibraryContent />
    </Suspense>
  );
}
