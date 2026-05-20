"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Repo {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  url: string | null;
  latestJobId: string | null;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [reposError, setReposError] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/repos")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load repositories");
        return r.json();
      })
      .then((data) => setRepos(data.repos || []))
      .catch(() => setReposError("Could not load recent repositories."))
      .finally(() => setReposLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      router.push(`/processing/${data.jobId}`);
    } catch {
      setError("Failed to connect to server");
      setLoading(false);
    }
  }

  const statusColor: Record<string, string> = {
    pending: "text-yellow-400",
    processing: "text-blue-400",
    done: "text-emerald-400",
    error: "text-red-400",
  };

  function repoHref(repo: Repo): string | null {
    if (repo.status === "done") return `/analyze/${repo.id}`;
    if (repo.status === "processing" || repo.status === "pending") {
      return repo.latestJobId ? `/processing/${repo.latestJobId}` : null;
    }
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="mx-auto max-w-2xl px-6 py-24">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Code<span className="text-blue-400">Map</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-md mx-auto">
            AI-powered code deconstructor. Paste a GitHub repo URL and get an
            interactive map of its architecture.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mb-16">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              required
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                "Analyze"
              )}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          )}
        </form>

        {/* Recent repos */}
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Recent Repositories
          </h2>

          {reposError && (
            <p className="text-xs text-red-400 mb-3">{reposError}</p>
          )}

          {!reposLoading && !reposError && repos.length === 0 && (
            <p className="text-sm text-gray-600 italic">
              No repositories analyzed yet. Paste a GitHub URL above to get started.
            </p>
          )}

          {repos.length > 0 && (
            <div className="space-y-2">
              {repos.map((repo) => {
                const href = repoHref(repo);
                const isError = repo.status === "error";

                const inner = (
                  <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-3 hover:border-gray-700 hover:bg-gray-800/50 transition-colors">
                    <div>
                      <p className="font-medium text-gray-200">{repo.name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(repo.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium capitalize ${statusColor[repo.status] || "text-gray-400"}`}
                      >
                        {repo.status}
                      </span>
                      {isError && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setUrl(repo.url ?? "");
                          }}
                          className="text-[10px] px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                );

                if (href) {
                  return (
                    <Link key={repo.id} href={href}>
                      {inner}
                    </Link>
                  );
                }

                return (
                  <div key={repo.id} className="cursor-default">
                    {inner}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
