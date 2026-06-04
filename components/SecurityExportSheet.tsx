"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  buildSecurityPrompt,
  type SecurityExportInput,
  type SecurityFinding,
} from "@/lib/export/security-prompt";
import { downloadMarkdown, exportFilename } from "@/lib/export/download-markdown";
import {
  SECURITY_LAB_TOOL_IDS,
  labResultToFindings,
  readCachedSecurityFindings,
  mergeCachedSecurityFindings,
} from "@/lib/security/lab-findings";
import type { LabToolResult } from "@/lib/services/github-lab";

type Props = {
  open: boolean;
  onClose: () => void;
  repoId: string;
  repoName: string;
  input: Omit<SecurityExportInput, "targetProject" | "targetStack" | "securityNotes" | "labFindings"> | null;
};

export default function SecurityExportSheet({
  open,
  onClose,
  repoId,
  repoName,
  input,
}: Props) {
  const [targetProject, setTargetProject] = useState("");
  const [targetStack, setTargetStack] = useState("");
  const [securityNotes, setSecurityNotes] = useState("");
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [loadingLab, setLoadingLab] = useState(false);
  const [labError, setLabError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const cached = readCachedSecurityFindings(repoId);
    if (cached.length) setFindings(cached);
  }, [open, repoId]);

  const prompt = useMemo(() => {
    if (!input) return "";
    return buildSecurityPrompt({
      ...input,
      targetProject: targetProject.trim() || undefined,
      targetStack: targetStack.trim() || undefined,
      securityNotes: securityNotes.trim() || undefined,
      labFindings: findings,
    });
  }, [input, targetProject, targetStack, securityNotes, findings]);

  const pullLabFindings = useCallback(async () => {
    if (!input?.repoUrl) return;
    setLoadingLab(true);
    setLabError("");
    const collected: SecurityFinding[] = [];
    const errors: string[] = [];

    for (const toolId of SECURITY_LAB_TOOL_IDS) {
      try {
        const res = await fetch("/api/github/lab", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoId, repoUrl: input.repoUrl, toolId }),
        });
        const data = (await res.json()) as LabToolResult & { error?: string };
        if (!res.ok) {
          errors.push(`${toolId}: ${data.error ?? "request failed"}`);
          continue;
        }
        collected.push(...labResultToFindings(data));
      } catch (e) {
        errors.push(`${toolId}: ${e instanceof Error ? e.message : "network error"}`);
      }
    }

    const merged = mergeCachedSecurityFindings(repoId, collected);
    setFindings(merged);
    if (errors.length === SECURITY_LAB_TOOL_IDS.length) {
      setLabError(errors.join(" · "));
    } else if (errors.length) {
      setLabError(`Partial: ${errors.join(" · ")}`);
    }
    setLoadingLab(false);
  }, [input, repoId]);

  const handleCopy = useCallback(async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [prompt]);

  const handleDownload = useCallback(() => {
    if (!prompt) return;
    downloadMarkdown(
      exportFilename(repoName, 1).replace("codemap-", "codemap-security-"),
      prompt,
    );
  }, [prompt, repoName]);

  if (!open || !input) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 sheet-overlay" aria-label="Close" onClick={onClose} />
      <div className="relative w-full sm:max-w-3xl max-h-[90vh] flex flex-col sheet-panel rounded-t-xl sm:rounded-xl shadow-2xl">
        <div className="flex-none px-4 py-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            Security implementation brief
          </h2>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            OWASP-aligned hardening spec · merges map heuristics + GitHub Lab security tools
          </p>
        </div>

        <div className="flex-none px-4 py-2 space-y-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="panel-label">Target app</span>
              <input
                value={targetProject}
                onChange={(e) => setTargetProject(e.target.value)}
                className="mt-1 w-full text-xs sheet-input rounded px-2 py-1.5"
              />
            </label>
            <label className="block">
              <span className="panel-label">Stack</span>
              <input
                value={targetStack}
                onChange={(e) => setTargetStack(e.target.value)}
                className="mt-1 w-full text-xs sheet-input rounded px-2 py-1.5"
                placeholder="Next.js, Postgres…"
              />
            </label>
          </div>
          <label className="block">
            <span className="panel-label">Security notes</span>
            <input
              value={securityNotes}
              onChange={(e) => setSecurityNotes(e.target.value)}
              className="mt-1 w-full text-xs sheet-input rounded px-2 py-1.5"
              placeholder="e.g. SOC2, public SaaS, no PII in logs"
            />
          </label>
          {input.repoUrl ? (
            <button
              type="button"
              onClick={pullLabFindings}
              disabled={loadingLab}
              className="btn-blueprint"
            >
              {loadingLab
                ? "Running 5 security tools…"
                : "Pull all security tools (Dependabot, secrets, auth, Actions, CodeQL)"}
            </button>
          ) : (
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Map-only brief (no GitHub URL for live API pulls).
            </p>
          )}
          {findings.length > 0 && (
            <p className="text-[10px]" style={{ color: "var(--accent)" }}>
              {findings.length} finding(s) in brief
              {readCachedSecurityFindings(repoId).length ? " · includes Lab session cache" : ""}
            </p>
          )}
          {labError && (
            <p className="text-[10px]" style={{ color: "var(--error)" }}>
              {labError}
            </p>
          )}
        </div>

        <textarea readOnly value={prompt} className="flex-1 min-h-[200px] m-4 text-[11px] font-mono sheet-textarea rounded-lg p-3 resize-none" />

        <div className="flex-none px-4 pb-4 flex flex-wrap gap-2">
          <button type="button" onClick={handleCopy} className="flex-1 btn-blueprint-primary py-2">
            {copied ? "Copied" : "Copy security brief"}
          </button>
          <button type="button" onClick={handleDownload} className="flex-1 btn-blueprint py-2">
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
