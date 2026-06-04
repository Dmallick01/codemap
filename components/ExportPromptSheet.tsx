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
import {
  downloadMarkdown,
  exportFilename,
} from "@/lib/export/download-markdown";

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
  const [sourceMeta, setSourceMeta] = useState<{
    fromDatabase: number;
    fromGithub: number;
    mode: string;
  } | null>(null);

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
      setSourceMeta(null);
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
        if (!cancelled) {
          setSourceFiles(data.files as FetchedFile[]);
          if (data.meta) setSourceMeta(data.meta);
        }
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

  const repoLabel =
    (isBundle ? bundle?.repoName : single?.repoName) ?? "export";
  const anchorCount = isBundle
    ? (bundle?.anchors.length ?? 0)
    : 1;

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
    downloadMarkdown(exportFilename(repoLabel, anchorCount), prompt);
  }, [prompt, loadingSources, repoLabel, anchorCount]);

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
        className="absolute inset-0 sheet-overlay"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-3xl max-h-[90vh] flex flex-col sheet-panel rounded-t-xl sm:rounded-xl shadow-2xl">
        <div
          className="flex-none px-4 py-3 border-b flex items-start justify-between gap-3"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="min-w-0">
            <h2 id="export-prompt-title" className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
              {title}
            </h2>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              Selective gitingest — prompt + optional source files
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-blueprint text-lg leading-none px-1">
            ×
          </button>
        </div>

        <div
          className="flex-none px-4 py-2 space-y-2 border-b"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="panel-label">Your project</span>
              <input
                value={targetProject}
                onChange={(e) => setTargetProject(e.target.value)}
                placeholder="my-saas-app"
                className="mt-1 w-full text-xs sheet-input rounded px-2 py-1.5"
              />
            </label>
            <label className="block">
              <span className="panel-label">Stack</span>
              <input
                value={targetStack}
                onChange={(e) => setTargetStack(e.target.value)}
                placeholder="Next.js, Prisma…"
                className="mt-1 w-full text-xs sheet-input rounded px-2 py-1.5"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {isBundle && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeNeighbors}
                  onChange={(e) => setIncludeNeighbors(e.target.checked)}
                  className="rounded"
                  style={{ accentColor: "var(--accent)" }}
                />
                Include neighbor paths in bundle
              </label>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={attachSources}
                onChange={(e) => setAttachSources(e.target.checked)}
                className="rounded"
                style={{ accentColor: "var(--accent)" }}
              />
              Attach source files (deep DB first, else GitHub)
            </label>
          </div>
          {loadingSources && (
            <p className="text-[10px]" style={{ color: "var(--accent)" }}>
              Fetching file contents…
            </p>
          )}
          {sourceMeta && attachSources && !loadingSources && (
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Sources: {sourceMeta.fromDatabase} from database,{" "}
              {sourceMeta.fromGithub} from GitHub ({sourceMeta.mode} mode)
            </p>
          )}
          {fetchError && (
            <p className="text-[10px]" style={{ color: "var(--error)" }}>
              {fetchError}
            </p>
          )}
          {isBundle && bundlePaths.length > 0 && (
            <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
              {bundlePaths.length} path(s):{" "}
              {bundlePaths.slice(0, 4).join(", ")}
              {bundlePaths.length > 4 ? "…" : ""}
            </p>
          )}
        </div>

        <textarea
          readOnly
          value={prompt}
          className="flex-1 min-h-[220px] m-4 text-[11px] font-mono sheet-textarea rounded-lg p-3 leading-relaxed resize-none"
        />

        <div className="flex-none px-4 pb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={loadingSources}
            className="flex-1 min-w-[120px] btn-blueprint-primary py-2 disabled:opacity-50"
          >
            {copied ? "Copied" : loadingSources ? "Loading…" : "Copy prompt"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loadingSources || !prompt}
            className="flex-1 min-w-[120px] btn-blueprint py-2 disabled:opacity-50"
          >
            Download .md
          </button>
          <button type="button" onClick={onClose} className="btn-blueprint py-2 px-4">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
