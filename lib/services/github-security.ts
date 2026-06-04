import { Octokit } from "@octokit/rest";
import { parseGitHubUrl } from "@/lib/services/github";
import type { LabToolId } from "@/lib/github/lab-tool-registry";
import type { LabToolResult } from "@/lib/services/github-lab";

function api() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });
}

function ctx(url: string) {
  const { owner, repo } = parseGitHubUrl(url);
  return { owner, repo };
}

function ok(
  toolId: LabToolId,
  title: string,
  data: Partial<Omit<LabToolResult, "ok" | "toolId" | "title">>,
): LabToolResult {
  return { ok: true, toolId, title, ...data };
}

function fail(toolId: LabToolId, error: string): LabToolResult {
  return { ok: false, toolId, title: toolId, error };
}

const SECRET_PATH_RE =
  /(\.env$|\.env\.|secret|credential|private[_-]?key|\.pem$|id_rsa|token\.json|secrets\.)/i;

const AUTH_PATH_RE =
  /(middleware|\/auth\/|\/login|sign-?in|sign-?up|session|oauth|passport|clerk|next-auth|protected)/i;

export async function runSecurityLabTool(
  toolId: LabToolId,
  repoUrl: string,
  options?: { treePaths?: string[] },
): Promise<LabToolResult> {
  try {
    switch (toolId) {
      case "dependency-advisories":
        return await dependencyAdvisories(repoUrl);
      case "secret-surface":
        return secretSurface(options?.treePaths ?? []);
      case "auth-surface-map":
        return authSurfaceMap(options?.treePaths ?? []);
      case "actions-security":
        return await actionsSecurity(repoUrl);
      case "code-scanning":
        return await codeScanning(repoUrl);
      default:
        return fail(toolId, "Unknown security tool");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Security API error";
    return fail(toolId, msg);
  }
}

async function dependencyAdvisories(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  try {
    const { data } = await api().dependabot.listAlertsForRepo({
      owner,
      repo,
      per_page: 20,
      state: "open",
    });
    return ok("dependency-advisories", "Dependency advisories", {
      summary: `${data.length} open Dependabot alert(s) shown`,
      rows: data.map((a) => ({
        package: a.security_advisory?.summary ?? a.dependency?.package?.name ?? "—",
        severity: a.security_advisory?.severity ?? "—",
        cve: a.security_advisory?.cve_id ?? "—",
        created: a.created_at?.slice(0, 10) ?? "—",
      })),
    });
  } catch {
    return ok("dependency-advisories", "Dependency advisories", {
      summary:
        "Dependabot alerts unavailable (needs repo access + GITHUB_TOKEN with security events).",
      metrics: [
        {
          label: "Tip",
          value: "Enable Dependabot alerts on the repository",
        },
      ],
    });
  }
}

function secretSurface(paths: string[]): Promise<LabToolResult> {
  const hits = paths.filter((p) => SECRET_PATH_RE.test(p)).slice(0, 30);
  return Promise.resolve(
    ok("secret-surface", "Secret surface scan", {
      summary: `${hits.length} sensitive path(s) in map tree`,
      rows: hits.map((p) => ({
        path: p,
        risk: p.includes(".env") ? "high" : "medium",
        action: "Ensure not committed; use env/secret manager",
      })),
      text: hits.length
        ? undefined
        : "No obvious secret filenames in map. Still run secret scanning in CI.",
    }),
  );
}

function authSurfaceMap(paths: string[]): Promise<LabToolResult> {
  const hits = paths.filter((p) => AUTH_PATH_RE.test(p)).slice(0, 30);
  return Promise.resolve(
    ok("auth-surface-map", "Auth surface map", {
      summary: `${hits.length} auth-related path(s)`,
      rows: hits.map((p) => ({
        path: p,
        layer: p.includes("middleware") ? "edge" : "app",
      })),
    }),
  );
}

async function actionsSecurity(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const api_ = api();
  const { data: workflows } = await api_.actions.listRepoWorkflows({
    owner,
    repo,
  });
  const rows: Record<string, string>[] = [];
  for (const w of (workflows.workflows ?? []).slice(0, 12)) {
    rows.push({
      name: w.name ?? "—",
      path: w.path ?? "—",
      state: w.state ?? "—",
      badge: w.badge_url ? "yes" : "no",
    });
  }
  return ok("actions-security", "Actions security", {
    summary: `${workflows.total_count ?? rows.length} workflow(s)`,
    rows,
    text: "Review workflow permissions (contents, packages, id-token). Prefer least privilege and pinned action SHAs.",
  });
}

async function codeScanning(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  try {
    const { data } = await api().codeScanning.listAlertsForRepo({
      owner,
      repo,
      per_page: 15,
      state: "open",
    });
    return ok("code-scanning", "Code scanning", {
      summary: `${data.length} open code scanning alert(s)`,
      rows: data.map((a) => ({
        rule: a.rule?.id ?? "—",
        severity: a.rule?.severity ?? "—",
        tool: a.tool?.name ?? "—",
        created: a.created_at?.slice(0, 10) ?? "—",
      })),
    });
  } catch {
    return ok("code-scanning", "Code scanning", {
      summary: "Code scanning alerts not available for this repo/token.",
      metrics: [{ label: "Enable", value: "GitHub Advanced Security or CodeQL workflow" }],
    });
  }
}
