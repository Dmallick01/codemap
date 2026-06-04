"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Repo = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  url: string | null;
};

export default function LibraryPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/repos?limit=50")
      .then((r) => r.json())
      .then((data) => setRepos(data.repos || []))
      .catch(() => setRepos([]))
      .finally(() => setLoading(false));
  }, []);

  const ready = repos.filter((r) => r.status === "done");

  return (
    <main className="min-h-[calc(100vh-3rem)] bg-gray-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/"
          className="text-xs text-gray-500 hover:text-gray-300 mb-6 inline-block"
        >
          ← Map a new repo
        </Link>

        <h1 className="text-2xl font-bold mb-2">Repo library</h1>
        <p className="text-sm text-gray-400 mb-8 max-w-xl">
          Repos you have mapped. Open any tour, shift+click files to build an
          export bundle, then copy a repurposing prompt (selective gitingest) for
          your own project.
        </p>

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
              <Link
                href={`/analyze/${repo.id}`}
                className="block rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3 hover:border-violet-500/40 transition-colors"
              >
                <p className="font-medium text-gray-100">{repo.name}</p>
                {repo.url && (
                  <p className="text-[11px] text-gray-500 font-mono truncate mt-0.5">
                    {repo.url}
                  </p>
                )}
                <p className="text-[10px] text-gray-600 mt-1">
                  Mapped {new Date(repo.createdAt).toLocaleDateString()} · Tour
                  & export bundle
                </p>
              </Link>
            </li>
          ))}
        </ul>

        {!loading && repos.length > ready.length && (
          <p className="text-xs text-gray-600 mt-6">
            {repos.length - ready.length} repo(s) still processing or failed —
            open from home when ready.
          </p>
        )}
      </div>
    </main>
  );
}
