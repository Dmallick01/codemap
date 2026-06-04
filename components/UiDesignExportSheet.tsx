"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  buildUiDesignPrompt,
  type UiDesignExportInput,
} from "@/lib/export/ui-design-prompt";
import { buildCombinedUiExport } from "@/lib/export/combined-ui-export";
import type { FetchedFile } from "@/lib/services/github-contents";
import { downloadMarkdown, exportFilename } from "@/lib/export/download-markdown";
import type { FileNodeData } from "@/lib/store/graph";
import type { DesignMdLintResult } from "@/lib/design/validate-design-md";

type ExportMode = "ui" | "design" | "combined";

type Props = {
  open: boolean;
  onClose: () => void;
  repoId: string;
  repoName: string;
  repoUrl: string | null;
  input: Omit<
    UiDesignExportInput,
    "targetProject" | "targetStack" | "designNotes" | "sourceFiles" | "designMd"
  > | null;
};

export default function UiDesignExportSheet({
  open,
  onClose,
  repoId,
  repoName,
  repoUrl,
  input,
}: Props) {
  const [targetProject, setTargetProject] = useState("");
  const [targetStack, setTargetStack] = useState("");
  const [designNotes, setDesignNotes] = useState("");
  const [attachSources, setAttachSources] = useState(false);
  const [sourceFiles, setSourceFiles] = useState<FetchedFile[] | undefined>();
  const [loadingSources, setLoadingSources] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [copied, setCopied] = useState(false);
  const [designMd, setDesignMd] = useState("");
  const [exportMode, setExportMode] = useState<ExportMode>("combined");
  const [extracting, setExtracting] = useState(false);
  const [lintResult, setLintResult] = useState<DesignMdLintResult | null>(null);
  const [linting, setLinting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [loadedOnce, setLoadedOnce] = useState(false);

  const uiPaths = useMemo(() => {
    if (!input) return [];
    const nodes = input.nodes.filter((n) => n.type === "fileNode");
    const selected =
      input.selectedNodeIds.length > 0
        ? nodes.filter((n) => input.selectedNodeIds.includes(n.id))
        : nodes;
    return selected
      .map((n) => (n.data as FileNodeData).path)
      .filter((p): p is string => !!p);
  }, [input]);

  const exportCtx = useMemo((): UiDesignExportInput | null => {
    if (!input) return null;
    return {
      ...input,
      targetProject: targetProject.trim() || undefined,
      targetStack: targetStack.trim() || undefined,
      designNotes: designNotes.trim() || undefined,
      sourceFiles: attachSources ? sourceFiles : undefined,
      designMd: exportMode !== "ui" ? designMd : undefined,
    };
  }, [
    input,
    targetProject,
    targetStack,
    designNotes,
    attachSources,
    sourceFiles,
    designMd,
    exportMode,
  ]);

  const prompt = useMemo(() => {
    if (!exportCtx) return "";
    if (exportMode === "design") return exportCtx.designMd ?? "";
    if (exportMode === "combined") return buildCombinedUiExport(exportCtx);
    return buildUiDesignPrompt(exportCtx);
  }, [exportCtx, exportMode]);

  useEffect(() => {
    if (!open) {
      setSourceFiles(undefined);
      setAttachSources(false);
      setFetchError("");
      setLintResult(null);
    }
  }, [open]);

  useEffect(() => {
    if (!attachSources || !open || !uiPaths.length) {
      setSourceFiles(undefined);
      return;
    }
    let cancelled = false;
    setLoadingSources(true);
    setFetchError("");
    fetch("/api/export/bundle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId, paths: [...new Set(uiPaths)].slice(0, 16) }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Fetch failed");
        if (!cancelled) setSourceFiles(data.files);
      })
      .catch((e: Error) => {
        if (!cancelled) setFetchError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingSources(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attachSources, open, uiPaths, repoId]);

  const runLint = useCallback(async (content?: string) => {
    const body = (content ?? designMd).trim();
    if (!body) return;
    setLinting(true);
    try {
      const res = await fetch("/api/design/lint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: body }),
      });
      const data = await res.json();
      setLintResult(data);
    } catch {
      setLintResult({ ok: false, issues: ["Lint request failed"], warnings: [], metrics: [] });
    } finally {
      setLinting(false);
    }
  }, [designMd]);

  const extractDesignMd = useCallback(async () => {
    setExtracting(true);
    setFetchError("");
    setSaveStatus("");
    try {
      const res = await fetch("/api/design/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId, repoUrl, repoName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extract failed");
      const md = data.designMd ?? "";
      setDesignMd(md);
      setExportMode("combined");
      await runLint(md);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Extract failed");
    } finally {
      setExtracting(false);
    }
  }, [repoId, repoUrl, repoName, runLint]);

  const saveDesignMd = useCallback(
    async (commitToGithub: boolean) => {
      if (!designMd.trim()) return;
      setSaving(true);
      setSaveStatus("");
      try {
        const res = await fetch("/api/design/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoId, designMd, commitToGithub }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Save failed");
        let msg = `Saved to map (${data.bytes} bytes)`;
        if (commitToGithub) {
          msg += data.github?.ok
            ? ` · committed to GitHub`
            : ` · GitHub: ${data.github?.error ?? "skipped"}`;
        }
        setSaveStatus(msg);
      } catch (e) {
        setSaveStatus(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [repoId, designMd],
  );

  useEffect(() => {
    if (!open || loadedOnce) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/design/save?repoId=${encodeURIComponent(repoId)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.designMd?.trim()) {
          setDesignMd(data.designMd);
          setExportMode("combined");
          await runLint(data.designMd);
          setSaveStatus("Loaded saved DESIGN.md");
        } else if (repoUrl) {
          await extractDesignMd();
        }
      } catch {
        if (!cancelled && repoUrl) await extractDesignMd();
      } finally {
        if (!cancelled) setLoadedOnce(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, repoId, repoUrl, loadedOnce, extractDesignMd, runLint]);

  useEffect(() => {
    if (!open) setLoadedOnce(false);
  }, [open]);

  const onImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDesignMd(String(reader.result ?? ""));
      setExportMode("combined");
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleCopy = useCallback(async () => {
    if (!prompt || loadingSources) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [prompt, loadingSources]);

  const handleDownload = useCallback(() => {
    if (!prompt || loadingSources) return;
    const suffix =
      exportMode === "design"
        ? "DESIGN.md"
        : exportMode === "combined"
          ? "ui-bundle.md"
          : exportFilename(repoName, input?.selectedNodeIds.length || 1).replace(
              "codemap-",
              "codemap-ui-",
            );
    downloadMarkdown(suffix.endsWith(".md") ? suffix : `codemap-ui-${repoName}.md`, prompt);
  }, [prompt, loadingSources, repoName, input?.selectedNodeIds.length, exportMode]);

  const downloadDesignMdOnly = useCallback(() => {
    if (!designMd) return;
    downloadMarkdown("DESIGN.md", designMd);
  }, [designMd]);

  if (!open || !input) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 sheet-overlay" aria-label="Close" onClick={onClose} />
      <div className="relative w-full sm:max-w-3xl max-h-[92vh] flex flex-col sheet-panel rounded-t-xl sm:rounded-xl shadow-2xl">
        <div className="flex-none px-4 py-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            UI Studio export
          </h2>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            UI prompt · Google DESIGN.md · combined bundle
          </p>
        </div>

        <div className="flex-none px-4 py-2 space-y-2 border-b overflow-y-auto max-h-[40vh]" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex flex-wrap gap-1">
            {(["ui", "design", "combined"] as ExportMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setExportMode(m)}
                className={`btn-blueprint ${exportMode === m ? "nav-tab-active" : ""}`}
              >
                {m === "ui" ? "UI prompt" : m === "design" ? "DESIGN.md" : "Combined"}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={extractDesignMd} disabled={extracting || !repoUrl} className="btn-blueprint">
              {extracting ? "Extracting…" : "Extract from repo"}
            </button>
            <label className="btn-blueprint cursor-pointer">
              Import DESIGN.md
              <input type="file" accept=".md,text/markdown" className="hidden" onChange={onImportFile} />
            </label>
            <button
              type="button"
              onClick={() => runLint()}
              disabled={linting || !designMd.trim()}
              className="btn-blueprint"
            >
              {linting ? "Linting…" : "Lint DESIGN.md"}
            </button>
            {designMd && (
              <>
                <button
                  type="button"
                  onClick={() => saveDesignMd(false)}
                  disabled={saving}
                  className="btn-blueprint-primary"
                >
                  {saving ? "Saving…" : "Save to map"}
                </button>
                {repoUrl && (
                  <button
                    type="button"
                    onClick={() => saveDesignMd(true)}
                    disabled={saving}
                    className="btn-blueprint"
                    title="Requires GITHUB_TOKEN with repo contents write"
                  >
                    Save + commit GitHub
                  </button>
                )}
                <button type="button" onClick={downloadDesignMdOnly} className="btn-blueprint">
                  Download file
                </button>
              </>
            )}
          </div>
          {saveStatus && (
            <p className="text-[10px]" style={{ color: "var(--accent)" }}>
              {saveStatus}
            </p>
          )}

          {lintResult && (
            <div className="panel-blueprint p-2 text-[10px]">
              <p style={{ color: lintResult.ok ? "var(--accent)" : "var(--error)" }}>
                {lintResult.ok ? "Lint passed" : "Lint issues found"}
              </p>
              {lintResult.issues.map((i) => (
                <p key={i} style={{ color: "var(--error)" }}>
                  · {i}
                </p>
              ))}
              {lintResult.warnings.map((w) => (
                <p key={w} style={{ color: "var(--text-muted)" }}>
                  · {w}
                </p>
              ))}
            </div>
          )}

          {exportMode !== "ui" && (
            <textarea
              value={designMd}
              onChange={(e) => setDesignMd(e.target.value)}
              className="w-full min-h-[120px] text-[10px] font-mono sheet-textarea rounded-lg p-2"
              placeholder="Paste or extract DESIGN.md (Google Labs format)…"
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="panel-label">Target app</span>
              <input value={targetProject} onChange={(e) => setTargetProject(e.target.value)} className="mt-1 w-full text-xs sheet-input rounded px-2 py-1.5" />
            </label>
            <label className="block">
              <span className="panel-label">Design stack</span>
              <input value={targetStack} onChange={(e) => setTargetStack(e.target.value)} className="mt-1 w-full text-xs sheet-input rounded px-2 py-1.5" placeholder="Tailwind, shadcn…" />
            </label>
          </div>
          <label className="block">
            <span className="panel-label">Design notes</span>
            <input value={designNotes} onChange={(e) => setDesignNotes(e.target.value)} className="mt-1 w-full text-xs sheet-input rounded px-2 py-1.5" />
          </label>
          <label className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={attachSources} onChange={(e) => setAttachSources(e.target.checked)} />
            Attach UI source (TSX/CSS)
          </label>
          {fetchError && <p className="text-[10px]" style={{ color: "var(--error)" }}>{fetchError}</p>}
        </div>

        <textarea readOnly value={prompt} className="flex-1 min-h-[160px] m-4 text-[11px] font-mono sheet-textarea rounded-lg p-3 resize-none" />

        <div className="flex-none px-4 pb-4 flex flex-wrap gap-2">
          <button type="button" onClick={handleCopy} disabled={loadingSources} className="flex-1 btn-blueprint-primary py-2 disabled:opacity-50">
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={handleDownload} disabled={loadingSources || !prompt} className="flex-1 btn-blueprint py-2">
            Download
          </button>
          <button type="button" onClick={onClose} className="btn-blueprint py-2 px-4">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
