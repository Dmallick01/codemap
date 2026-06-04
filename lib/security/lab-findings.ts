import type { LabToolResult } from "@/lib/services/github-lab";
import type { SecurityFinding } from "@/lib/export/security-prompt";
import type { LabToolId } from "@/lib/github/lab-tool-registry";

export const SECURITY_LAB_TOOL_IDS = [
  "dependency-advisories",
  "secret-surface",
  "auth-surface-map",
  "actions-security",
  "code-scanning",
] as const satisfies readonly LabToolId[];

const CACHE_KEY = (repoId: string) => `codemap-security-findings-${repoId}`;

export function labResultToFindings(result: LabToolResult): SecurityFinding[] {
  if (!result.ok) {
    return [
      {
        category: result.title,
        severity: "high",
        detail: result.error ?? "Tool failed",
      },
    ];
  }

  const findings: SecurityFinding[] = [];
  const severity =
    result.toolId === "dependency-advisories" || result.toolId === "code-scanning"
      ? "high"
      : result.toolId === "actions-security"
        ? "medium"
        : "medium";

  if (result.summary) {
    const unavailable = /unavailable/i.test(result.summary);
    findings.push({
      category: result.title,
      severity: unavailable ? "info" : severity,
      detail: result.summary,
    });
  }

  if (result.rows?.length) {
    for (const row of result.rows.slice(0, 5)) {
      findings.push({
        category: result.title,
        severity: "info",
        detail:
          typeof row === "object" && row !== null
            ? Object.entries(row)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")
            : String(row),
      });
    }
  }

  return findings;
}

export function readCachedSecurityFindings(repoId: string): SecurityFinding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(CACHE_KEY(repoId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SecurityFinding[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mergeCachedSecurityFindings(
  repoId: string,
  incoming: SecurityFinding[],
): SecurityFinding[] {
  const existing = readCachedSecurityFindings(repoId);
  const seen = new Set(existing.map((f) => `${f.category}:${f.detail}`));
  const merged = [...existing];
  for (const f of incoming) {
    const key = `${f.category}:${f.detail}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(f);
    }
  }
  if (typeof window !== "undefined") {
    sessionStorage.setItem(CACHE_KEY(repoId), JSON.stringify(merged));
  }
  return merged;
}

export function clearCachedSecurityFindings(repoId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CACHE_KEY(repoId));
}
