"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  buildRepurposePrompt,
  buildBundlePrompt,
  type RepurposeExportContext,
  type BundleExportContext,
} from "@/lib/export/repurpose-prompt";
import type { FetchedFile } from "@/lib/services/github-contents";
import { resolveBundlePaths } from "@/lib/export/bundle";

type BundleBase = {
  repoName: string;
  repoUrl: string | null;
  mapMode: string;
  anchors: BundleExportContext["anchors"];
  fileNodes: BundleExportContext["fileNodes"];
  edges: BundleExportContext["edges"];
};

type Props = {
  open: boolean;
  onClose: () => void;
  repoId: string;
  single: RepurposeExportContext | null;
  bundle: BundleBase | null;
};

export default function ExportPromptSheet({
  open,
  onClose,
  repoId,
  single,
  bundle,
}: Props) {
  const [targetProject, setTargetProject] = useState("");
  const [targetStack, setTargetStack] = useState("");
  const [includeNeighbors, setIncludeNeighbors] = useState(true);
  const [attachSources, setAttachSources] = useState(false);
  const [sourceFiles, setSourceFiles] = useState<FetchedFile[] | undefined>();
  const [loadingSources, setLoadingSources] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [copied, setCopied] = useState(false);

  const isBundle = (bundle?.anchors.length ?? 0) > 0;
  const mode = isBundle ? bundle : single;

  const bundlePaths = useMemo(() => {
    if (!bundle) return [] as string[];
    return resolveBundlePaths(
      bundle.anchors,
      bundle.fileNodes,
      bundle.edges,
      includeNeighbors,
    );
  }, [bundle, includeNeighbors]);

  const fullBundle: BundleExportContext | null = useMemo(() => {
    if (!bundle) return null;
    return {
      ...bundle,
      includeNeighbors,
      bundlePaths,
    };
  }, [bundle, includeNeighbors, bundlePaths]);

  useEffect(() => {
    if (!open) {
      setSourceFiles(undefined);
      setFetchError("");
      setAttachSources(false);
    }
  }, [open]);

  useEffect(() => {
    if (!attachSources || !open || !mode) {
      setSourceFiles(undefined);
      return;
    }

    const paths = isBundle
      ? bundlePaths
      : [
          single!.data.path ?? "",
          ...single!.neighbors.outgoing.map((n) => n.path),
          ...single!.neighbors.incoming.map((n) => n.path),
        ].filter(Boolean);

    const unique = [...new Set(paths)];

    let cancelled = false;
    setLoadingSources(true);
    setFetchError("");

    fetch("/api/export/bundle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId, paths: unique }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Fetch failed");
        if (!cancelled) setSourceFiles(data.files as FetchedFile[]);
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
  }, [attachSources, open, isBundle, bundlePaths, single, repoId, mode]);

  const prompt = useMemo(() => {
    if (!mode) return "";
    const target = {
      targetProject: targetProject.trim() || undefined,
      targetStack: targetStack.trim() || undefined,
    };

    if (isBundle && fullBundle) {
      return buildBundlePrompt({
        ...fullBundle,
        ...target,
        sourceFiles: attachSources ? sourceFiles : undefined,
      });
    }

    if (single) {
      return buildRepurposePrompt({
        ...single,
        ...target,
      });
    }

    return "";
  }, [
    mode,
    isBundle,
    fullBundle,
    single,
    targetProject,
    targetStack,
    includeNeighbors,
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

  if (!open || !mode) return null;

  const title = isBundle
    ? `Bundle export (${bundle?.anchors.length ?? 0} anchors)`
    : `Export · ${single?.data.path?.split("/").pop() ?? "file"}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-labelledby="export-prompt-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-3xl max-h-[90vh] flex flex-col bg-gray-950 border border-gray-800 rounded-t-xl sm:rounded-xl shadow-2xl">
        <div className="flex-none px-4 py-3 border-b border-gray-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="export-prompt-title"
              className="text-sm font-semibold text-gray-100"
            >
              {title}
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Selective gitingest — prompt + optional source files
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none px-1"
          >
            ×
          </button>
        </div>

        <div className="flex-none px-4 py-2 space-y-2 border-b border-gray-800/80">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[9px] uppercase tracking-wider text-gray-600">
                Your project
              </span>
              <input
                value={targetProject}
                onChange={(e) => setTargetProject(e.target.value)}
                placeholder="my-saas-app"
                className="mt-1 w-full text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-200"
              />
            </label>
            <label className="block">
              <span className="text-[9px] uppercase tracking-wider text-gray-600">
                Stack
              </span>
              <input
                value={targetStack}
                onChange={(e) => setTargetStack(e.target.value)}
                placeholder="Next.js, Prisma…"
                className="mt-1 w-full text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-200"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-[11px]">
            {isBundle && (
              <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeNeighbors}
                  onChange={(e) => setIncludeNeighbors(e.target.checked)}
                  className="rounded border-gray-600"
                />
                Include neighbor paths in bundle
              </label>
            )}
            <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={attachSources}
                onChange={(e) => setAttachSources(e.target.checked)}
                className="rounded border-gray-600"
              />
              Attach source files from GitHub
            </label>
          </div>
          {loadingSources && (
            <p className="text-[10px] text-violet-400">Fetching file contents…</p>
          )}
          {fetchError && (
            <p className="text-[10px] text-red-400">{fetchError}</p>
          )}
          {isBundle && bundlePaths.length > 0 && (
            <p className="text-[10px] text-gray-600 font-mono">
              {bundlePaths.length} path(s):{" "}
              {bundlePaths.slice(0, 4).join(", ")}
              {bundlePaths.length > 4 ? "…" : ""}
            </p>
          )}
        </div>

        <textarea
          readOnly
          value={prompt}
          className="flex-1 min-h-[220px] m-4 text-[11px] font-mono text-gray-300 bg-gray-900/80 border border-gray-800 rounded-lg p-3 leading-relaxed resize-none"
        />

        <div className="flex-none px-4 pb-4 flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={loadingSources}
            className="flex-1 text-xs font-medium py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50"
          >
            {copied ? "Copied" : loadingSources ? "Loading sources…" : "Copy prompt"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 text-xs py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
