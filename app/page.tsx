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

const DEMO_REPOS = [
  { label: "Next.js", url: "https://github.com/vercel/next.js" },
  { label: "React", url: "https://github.com/facebook/react" },
  { label: "FastAPI", url: "https://github.com/tiangolo/fastapi" },
];

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

  async function startIngest(targetUrl: string, mode: "lite" | "deep" = "lite") {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl, mode }),
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await startIngest(url);
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
    <main className="min-h-[calc(100vh-3rem)] bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Code<span className="text-blue-400">Map</span>
          </h1>
          <p className="text-sm text-emerald-400/90 font-medium mb-2">
            CodeMap Lite — seconds, not minutes
          </p>
          <p className="text-lg text-gray-400 max-w-lg mx-auto">
            Paste a GitHub URL to see what the project is, how folders relate,
            and where to start reading. Uses the GitHub API only — no zip
            download, no AI, no full-repo parsing.
          </p>
          <a
            href="https://github.com/Dmallick01/codemap"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 text-sm text-gray-500 hover:text-blue-400 transition-colors"
          >
            View source on GitHub →
          </a>
        </div>

        <form onSubmit={handleSubmit} className="mb-8">
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
              {loading ? "Starting…" : "Map repo"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
            <span>Default: Lite (fast)</span>
            <button
              type="button"
              disabled={loading || !url.trim()}
              onClick={() => startIngest(url, "deep")}
              className="text-gray-400 hover:text-gray-200 underline disabled:opacity-50"
            >
              Deep analysis instead (download + parse)
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </form>

        <div className="mb-10">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Try a public repo
          </p>
          <div className="flex flex-wrap gap-2">
            {DEMO_REPOS.map((d) => (
              <button
                key={d.url}
                type="button"
                disabled={loading}
                onClick={() => {
                  setUrl(d.url);
                  startIngest(d.url);
                }}
                className="text-xs px-3 py-1.5 rounded-full border border-gray-700 text-gray-300 hover:border-blue-500/50 hover:text-blue-300 transition-colors disabled:opacity-50"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 mb-10 text-sm text-gray-400">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
            Explorer workflow
          </h2>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>GitHub returns repo info + file tree (paths only)</li>
            <li>We pick ~30 anchor files (README, routes, main folders)</li>
            <li>Colored map shows roles and how layers connect</li>
            <li>
              Press <kbd className="text-gray-300 px-1">N</kbd> /{" "}
              <kbd className="text-gray-300 px-1">P</kbd> to tour anchor files
            </li>
          </ol>
        </div>

        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Recent repositories
          </h2>
          {reposError && (
            <p className="text-xs text-red-400 mb-3">{reposError}</p>
          )}
          {!reposLoading && !reposError && repos.length === 0 && (
            <p className="text-sm text-gray-600 italic">
              No repositories yet. Paste a URL or pick a demo repo above.
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
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            if (repo.url) startIngest(repo.url);
                          }}
                          className="text-[10px] px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200"
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
