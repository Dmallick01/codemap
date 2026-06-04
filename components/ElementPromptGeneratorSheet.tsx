"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  buildRepoPrompt,
  PROMPT_MODE_META,
  ELEMENT_CATALOG,
  SYSTEM_CATALOG,
  suggestElementId,
  suggestSystemId,
  type PromptMode,
  type ElementCatalogId,
  type SystemCatalogId,
  type ExplainDepth,
  type RepoPromptGeneratorInput,
} from "@/lib/export/repo-prompt-generator";
import type { FetchedFile } from "@/lib/services/github-contents";
import type { FileNodeData } from "@/lib/store/graph";
import { downloadMarkdown, exportFilename } from "@/lib/export/download-markdown";

type MapInput = Omit<
  RepoPromptGeneratorInput,
  | "mode"
  | "elementId"
  | "customElement"
  | "systemId"
  | "customSystem"
  | "explainDepth"
  | "explainAudience"
  | "targetProject"
  | "targetStack"
  | "notes"
  | "sourceFiles"
>;

type Props = {
  open: boolean;
  onClose: () => void;
  repoId: string;
  repoName: string;
  input: MapInput | null;
};

const MODES: PromptMode[] = ["build-ui", "build-system", "explain-repo"];
const EXPLAIN_DEPTHS: { id: ExplainDepth; label: string }[] = [
  { id: "overview", label: "Wiki overview" },
  { id: "deep-dive", label: "Deep dive + improvements" },
  { id: "onboarding", label: "Contributor guide" },
];

export default function ElementPromptGeneratorSheet({
  open,
  onClose,
  repoId,
  repoName,
  input,
}: Props) {
  const [mode, setMode] = useState<PromptMode>("build-ui");
  const [elementId, setElementId] = useState<ElementCatalogId>("card-grid");
  const [systemId, setSystemId] = useState<SystemCatalogId>("domain-module");
  const [customElement, setCustomElement] = useState("");
  const [customSystem, setCustomSystem] = useState("");
  const [explainDepth, setExplainDepth] = useState<ExplainDepth>("overview");
  const [explainAudience, setExplainAudience] = useState("");
  const [targetProject, setTargetProject] = useState("");
  const [targetStack, setTargetStack] = useState("");
  const [notes, setNotes] = useState("");
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
        : mode === "explain-repo"
          ? nodes.slice(0, 5)
          : nodes.slice(0, 1);
    return selected
      .map((n) => (n.data as FileNodeData).path)
      .filter((p): p is string => !!p);
  }, [input, mode]);

  useEffect(() => {
    if (!open || !input) return;
    setElementId(suggestElementId(input.nodes, input.selectedNodeIds));
    setSystemId(suggestSystemId(input.nodes, input.selectedNodeIds));
    setFetchError("");
  }, [open, input]);

  useEffect(() => {
    if (!attachSources || !open || !uiPaths.length) {
      setSourceFiles(undefined);
      return;
    }
    let cancelled = false;
    setLoadingSources(true);
    setFetchError("");
    const limit = mode === "explain-repo" ? 5 : 3;
    fetch("/api/export/bundle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId, paths: [...new Set(uiPaths)].slice(0, limit) }),
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
  }, [attachSources, open, uiPaths, repoId, mode]);

  const prompt = useMemo(() => {
    if (!input) return "";
    return buildRepoPrompt({
      ...input,
      mode,
      elementId,
      customElement: elementId === "custom" ? customElement : undefined,
      systemId,
      customSystem: systemId === "custom-system" ? customSystem : undefined,
      explainDepth,
      explainAudience: explainAudience.trim() || undefined,
      targetProject: targetProject.trim() || undefined,
      targetStack: targetStack.trim() || undefined,
      notes: notes.trim() || undefined,
      sourceFiles: attachSources ? sourceFiles : undefined,
    });
  }, [
    input,
    mode,
    elementId,
    customElement,
    systemId,
    customSystem,
    explainDepth,
    explainAudience,
    targetProject,
    targetStack,
    notes,
    attachSources,
    sourceFiles,
  ]);

  const handleCopy = useCallback(async () => {
    if (!prompt || loadingSources) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [prompt, loadingSources]);

  const handleDownload = useCallback(() => {
    if (!prompt || loadingSources) return;
    const slug =
      mode === "explain-repo"
        ? `wiki-${explainDepth}`
        : mode === "build-system"
          ? systemId
          : elementId;
    downloadMarkdown(
      exportFilename(repoName, 1).replace("codemap-", `codemap-prompt-${slug}-`),
      prompt,
    );
  }, [prompt, loadingSources, repoName, mode, elementId, systemId, explainDepth]);

  if (!open || !input) return null;

  const meta = PROMPT_MODE_META[mode];
  const hasSelection = input.selectedNodeIds.length > 0;
  const focusPath = uiPaths[0];
  const needsSelection = mode !== "explain-repo";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 sheet-overlay" aria-label="Close" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] flex flex-col sheet-panel rounded-t-xl sm:rounded-xl shadow-2xl">
        <div className="flex-none px-4 py-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="panel-label mb-1">Repo prompt generator · GitHub wiki & build coach</p>
          <h2 className="text-sm font-semibold leading-snug" style={{ color: "var(--accent)" }}>
            {meta.headline}
          </h2>
          <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
            {meta.description} · {repoName}
            {focusPath ? ` · \`${focusPath.split("/").pop()}\`` : needsSelection ? " · select map nodes" : " · whole repo"}
          </p>
        </div>

        <div className="flex-none px-4 pt-2 flex flex-wrap gap-1">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`btn-blueprint text-[10px] ${mode === m ? "nav-tab-active" : ""}`}
            >
              {PROMPT_MODE_META[m].label}
            </button>
          ))}
        </div>

        <div
          className="flex-none px-4 py-3 space-y-3 border-b overflow-y-auto max-h-[42vh]"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {needsSelection && !hasSelection && (
            <p className="text-[10px] glass-chip rounded px-2 py-1.5" style={{ color: "#fbbf24" }}>
              Select file(s) on the map to anchor this prompt to real GitHub paths and graph edges.
            </p>
          )}

          {mode === "build-ui" && (
            <div>
              <span className="panel-label block mb-2">UI element or function</span>
              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                {ELEMENT_CATALOG.map((el) => (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => setElementId(el.id)}
                    className={`btn-blueprint text-[10px] ${elementId === el.id ? "nav-tab-active" : ""}`}
                    title={el.hint}
                  >
                    {el.label}
                  </button>
                ))}
              </div>
              {elementId === "custom" && (
                <input
                  value={customElement}
                  onChange={(e) => setCustomElement(e.target.value)}
                  placeholder="e.g. pricing comparison table"
                  className="mt-2 w-full text-xs sheet-input rounded px-2 py-1.5"
                />
              )}
            </div>
          )}

          {mode === "build-system" && (
            <div>
              <span className="panel-label block mb-2">Subsystem (framework, agent, data…)</span>
              <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto">
                {SYSTEM_CATALOG.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSystemId(s.id)}
                    className={`btn-blueprint text-[10px] ${systemId === s.id ? "nav-tab-active" : ""}`}
                    title={s.hint}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {systemId === "custom-system" && (
                <input
                  value={customSystem}
                  onChange={(e) => setCustomSystem(e.target.value)}
                  placeholder="e.g. multi-tenant billing service"
                  className="mt-2 w-full text-xs sheet-input rounded px-2 py-1.5"
                />
              )}
            </div>
          )}

          {mode === "explain-repo" && (
            <>
              <div>
                <span className="panel-label block mb-2">Wiki article depth</span>
                <div className="flex flex-wrap gap-1.5">
                  {EXPLAIN_DEPTHS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setExplainDepth(d.id)}
                      className={`btn-blueprint text-[10px] ${explainDepth === d.id ? "nav-tab-active" : ""}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="panel-label">Who is reading? (optional)</span>
                <input
                  value={explainAudience}
                  onChange={(e) => setExplainAudience(e.target.value)}
                  placeholder="e.g. senior engineer evaluating a fork, new hire…"
                  className="mt-1 w-full text-xs sheet-input rounded px-2 py-1.5"
                />
              </label>
              <p className="text-[10px] detail-muted">
                Explains what the repo does, architecture, strengths, and **what could be improved** — exportable as onboarding or wiki docs.
              </p>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="panel-label">Your project</span>
              <input
                value={targetProject}
                onChange={(e) => setTargetProject(e.target.value)}
                className="mt-1 w-full text-xs sheet-input rounded px-2 py-1.5"
                placeholder="my-app"
              />
            </label>
            <label className="block">
              <span className="panel-label">Stack</span>
              <input
                value={targetStack}
                onChange={(e) => setTargetStack(e.target.value)}
                className="mt-1 w-full text-xs sheet-input rounded px-2 py-1.5"
                placeholder="Next.js, agents, Postgres…"
              />
            </label>
          </div>

          <label className="block">
            <span className="panel-label">Extra instructions</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full text-xs sheet-input rounded px-2 py-1.5"
              placeholder={
                mode === "explain-repo"
                  ? "Emphasize security gaps, compare to our monorepo…"
                  : "Match DESIGN.md, SOC2, dark mode only…"
              }
            />
          </label>

          <label className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={attachSources}
              onChange={(e) => setAttachSources(e.target.checked)}
              style={{ accentColor: "var(--accent)" }}
            />
            Attach reference source from GitHub
          </label>
          {fetchError && (
            <p className="text-[10px]" style={{ color: "var(--error)" }}>
              {fetchError}
            </p>
          )}
        </div>

        <textarea
          readOnly
          value={prompt}
          className="flex-1 min-h-[180px] m-4 text-[11px] font-mono sheet-textarea rounded-lg p-3 resize-none"
        />

        <div className="flex-none px-4 pb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={loadingSources || !prompt}
            className="flex-1 btn-blueprint-primary py-2 disabled:opacity-50"
          >
            {copied ? "Copied" : loadingSources ? "Loading source…" : "Copy prompt"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loadingSources || !prompt}
            className="flex-1 btn-blueprint py-2 disabled:opacity-50"
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
