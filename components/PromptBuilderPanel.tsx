"use client";

import { forwardRef, useMemo, useState, useCallback, useEffect } from "react";
import {
  buildRepoPrompt,
  PROMPT_MODE_META,
  ELEMENT_CATALOG,
  SYSTEM_CATALOG,
  type PromptMode,
  type ElementCatalogId,
  type SystemCatalogId,
  type ExplainDepth,
  type RepoPromptGeneratorInput,
} from "@/lib/export/repo-prompt-generator";
import {
  buildRepoExplanation,
  isExplainIntent,
  type RepoOverviewForExplain,
} from "@/lib/export/build-repo-explanation";
import { parseUserIntent } from "@/lib/prompt/parse-user-intent";
import type { FetchedFile } from "@/lib/services/github-contents";
import type { FileNodeData } from "@/lib/store/graph";
import { downloadMarkdown, exportFilename } from "@/lib/export/download-markdown";
import RepoExplanationView from "@/components/RepoExplanationView";

const QUICK_EXPLAIN = "Explain this GitHub repository";

const EXAMPLE_ASKS = [
  { label: "Explain this GitHub", explain: true },
  { label: "Build a nav bar like this repo", explain: false },
  { label: "How does auth work here?", explain: true },
  { label: "Build an agent loop like this codebase", explain: false },
];

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
  | "userQuestion"
>;

type OutputView = "idle" | "explain" | "prompt";

type Props = {
  repoId: string;
  repoName: string;
  repoUrl: string | null;
  input: MapInput;
  expanded: boolean;
  onToggleExpanded: () => void;
  currentFilePath?: string | null;
  overview?: RepoOverviewForExplain | null;
  dockOffsetPx?: number;
};

const PromptBuilderPanel = forwardRef<HTMLDivElement, Props>(function PromptBuilderPanel(
  {
    repoId,
    repoName,
    repoUrl,
    input,
    expanded,
    onToggleExpanded,
    currentFilePath,
    overview = null,
    dockOffsetPx = 0,
  },
  ref,
) {
  const [userQuestion, setUserQuestion] = useState("");
  const [mode, setMode] = useState<PromptMode>("explain-repo");
  const [elementId, setElementId] = useState<ElementCatalogId>("card-grid");
  const [systemId, setSystemId] = useState<SystemCatalogId>("domain-module");
  const [customElement, setCustomElement] = useState("");
  const [customSystem, setCustomSystem] = useState("");
  const [explainDepth, setExplainDepth] = useState<ExplainDepth>("overview");
  const [targetProject, setTargetProject] = useState("");
  const [targetStack, setTargetStack] = useState("");
  const [attachSources, setAttachSources] = useState(false);
  const [sourceFiles, setSourceFiles] = useState<FetchedFile[] | undefined>();
  const [loadingSources, setLoadingSources] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [copied, setCopied] = useState(false);
  const [outputView, setOutputView] = useState<OutputView>("idle");

  const selectedPaths = useMemo(() => {
    const nodes = input.nodes.filter((n) => n.type === "fileNode");
    const selected =
      input.selectedNodeIds.length > 0
        ? nodes.filter((n) => input.selectedNodeIds.includes(n.id))
        : nodes.filter((n) => (n.data as FileNodeData).path === currentFilePath).slice(0, 1);
    if (selected.length) {
      return selected.map((n) => (n.data as FileNodeData).path).filter(Boolean) as string[];
    }
    if (currentFilePath) return [currentFilePath];
    return [];
  }, [input, currentFilePath]);

  const applyIntent = useCallback((question: string) => {
    const intent = parseUserIntent(question);
    setMode(intent.mode);
    if (intent.elementId) setElementId(intent.elementId);
    if (intent.systemId) setSystemId(intent.systemId);
    if (intent.customLabel && intent.elementId === "custom") setCustomElement(intent.customLabel);
    if (intent.explainDepth) setExplainDepth(intent.explainDepth);
    return intent;
  }, []);

  const runExplain = useCallback(
    (question?: string) => {
      const q = question ?? userQuestion;
      if (q.trim()) applyIntent(q);
      setMode("explain-repo");
      setOutputView("explain");
      if (!expanded) onToggleExpanded();
    },
    [userQuestion, applyIntent, expanded, onToggleExpanded],
  );

  const runPrompt = useCallback(() => {
    if (!userQuestion.trim() && mode === "explain-repo") return;
    if (userQuestion.trim()) applyIntent(userQuestion);
    setOutputView("prompt");
    if (!expanded) onToggleExpanded();
  }, [userQuestion, applyIntent, mode, expanded, onToggleExpanded]);

  const handlePrimaryAction = useCallback(() => {
    const explain =
      mode === "explain-repo" ||
      isExplainIntent(userQuestion) ||
      !userQuestion.trim();
    if (explain) {
      runExplain(userQuestion.trim() || QUICK_EXPLAIN);
    } else {
      runPrompt();
    }
  }, [mode, userQuestion, runExplain, runPrompt]);

  useEffect(() => {
    if (outputView !== "prompt" || !attachSources || !selectedPaths.length) {
      if (!attachSources) setSourceFiles(undefined);
      return;
    }
    let cancelled = false;
    setLoadingSources(true);
    setFetchError("");
    fetch("/api/export/bundle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoId,
        paths: [...new Set(selectedPaths)].slice(0, mode === "explain-repo" ? 5 : 3),
      }),
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
  }, [outputView, attachSources, selectedPaths, repoId, mode]);

  const explanation = useMemo(() => {
    if (outputView !== "explain") return "";
    return buildRepoExplanation({
      ...input,
      depth: explainDepth,
      overview,
      userQuestion: userQuestion.trim() || QUICK_EXPLAIN,
      edges: input.edges,
    });
  }, [outputView, input, explainDepth, overview, userQuestion]);

  const prompt = useMemo(() => {
    if (outputView !== "prompt") return "";
    return buildRepoPrompt({
      ...input,
      mode,
      elementId,
      customElement: elementId === "custom" ? customElement : undefined,
      systemId,
      customSystem: systemId === "custom-system" ? customSystem : undefined,
      explainDepth,
      targetProject: targetProject.trim() || undefined,
      targetStack: targetStack.trim() || undefined,
      notes: userQuestion.trim(),
      userQuestion: userQuestion.trim(),
      sourceFiles: attachSources ? sourceFiles : undefined,
    });
  }, [
    outputView,
    input,
    mode,
    elementId,
    customElement,
    systemId,
    customSystem,
    explainDepth,
    targetProject,
    targetStack,
    userQuestion,
    attachSources,
    sourceFiles,
  ]);

  const primaryIsExplain =
    mode === "explain-repo" || isExplainIntent(userQuestion) || !userQuestion.trim();

  const handleCopy = useCallback(async () => {
    const text = outputView === "explain" ? explanation : prompt;
    if (!text || loadingSources) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [outputView, explanation, prompt, loadingSources]);

  const anchorLabel = selectedPaths[0]?.split("/").pop() ?? "whole repo";

  return (
    <div
      ref={ref}
      className={`prompt-builder ${expanded ? "prompt-builder-expanded" : "prompt-builder-collapsed"}`}
      style={{ bottom: dockOffsetPx }}
    >
      <div className="prompt-builder-bar">
        {expanded && (
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {(Object.keys(PROMPT_MODE_META) as PromptMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setOutputView("idle");
                  if (m === "explain-repo") setUserQuestion((q) => q || QUICK_EXPLAIN);
                }}
                className={`prompt-mode-tab ${mode === m ? "prompt-mode-tab-active" : ""}`}
              >
                {m === "explain-repo" ? "Explain GitHub" : PROMPT_MODE_META[m].label}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
          {!expanded && (
            <select
              aria-label="Prompt mode"
              value={mode}
              onChange={(e) => {
                const m = e.target.value as PromptMode;
                setMode(m);
                setOutputView("idle");
                if (m === "explain-repo") setUserQuestion((q) => q || QUICK_EXPLAIN);
              }}
              className="prompt-mode-select shrink-0"
            >
              {(Object.keys(PROMPT_MODE_META) as PromptMode[]).map((m) => (
                <option key={m} value={m}>
                  {m === "explain-repo" ? "Explain GitHub" : PROMPT_MODE_META[m].label}
                </option>
              ))}
            </select>
          )}
          <input
            id="prompt-ask"
            type="text"
            value={userQuestion}
            onChange={(e) => {
              setUserQuestion(e.target.value);
              setOutputView("idle");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handlePrimaryAction();
              }
            }}
            placeholder={
              primaryIsExplain
                ? "Explain this repo, a subsystem, or selected file…"
                : "Describe what to build from this repo…"
            }
            className="prompt-builder-input flex-1 min-w-0"
          />
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="btn-blueprint-primary shrink-0 px-3"
          >
            {primaryIsExplain ? "Explain" : "Build prompt"}
          </button>
          <button
            type="button"
            onClick={() => runExplain(QUICK_EXPLAIN)}
            className="btn-blueprint shrink-0 hidden sm:inline-flex"
            title="Explain whole repository"
          >
            Explain repo
          </button>
          <button
            type="button"
            onClick={onToggleExpanded}
            className="btn-blueprint shrink-0 px-2"
            aria-expanded={expanded}
          >
            {expanded ? "▾" : "▴"}
          </button>
        </div>
        <p className={`prompt-builder-hint truncate ${expanded ? "mt-1" : "mt-0.5 w-full basis-full"}`}>
          <strong>{repoName}</strong>
          {selectedPaths[0] ? (
            <>
              {" "}
              · <code className="font-mono text-[11px]">{anchorLabel}</code>
            </>
          ) : (
            " · whole map"
          )}
        </p>
      </div>

      {expanded && (
        <div className="prompt-builder-body">
          <div className="prompt-builder-examples">
            {EXAMPLE_ASKS.map((ex) => (
              <button
                key={ex.label}
                type="button"
                className="prompt-chip"
                onClick={() => {
                  setUserQuestion(ex.label);
                  if (ex.explain) runExplain(ex.label);
                  else {
                    applyIntent(ex.label);
                    setOutputView("prompt");
                  }
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>

          {mode !== "explain-repo" && (
            <>
              {mode === "build-ui" && (
                <div className="mb-2">
                  <p className="panel-label mb-1">UI element</p>
                  <div className="flex flex-wrap gap-1 max-h-[72px] overflow-y-auto">
                    {ELEMENT_CATALOG.map((el) => (
                      <button
                        key={el.id}
                        type="button"
                        onClick={() => {
                          setElementId(el.id);
                          setOutputView("prompt");
                        }}
                        className={`prompt-chip ${elementId === el.id ? "prompt-chip-active" : ""}`}
                      >
                        {el.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {mode === "build-system" && (
                <div className="mb-2">
                  <p className="panel-label mb-1">Subsystem</p>
                  <div className="flex flex-wrap gap-1 max-h-[72px] overflow-y-auto">
                    {SYSTEM_CATALOG.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSystemId(s.id);
                          setOutputView("prompt");
                        }}
                        className={`prompt-chip ${systemId === s.id ? "prompt-chip-active" : ""}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-readable-secondary text-[12px] mb-2">
                <input
                  type="checkbox"
                  checked={attachSources}
                  onChange={(e) => setAttachSources(e.target.checked)}
                  style={{ accentColor: "var(--accent)" }}
                />
                Attach GitHub source to build prompt
              </label>
            </>
          )}

          {mode === "explain-repo" && (
            <div className="flex flex-wrap gap-1 mb-2">
              {(["overview", "deep-dive", "onboarding"] as ExplainDepth[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setExplainDepth(d);
                    if (outputView === "explain") runExplain();
                  }}
                  className={`prompt-chip ${explainDepth === d ? "prompt-chip-active" : ""}`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          {fetchError && (
            <p className="text-[13px] mb-2" style={{ color: "var(--error)" }}>
              {fetchError}
            </p>
          )}

          {outputView === "idle" && (
            <p className="text-readable-muted text-[13px]">
              {primaryIsExplain
                ? "Press Explain to read a wiki-style summary of this repo — no copy-paste prompt."
                : "Press Build prompt for a Cursor-ready instruction."}
            </p>
          )}

          {outputView === "explain" && explanation && (
            <div className="repo-explanation-scroll">
              <RepoExplanationView markdown={explanation} />
              <div className="flex flex-wrap gap-2 mt-3 sticky bottom-0 pt-2 repo-explanation-actions">
                <button type="button" onClick={handleCopy} className="btn-blueprint py-2 text-[13px]">
                  {copied ? "Copied" : "Copy article"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadMarkdown(
                      exportFilename(repoName, 1).replace("codemap-", "codemap-wiki-"),
                      explanation,
                    )
                  }
                  className="btn-blueprint py-2 text-[13px]"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOutputView("prompt");
                    setMode("explain-repo");
                  }}
                  className="btn-blueprint py-2 text-[13px] ml-auto"
                >
                  Export as LLM prompt
                </button>
              </div>
            </div>
          )}

          {outputView === "prompt" && (
            <>
              <textarea
                readOnly
                value={loadingSources ? "Loading GitHub source files…" : prompt}
                className="prompt-preview"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={loadingSources || !prompt}
                  className="btn-blueprint-primary flex-1 py-2 text-[13px]"
                >
                  {copied ? "Copied" : loadingSources ? "Loading…" : "Copy prompt"}
                </button>
                <button
                  type="button"
                  disabled={loadingSources || !prompt}
                  onClick={() =>
                    downloadMarkdown(
                      exportFilename(repoName, 1).replace("codemap-", "codemap-ask-"),
                      prompt,
                    )
                  }
                  className="btn-blueprint py-2 text-[13px]"
                >
                  Download
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});

export default PromptBuilderPanel;
