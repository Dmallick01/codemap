"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  buildUiDesignPrompt,
  type UiDesignExportInput,
} from "@/lib/export/ui-design-prompt";
import type { FetchedFile } from "@/lib/services/github-contents";
import { downloadMarkdown, exportFilename } from "@/lib/export/download-markdown";
import type { Node } from "@xyflow/react";
import type { FileNodeData } from "@/lib/store/graph";

type Props = {
  open: boolean;
  onClose: () => void;
  repoId: string;
  repoName: string;
  input: Omit<UiDesignExportInput, "targetProject" | "targetStack" | "designNotes" | "sourceFiles"> | null;
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
        className="absolute inset-0 bg-black/70"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-3xl max-h-[90vh] flex flex-col bg-gray-950 border border-sky-800/50 rounded-t-xl sm:rounded-xl shadow-2xl">
        <div className="flex-none px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-sky-200">
            Copy UI design prompt
          </h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Recreate screens & components in your target app
          </p>
        </div>

        <div className="flex-none px-4 py-2 space-y-2 border-b border-gray-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[9px] uppercase text-gray-600">
                Target app
              </span>
              <input
                value={targetProject}
                onChange={(e) => setTargetProject(e.target.value)}
                className="mt-1 w-full text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-200"
                placeholder="my-app"
              />
            </label>
            <label className="block">
              <span className="text-[9px] uppercase text-gray-600">
                Design stack
              </span>
              <input
                value={targetStack}
                onChange={(e) => setTargetStack(e.target.value)}
                className="mt-1 w-full text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-200"
                placeholder="Tailwind, shadcn…"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-[9px] uppercase text-gray-600">
              Design notes (optional)
            </span>
            <input
              value={designNotes}
              onChange={(e) => setDesignNotes(e.target.value)}
              className="mt-1 w-full text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-200"
              placeholder="e.g. dark mode, minimal, B2B dashboard"
            />
          </label>
          <label className="flex items-center gap-2 text-[11px] text-gray-400">
            <input
              type="checkbox"
              checked={attachSources}
              onChange={(e) => setAttachSources(e.target.checked)}
            />
            Attach UI source (TSX/CSS from DB or GitHub)
          </label>
          {loadingSources && (
            <p className="text-[10px] text-sky-400">Loading UI sources…</p>
          )}
          {fetchError && (
            <p className="text-[10px] text-red-400">{fetchError}</p>
          )}
        </div>

        <textarea
          readOnly
          value={prompt}
          className="flex-1 min-h-[200px] m-4 text-[11px] font-mono text-gray-300 bg-gray-900/80 border border-gray-800 rounded-lg p-3 resize-none"
        />

        <div className="flex-none px-4 pb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={loadingSources}
            className="flex-1 min-w-[100px] text-xs py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
          >
            {copied ? "Copied" : "Copy UI prompt"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loadingSources || !prompt}
            className="flex-1 min-w-[100px] text-xs py-2 rounded-lg border border-sky-500/50 text-sky-300 hover:bg-sky-500/10 disabled:opacity-50"
          >
            Download .md
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 text-xs py-2 rounded-lg border border-gray-700 text-gray-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
