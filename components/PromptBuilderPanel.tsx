"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
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
import { parseUserIntent } from "@/lib/prompt/parse-user-intent";
import type { FetchedFile } from "@/lib/services/github-contents";
import type { FileNodeData } from "@/lib/store/graph";
import { downloadMarkdown, exportFilename } from "@/lib/export/download-markdown";

const EXAMPLE_ASKS = [
  "Explain this entire GitHub repo like a wiki",
  "Build a navigation bar like the one in this project",
  "How do I recreate the auth and login flow?",
  "Build an agent / tool-calling loop similar to this codebase",
  "What could be improved in this architecture?",
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

type Props = {
  repoId: string;
  repoName: string;
  repoUrl: string | null;
  input: MapInput;
  expanded: boolean;
  onToggleExpanded: () => void;
  currentFilePath?: string | null;
  /** Lift panel above bottom chrome (explorer dock, etc.) */
  dockOffsetPx?: number;
};

export default function PromptBuilderPanel({
  repoId,
  repoName,
  repoUrl,
  input,
  expanded,
  onToggleExpanded,
  currentFilePath,
  dockOffsetPx = 0,
}: Props) {
  const [userQuestion, setUserQuestion] = useState("");
  const [mode, setMode] = useState<PromptMode>("build-ui");
  const [elementId, setElementId] = useState<ElementCatalogId>("card-grid");
  const [systemId, setSystemId] = useState<SystemCatalogId>("domain-module");
  const [customElement, setCustomElement] = useState("");
  const [customSystem, setCustomSystem] = useState("");
  const [explainDepth, setExplainDepth] = useState<ExplainDepth>("overview");
  const [targetProject, setTargetProject] = useState("");
  const [targetStack, setTargetStack] = useState("");
  const [attachSources, setAttachSources] = useState(true);
  const [sourceFiles, setSourceFiles] = useState<FetchedFile[] | undefined>();
  const [loadingSources, setLoadingSources] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);

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
    setGenerated(true);
  }, []);

  const generateFromQuestion = useCallback(() => {
    if (!userQuestion.trim()) return;
    applyIntent(userQuestion);
    if (!expanded) onToggleExpanded();
  }, [userQuestion, applyIntent, expanded, onToggleExpanded]);

  useEffect(() => {
    if (!generated || !attachSources || !selectedPaths.length) {
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
  }, [generated, attachSources, selectedPaths, repoId, mode]);

  const prompt = useMemo(() => {
    if (!generated) return "";
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
    generated,
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

  const intentPreview = useMemo(
    () => (userQuestion.trim() ? parseUserIntent(userQuestion) : null),
    [userQuestion],
  );

  const handleCopy = useCallback(async () => {
    if (!prompt || loadingSources) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [prompt, loadingSources]);

  const anchorLabel = selectedPaths[0]?.split("/").pop() ?? "whole repo";

  return (
    <div
      className={`prompt-builder ${expanded ? "prompt-builder-expanded" : "prompt-builder-collapsed"}`}
      style={{ bottom: dockOffsetPx }}
    >
      <div className="prompt-builder-bar">
        <div className="flex-1 min-w-0">
          <label htmlFor="prompt-ask" className="prompt-builder-label">
            Ask about this GitHub repo
          </label>
          <div className="flex gap-2 mt-1">
            <input
              id="prompt-ask"
              type="text"
              value={userQuestion}
              onChange={(e) => {
                setUserQuestion(e.target.value);
                setGenerated(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  generateFromQuestion();
                }
              }}
              placeholder='e.g. "Build a sidebar like this repo" or "Explain how auth works"'
              className="prompt-builder-input flex-1"
            />
            <button
              type="button"
              onClick={generateFromQuestion}
              disabled={!userQuestion.trim()}
              className="btn-blueprint-primary shrink-0 px-4"
            >
              Generate prompt
            </button>
            <button
              type="button"
              onClick={onToggleExpanded}
              className="btn-blueprint shrink-0"
              aria-expanded={expanded}
            >
              {expanded ? "Minimize" : "Expand"}
            </button>
          </div>
          <p className="prompt-builder-hint mt-1">
            Reference: <strong>{repoName}</strong>
            {selectedPaths[0] ? (
              <>
                {" "}
                · file <code className="font-mono text-[12px]">{anchorLabel}</code>
              </>
            ) : (
              " · click a file on the map to anchor (or ask about the whole repo)"
            )}
          </p>
        </div>
      </div>

      {expanded && (
        <div className="prompt-builder-body">
          <div className="prompt-builder-examples">
            <span className="text-readable-muted text-[12px] mr-2">Try:</span>
            {EXAMPLE_ASKS.map((ex) => (
              <button
                key={ex}
                type="button"
                className="prompt-chip"
                onClick={() => {
                  setUserQuestion(ex);
                  applyIntent(ex);
                  setGenerated(true);
                }}
              >
                {ex}
              </button>
            ))}
          </div>

          {intentPreview && userQuestion.trim() && (
            <p className="text-readable-secondary text-[13px] mb-3">
              Detected: <strong>{PROMPT_MODE_META[intentPreview.mode].label}</strong>
              {intentPreview.summary ? ` — ${intentPreview.summary}` : ""}
            </p>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            {(Object.keys(PROMPT_MODE_META) as PromptMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setGenerated(true);
                }}
                className={`btn-blueprint text-[13px] ${mode === m ? "nav-tab-active" : ""}`}
              >
                {PROMPT_MODE_META[m].label}
              </button>
            ))}
          </div>

          {mode === "build-ui" && (
            <div className="mb-3">
              <p className="panel-label mb-2">Pick UI element (optional refine)</p>
              <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto">
                {ELEMENT_CATALOG.map((el) => (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => {
                      setElementId(el.id);
                      setGenerated(true);
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
            <div className="mb-3">
              <p className="panel-label mb-2">Pick subsystem</p>
              <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto">
                {SYSTEM_CATALOG.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSystemId(s.id);
                      setGenerated(true);
                    }}
                    className={`prompt-chip ${systemId === s.id ? "prompt-chip-active" : ""}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-3">
            <input
              value={targetProject}
              onChange={(e) => setTargetProject(e.target.value)}
              placeholder="Your project name"
              className="prompt-builder-input"
            />
            <input
              value={targetStack}
              onChange={(e) => setTargetStack(e.target.value)}
              placeholder="Your stack (Next.js, etc.)"
              className="prompt-builder-input"
            />
          </div>

          <label className="flex items-center gap-2 text-readable-secondary text-[13px] mb-3">
            <input
              type="checkbox"
              checked={attachSources}
              onChange={(e) => setAttachSources(e.target.checked)}
              style={{ accentColor: "var(--accent)" }}
            />
            Include GitHub source code in prompt
          </label>

          {fetchError && (
            <p className="text-[13px] mb-2" style={{ color: "var(--error)" }}>
              {fetchError}
            </p>
          )}

          {!generated && (
            <p className="text-readable-muted text-[13px] mb-2">
              Type your question and press <strong>Generate prompt</strong> to create a
              copy-paste instruction for Cursor or Claude.
            </p>
          )}

          {generated && (
            <>
              <p className="panel-label mb-2">{PROMPT_MODE_META[mode].headline}</p>
              <textarea
                readOnly
                value={loadingSources ? "Loading GitHub source files…" : prompt}
                className="prompt-preview"
              />
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={loadingSources || !prompt}
                  className="btn-blueprint-primary flex-1 py-2.5 text-[14px]"
                >
                  {copied ? "Copied to clipboard" : loadingSources ? "Loading…" : "Copy prompt"}
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
                  className="btn-blueprint py-2.5 text-[14px]"
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
}
