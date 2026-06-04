"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LAB_TOOL_REGISTRY,
  LAB_CATEGORY_LABELS,
  type LabToolCategory,
  type LabToolDef,
  type LabToolId,
} from "@/lib/github/lab-tool-registry";
import type { LabToolResult } from "@/lib/services/github-lab";
import LabToolResultView from "./LabToolResultView";

type Props = {
  open: boolean;
  onClose: () => void;
  repoId: string;
  repoUrl: string | null;
  repoName: string;
  selectedPath?: string | null;
};

const CATEGORIES: LabToolCategory[] = [
  "telemetry",
  "topology",
  "forensics",
  "signals",
];

export default function GitHubLabDrawer({
  open,
  onClose,
  repoId,
  repoUrl,
  repoName,
  selectedPath,
}: Props) {
  const [category, setCategory] = useState<LabToolCategory>("telemetry");
  const [activeTool, setActiveTool] = useState<LabToolDef | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LabToolResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("function");
  const [history, setHistory] = useState<{ tool: string; at: string }[]>([]);

  const toolsInCategory = useMemo(
    () => LAB_TOOL_REGISTRY.filter((t) => t.category === category),
    [category],
  );

  const canRunGithub = !!repoUrl?.includes("github.com");

  const runTool = useCallback(
    async (tool: LabToolDef) => {
      if (!canRunGithub) return;
      setActiveTool(tool);
      setLoading(true);
      setResult(null);
      try {
        const res = await fetch("/api/github/lab", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoId,
            repoUrl,
            toolId: tool.id,
            path: tool.needsPath ? selectedPath : undefined,
            query: tool.needsQuery ? searchQuery : undefined,
          }),
        });
        const data = (await res.json()) as LabToolResult & { error?: string };
        if (!res.ok) {
          setResult({
            ok: false,
            toolId: tool.id,
            title: tool.name,
            error: data.error ?? "Request failed",
          });
        } else {
          setResult(data);
          setHistory((h) => [
            { tool: tool.short, at: new Date().toLocaleTimeString() },
            ...h.slice(0, 7),
          ]);
        }
      } catch (e) {
        setResult({
          ok: false,
          toolId: tool.id,
          title: tool.name,
          error: e instanceof Error ? e.message : "Network error",
        });
      } finally {
        setLoading(false);
      }
    },
    [canRunGithub, repoId, repoUrl, selectedPath, searchQuery],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 lab-backdrop"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed top-[var(--header-h)] right-0 bottom-0 z-50 lab-drawer flex flex-col w-full max-w-[min(520px,100vw)]"
        role="dialog"
        aria-label="GitHub Lab"
      >
        <header className="lab-drawer-header flex-none px-4 py-3 border-b flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="panel-label">GitHub Lab · 20 instruments</p>
            <h2
              className="text-sm font-bold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {repoName}
            </h2>
            {!canRunGithub && (
              <p className="text-[10px] mt-1" style={{ color: "#fbbf24" }}>
                No GitHub URL — lab tools need a linked repository.
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="btn-blueprint shrink-0">
            Close
          </button>
        </header>

        <div className="flex-none px-3 py-2 flex gap-1 overflow-x-auto border-b" style={{ borderColor: "var(--border-subtle)" }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`nav-tab shrink-0 ${category === c ? "nav-tab-active" : ""}`}
            >
              {LAB_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        {activeTool?.needsQuery && (
          <div className="flex-none px-4 py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <label className="panel-label block mb-1">Search query</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-mono px-3 py-2 rounded border outline-none"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
              placeholder="e.g. useEffect, export async"
            />
          </div>
        )}

        {activeTool?.needsPath && (
          <div
            className="flex-none px-4 py-1.5 text-[10px] font-mono border-b"
            style={{
              borderColor: "var(--border-subtle)",
              color: selectedPath ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            Path: {selectedPath ?? "(select a file node on the map)"}
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <div
            className="flex-none md:w-[200px] md:border-r overflow-y-auto p-2 grid grid-cols-2 md:grid-cols-1 gap-1.5 max-h-[40vh] md:max-h-none"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {toolsInCategory.map((tool) => (
              <button
                key={tool.id}
                type="button"
                disabled={!canRunGithub || loading}
                onClick={() => runTool(tool)}
                className={`lab-tool-card text-left ${activeTool?.id === tool.id ? "lab-tool-card-active" : ""}`}
                title={tool.description}
              >
                <span className="lab-tool-icon">{tool.icon}</span>
                <span className="lab-tool-name">{tool.short}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {!activeTool && (
              <div className="lab-empty-state">
                <p className="text-4xl mb-3 opacity-40">⌬</p>
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Select an instrument
                </p>
                <p className="text-xs mt-2 max-w-xs" style={{ color: "var(--text-muted)" }}>
                  Twenty GitHub API probes for telemetry, topology, forensics, and
                  signals — live against {repoName}.
                </p>
              </div>
            )}
            {loading && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                <span className="lab-spinner" />
                Running {activeTool?.name}…
              </div>
            )}
            {!loading && result && <LabToolResultView result={result} />}
          </div>
        </div>

        {history.length > 0 && (
          <footer
            className="flex-none px-4 py-2 border-t text-[9px] font-mono flex flex-wrap gap-2"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
          >
            <span className="panel-label">Session</span>
            {history.map((h, i) => (
              <span key={i}>
                {h.tool}@{h.at}
              </span>
            ))}
          </footer>
        )}
      </aside>
    </>
  );
}
