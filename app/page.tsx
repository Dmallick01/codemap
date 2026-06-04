"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MapImportExport from "@/components/MapImportExport";
import RoleStrip from "@/components/RoleStrip";
import GitHubLabShowcase from "@/components/GitHubLabShowcase";

const DEMO_REPOS = [
  { label: "Next.js", url: "https://github.com/vercel/next.js" },
  { label: "React", url: "https://github.com/facebook/react" },
  { label: "FastAPI", url: "https://github.com/tiangolo/fastapi" },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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

  return (
    <main
      className="blueprint-grid min-h-[calc(100vh-var(--header-h))] flex flex-col"
      style={{ color: "var(--text-primary)" }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl text-center mb-8">
          <p className="panel-label mb-3">Architecture blueprint</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
            Map any repository
          </h1>
          <p className="text-sm max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
            Full-screen graph. Role-colored layers. Export a portable{" "}
            <code className="font-mono text-[11px]" style={{ color: "var(--text-mono)" }}>
              .codemap.json
            </code>{" "}
            — no per-file database storage.
          </p>
        </div>

        <RoleStrip />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            startIngest(url);
          }}
          className="w-full max-w-xl mt-10"
        >
          <div
            className="panel-blueprint hero-glow-ring p-1 flex flex-col sm:flex-row gap-1"
            style={{ boxShadow: `0 0 40px var(--accent-glow)` }}
          >
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="github.com/owner/repo"
              className="flex-1 bg-transparent px-4 py-3 text-sm font-mono outline-none"
              style={{ color: "var(--text-primary)" }}
              required
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="btn-blueprint-primary shrink-0 m-1 px-6 py-3 disabled:opacity-40"
            >
              {loading ? "Mapping…" : "Open map"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <MapImportExport variant="import" />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              or
            </span>
            {DEMO_REPOS.map((d) => (
              <button
                key={d.url}
                type="button"
                disabled={loading}
                onClick={() => startIngest(d.url)}
                className="btn-blueprint"
              >
                {d.label}
              </button>
            ))}
          </div>

          <p className="text-center mt-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
            Lite = snapshot only ·{" "}
            <button
              type="button"
              disabled={loading || !url.trim()}
              onClick={() => startIngest(url, "deep")}
              className="underline hover:no-underline"
              style={{ color: "var(--text-secondary)" }}
            >
              Deep (legacy DB)
            </button>
          </p>

          {error && (
            <p className="mt-3 text-center text-sm" style={{ color: "#f87171" }}>
              {error}
            </p>
          )}
        </form>

        <p className="mt-8 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          <kbd className="px-1 rounded border" style={{ borderColor: "var(--border-default)" }}>?</kbd> panels ·{" "}
          <kbd className="px-1 rounded border" style={{ borderColor: "var(--border-default)" }}>L</kbd> GitHub Lab ·{" "}
          <kbd className="px-1 rounded border" style={{ borderColor: "var(--border-default)" }}>N</kbd> /{" "}
          <kbd className="px-1 rounded border" style={{ borderColor: "var(--border-default)" }}>P</kbd> tour
        </p>

        <GitHubLabShowcase />
      </div>
    </main>
  );
}
