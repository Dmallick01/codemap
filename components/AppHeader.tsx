"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

function analyzeRepoId(pathname: string): string | null {
  const m = pathname.match(/^\/analyze\/([^/]+)/);
  return m?.[1] ?? null;
}

export default function AppHeader() {
  const pathname = usePathname() ?? "/";
  const repoId = analyzeRepoId(pathname);
  const isUiStudio = pathname.endsWith("/ui");
  const isAnalyze = !!repoId && !isUiStudio;
  const isLibrary = pathname.startsWith("/library");
  const isHome = pathname === "/";

  return (
    <header
      className="flex-none flex items-center gap-4 px-4 z-40 border-b"
      style={{
        height: "var(--header-h)",
        background: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <Link
        href="/"
        className="text-sm font-bold tracking-tight shrink-0"
        style={{ color: "var(--text-primary)" }}
      >
        Code<span style={{ color: "var(--accent)" }}>Map</span>
      </Link>

      <nav className="flex items-center gap-1 flex-wrap">
        <Link
          href="/"
          className={`nav-tab ${isHome ? "nav-tab-active" : ""}`}
        >
          Map
        </Link>

        {repoId && (
          <>
            <span className="text-[10px] px-0.5" style={{ color: "var(--text-muted)" }}>
              /
            </span>
            <Link
              href={`/analyze/${repoId}`}
              className={`nav-tab ${isAnalyze ? "nav-tab-active" : ""}`}
            >
              Architecture
            </Link>
            <Link
              href={`/analyze/${repoId}/ui`}
              className={`nav-tab ${isUiStudio ? "nav-tab-active" : ""}`}
            >
              UI Studio
            </Link>
          </>
        )}

        <Link
          href="/library"
          className={`nav-tab ${isLibrary ? "nav-tab-active" : ""}`}
        >
          Library
        </Link>
      </nav>

      <div className="flex-1" />

      {(isAnalyze || isUiStudio) && repoId && (
        <span
          className="hidden sm:inline text-[9px] font-mono px-2 py-0.5 rounded border"
          style={{
            color: "var(--accent)",
            borderColor: "var(--border-default)",
            background: "var(--accent-dim)",
          }}
        >
          {isUiStudio ? "E export · S security · L lab" : "⌬ Lab · L · Security"}
        </span>
      )}

      <ThemeToggle />

      <a
        href="https://github.com/Dmallick01/codemap"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        style={{ color: "var(--text-secondary)" }}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden>
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.091-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
      </a>
    </header>
  );
}
