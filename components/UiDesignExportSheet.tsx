"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  buildUiDesignPrompt,
  type UiDesignExportInput,
} from "@/lib/export/ui-design-prompt";
import type { FetchedFile } from "@/lib/services/github-contents";
import { downloadMarkdown, exportFilename } from "@/lib/export/download-markdown";
import type { FileNodeData } from "@/lib/store/graph";

type Props = {
  open: boolean;
  onClose: () => void;
  repoId: string;
  repoName: string;
  input: Omit<
    UiDesignExportInput,
    "targetProject" | "targetStack" | "designNotes" | "sourceFiles"
  > | null;
};

export default function UiDesignExportSheet({
  open,
  onClose,
  repoId,
  repoName,
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

  useEffect(() => {
    if (!open) {
      setSourceFiles(undefined);
      setAttachSources(false);
      setFetchError("");
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

  const prompt = useMemo(() => {
    if (!input) return "";
    return buildUiDesignPrompt({
      ...input,
      targetProject: targetProject.trim() || undefined,
      targetStack: targetStack.trim() || undefined,
      designNotes: designNotes.trim() || undefined,
      sourceFiles: attachSources ? sourceFiles : undefined,
    });
  }, [
    input,
    targetProject,
    targetStack,
    designNotes,
    attachSources,
    sourceFiles,
  ]);

  const handleCopy = useCallback(async () => {
    if (!prompt || loadingSources) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [prompt, loadingSources]);

  const handleDownload = useCallback(() => {
    if (!prompt || loadingSources) return;
    downloadMarkdown(
      exportFilename(repoName, input?.selectedNodeIds.length || 1).replace(
        "codemap-",
        "codemap-ui-",
      ),
      prompt,
    );
  }, [prompt, loadingSources, repoName, input?.selectedNodeIds.length]);

  if (!open || !input) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 sheet-overlay"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-3xl max-h-[90vh] flex flex-col sheet-panel rounded-t-xl sm:rounded-xl shadow-2xl">
        <div
          className="flex-none px-4 py-3 border-b"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            Copy UI design prompt
          </h2>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            Recreate screens & components in your target app
          </p>
        </div>

        <div
          className="flex-none px-4 py-2 space-y-2 border-b"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="panel-label">Target app</span>
              <input
                value={targetProject}
                onChange={(e) => setTargetProject(e.target.value)}
                className="mt-1 w-full text-xs sheet-input rounded px-2 py-1.5"
                placeholder="my-app"
              />
            </label>
            <label className="block">
              <span className="panel-label">Design stack</span>
              <input
                value={targetStack}
                onChange={(e) => setTargetStack(e.target.value)}
                className="mt-1 w-full text-xs sheet-input rounded px-2 py-1.5"
                placeholder="Tailwind, shadcn…"
              />
            </label>
          </div>
          <label className="block">
            <span className="panel-label">Design notes (optional)</span>
            <input
              value={designNotes}
              onChange={(e) => setDesignNotes(e.target.value)}
              className="mt-1 w-full text-xs sheet-input rounded px-2 py-1.5"
              placeholder="e.g. dark mode, minimal, B2B dashboard"
            />
          </label>
          <label
            className="flex items-center gap-2 text-[11px]"
            style={{ color: "var(--text-secondary)" }}
          >
            <input
              type="checkbox"
              checked={attachSources}
              onChange={(e) => setAttachSources(e.target.checked)}
            />
            Attach UI source (TSX/CSS from DB or GitHub)
          </label>
          {loadingSources && (
            <p className="text-[10px]" style={{ color: "var(--accent)" }}>
              Loading UI sources…
            </p>
          )}
          {fetchError && (
            <p className="text-[10px]" style={{ color: "var(--error)" }}>
              {fetchError}
            </p>
          )}
        </div>

        <textarea
          readOnly
          value={prompt}
          className="flex-1 min-h-[200px] m-4 text-[11px] font-mono sheet-textarea rounded-lg p-3 resize-none"
        />

        <div className="flex-none px-4 pb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={loadingSources}
            className="flex-1 min-w-[100px] btn-blueprint-primary py-2 disabled:opacity-50"
          >
            {copied ? "Copied" : "Copy UI prompt"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loadingSources || !prompt}
            className="flex-1 min-w-[100px] btn-blueprint py-2 disabled:opacity-50"
          >
            Download .md
          </button>
          <button type="button" onClick={onClose} className="px-4 btn-blueprint py-2">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
