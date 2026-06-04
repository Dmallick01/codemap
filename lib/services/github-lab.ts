import { Octokit } from "@octokit/rest";
import { parseGitHubUrl } from "@/lib/services/github";
import { fetchRepoTreePaths } from "@/lib/services/github-lite";
import type { LabToolId } from "@/lib/github/lab-tool-registry";

export type LabToolResult = {
  ok: boolean;
  toolId: LabToolId;
  title: string;
  summary?: string;
  metrics?: { label: string; value: string | number }[];
  rows?: Record<string, string | number | null>[];
  text?: string;
  error?: string;
};

function api() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });
}

function ctx(url: string) {
  const { owner, repo } = parseGitHubUrl(url);
  return { owner, repo, url };
}

export async function runGitHubLabTool(
  toolId: LabToolId,
  repoUrl: string,
  options?: { path?: string; query?: string; treePaths?: string[] },
): Promise<LabToolResult> {
  try {
    switch (toolId) {
      case "repo-pulse":
        return await repoPulse(repoUrl);
      case "commit-radar":
        return await commitRadar(repoUrl);
      case "contributor-spectrum":
        return await contributorSpectrum(repoUrl);
      case "branch-map":
        return await branchMap(repoUrl);
      case "tag-catalog":
        return await tagCatalog(repoUrl);
      case "issue-telemetry":
        return await issueTelemetry(repoUrl);
      case "pr-flow":
        return await prFlow(repoUrl);
      case "language-mix":
        return await languageMix(repoUrl);
      case "code-search":
        return await codeSearch(repoUrl, options?.query);
      case "tree-density":
        return await treeDensity(repoUrl, options?.treePaths);
      case "readme-lab":
        return await readmeLab(repoUrl);
      case "license-scan":
        return await licenseScan(repoUrl);
      case "actions-pulse":
        return await actionsPulse(repoUrl);
      case "ref-compare":
        return await refCompare(repoUrl);
      case "file-chronicle":
        return await fileChronicle(repoUrl, options?.path);
      case "rate-limit":
        return await rateLimitCheck();
      case "manifest-radar":
        return await manifestRadar(repoUrl, options?.treePaths);
      case "topic-cluster":
        return await topicCluster(repoUrl);
      case "clone-matrix":
        return await cloneMatrix(repoUrl);
      case "traffic-stats":
        return await trafficStats(repoUrl);
      default:
        return fail(toolId, "Unknown tool");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "GitHub API error";
    return fail(toolId, msg);
  }
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

async function repoPulse(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const { data } = await api().repos.get({ owner, repo });
  return ok("repo-pulse", "Repository pulse", {
    summary: data.description ?? "No description",
    metrics: [
      { label: "Stars", value: data.stargazers_count },
      { label: "Forks", value: data.forks_count },
      { label: "Watchers", value: data.subscribers_count },
      { label: "Open issues", value: data.open_issues_count },
      { label: "Size (KB)", value: data.size },
      { label: "Default branch", value: data.default_branch },
      { label: "License", value: data.license?.spdx_id ?? "—" },
      { label: "Archived", value: data.archived ? "yes" : "no" },
      { label: "Private", value: data.private ? "yes" : "no" },
      { label: "Created", value: data.created_at?.slice(0, 10) ?? "—" },
      { label: "Updated", value: data.pushed_at?.slice(0, 10) ?? "—" },
    ],
  });
}

async function commitRadar(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const { data } = await api().repos.listCommits({ owner, repo, per_page: 12 });
  return ok("commit-radar", "Commit radar", {
    summary: `${data.length} recent commits`,
    rows: data.map((c) => ({
      sha: c.sha.slice(0, 7),
      author: c.commit.author?.name ?? c.author?.login ?? "—",
      message: (c.commit.message?.split("\n")[0] ?? "").slice(0, 72),
      date: c.commit.author?.date?.slice(0, 10) ?? "—",
    })),
  });
}

async function contributorSpectrum(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const { data } = await api().repos.listContributors({
    owner,
    repo,
    per_page: 15,
  });
  return ok("contributor-spectrum", "Contributor spectrum", {
    rows: data.map((c) => ({
      login: c.login ?? "—",
      contributions: c.contributions ?? 0,
      type: c.type ?? "—",
    })),
  });
}

async function branchMap(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const { data: repoData } = await api().repos.get({ owner, repo });
  const { data } = await api().repos.listBranches({ owner, repo, per_page: 30 });
  return ok("branch-map", "Branch map", {
    summary: `Default: ${repoData.default_branch}`,
    rows: data.map((b) => ({
      name: b.name,
      sha: b.commit.sha.slice(0, 7),
      protected: b.protected ? "yes" : "no",
    })),
  });
}

async function tagCatalog(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const { data } = await api().repos.listTags({ owner, repo, per_page: 15 });
  return ok("tag-catalog", "Tag catalog", {
    rows: data.map((t) => ({
      tag: t.name,
      sha: t.commit.sha.slice(0, 7),
    })),
  });
}

async function issueTelemetry(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const api_ = api();
  const [{ data: repoData }, labels] = await Promise.all([
    api_.repos.get({ owner, repo }),
    api_.issues.listLabelsForRepo({ owner, repo, per_page: 20 }),
  ]);
  return ok("issue-telemetry", "Issue telemetry", {
    metrics: [
      { label: "Open issues", value: repoData.open_issues_count },
      { label: "Has issues", value: repoData.has_issues ? "yes" : "no" },
    ],
    rows: labels.data.map((l) => ({
      label: l.name,
      color: l.color,
      default: l.default ? "yes" : "no",
    })),
  });
}

async function prFlow(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const { data } = await api().pulls.list({
    owner,
    repo,
    state: "all",
    per_page: 12,
    sort: "updated",
  });
  return ok("pr-flow", "PR flow", {
    rows: data.map((p) => ({
      number: p.number,
      title: (p.title ?? "").slice(0, 56),
      state: p.state,
      user: p.user?.login ?? "—",
      updated: p.updated_at?.slice(0, 10) ?? "—",
    })),
  });
}

async function languageMix(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const { data } = await api().repos.listLanguages({ owner, repo });
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const rows = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, bytes]) => ({
      language: lang,
      bytes,
      percent: total ? `${((bytes / total) * 100).toFixed(1)}%` : "0%",
    }));
  return ok("language-mix", "Language mix", {
    summary: `${rows.length} languages detected`,
    rows,
  });
}

async function codeSearch(
  url: string,
  query?: string,
): Promise<LabToolResult> {
  if (!query?.trim()) {
    return fail("code-search", "Provide a search query (q parameter)");
  }
  const { owner, repo } = ctx(url);
  const q = `${query.trim()} repo:${owner}/${repo}`;
  const { data } = await api().search.code({ q, per_page: 15 });
  return ok("code-search", "Code search", {
    summary: `${data.total_count} matches (showing ${data.items.length})`,
    rows: data.items.map((item) => ({
      path: item.path,
      sha: item.sha?.slice(0, 7) ?? "—",
      score: item.score ?? 0,
    })),
  });
}

async function treeDensity(
  url: string,
  cachedPaths?: string[],
): Promise<LabToolResult> {
  const paths = cachedPaths?.length
    ? cachedPaths
    : await fetchRepoTreePaths(url);
  const extCount: Record<string, number> = {};
  let maxDepth = 0;
  for (const p of paths) {
    const depth = p.split("/").length;
    if (depth > maxDepth) maxDepth = depth;
    const ext = p.includes(".") ? p.split(".").pop()!.toLowerCase() : "(none)";
    extCount[ext] = (extCount[ext] ?? 0) + 1;
  }
  const rows = Object.entries(extCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([ext, count]) => ({ extension: ext, files: count }));
  return ok("tree-density", "Tree density", {
    metrics: [
      { label: "Files", value: paths.length },
      { label: "Max depth", value: maxDepth },
    ],
    rows,
  });
}

async function readmeLab(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const api_ = api();
  let text: string | null = null;
  let path = "";
  for (const p of ["README.md", "readme.md", "README.MD", "README"]) {
    try {
      const { data } = await api_.repos.getContent({ owner, repo, path: p });
      if (!Array.isArray(data) && data.type === "file" && "content" in data) {
        text = Buffer.from(data.content, "base64").toString("utf-8");
        path = p;
        break;
      }
    } catch {
      continue;
    }
  }
  if (!text) return fail("readme-lab", "No README found");
  const lines = text.split("\n");
  const headings = lines.filter((l) => /^#{1,6}\s/.test(l)).length;
  return ok("readme-lab", "README lab", {
    metrics: [
      { label: "Path", value: path },
      { label: "Lines", value: lines.length },
      { label: "Headings", value: headings },
      { label: "Chars", value: text.length },
    ],
    text: text.slice(0, 2400),
  });
}

async function licenseScan(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const api_ = api();
  const candidates = [
    "LICENSE",
    "LICENSE.md",
    "LICENSE.txt",
    "COPYING",
    "COPYING.md",
  ];
  for (const path of candidates) {
    try {
      const { data } = await api_.repos.getContent({ owner, repo, path });
      if (!Array.isArray(data) && data.type === "file" && "content" in data) {
        const text = Buffer.from(data.content, "base64")
          .toString("utf-8")
          .slice(0, 800);
        return ok("license-scan", "License scan", {
          summary: `Found ${path}`,
          text,
        });
      }
    } catch {
      continue;
    }
  }
  const { data: repoData } = await api_.repos.get({ owner, repo });
  return ok("license-scan", "License scan", {
    summary: repoData.license
      ? `SPDX: ${repoData.license.spdx_id}`
      : "No LICENSE file; check repo metadata",
    metrics: [
      { label: "SPDX", value: repoData.license?.spdx_id ?? "—" },
      { label: "Name", value: repoData.license?.name ?? "—" },
    ],
  });
}

async function actionsPulse(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const { data } = await api().actions.listWorkflowRunsForRepo({
    owner,
    repo,
    per_page: 10,
  });
  return ok("actions-pulse", "Actions pulse", {
    rows: (data.workflow_runs ?? []).map((r) => ({
      name: r.name ?? "—",
      status: r.status ?? "—",
      conclusion: r.conclusion ?? "—",
      branch: r.head_branch ?? "—",
      created: r.created_at?.slice(0, 16) ?? "—",
    })),
  });
}

async function refCompare(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const api_ = api();
  const { data: repoData } = await api_.repos.get({ owner, repo });
  const base = repoData.default_branch;
  const { data: tags } = await api_.repos.listTags({ owner, repo, per_page: 1 });
  const head = tags[0]?.name;
  if (!head) {
    return ok("ref-compare", "Ref compare", {
      summary: "No tags to compare against default branch",
    });
  }
  const { data } = await api_.repos.compareCommits({
    owner,
    repo,
    base,
    head,
  });
  return ok("ref-compare", "Ref compare", {
    summary: `${base} ↔ ${head}`,
    metrics: [
      { label: "Ahead by", value: data.ahead_by },
      { label: "Behind by", value: data.behind_by },
      { label: "Total commits", value: data.total_commits },
      { label: "Files changed", value: data.files?.length ?? 0 },
    ],
  });
}

async function fileChronicle(
  url: string,
  path?: string,
): Promise<LabToolResult> {
  if (!path?.trim()) {
    return fail("file-chronicle", "Select a file on the map or pass path");
  }
  const { owner, repo } = ctx(url);
  const { data } = await api().repos.listCommits({
    owner,
    repo,
    path: path.trim(),
    per_page: 5,
  });
  return ok("file-chronicle", "File chronicle", {
    summary: path,
    rows: data.map((c) => ({
      sha: c.sha.slice(0, 7),
      author: c.commit.author?.name ?? "—",
      message: (c.commit.message?.split("\n")[0] ?? "").slice(0, 64),
      date: c.commit.author?.date?.slice(0, 10) ?? "—",
    })),
  });
}

async function rateLimitCheck(): Promise<LabToolResult> {
  const { data } = await api().rateLimit.get();
  const core = data.rate;
  const search = data.resources.search;
  return ok("rate-limit", "Rate limit", {
    metrics: [
      { label: "Core remaining", value: core.remaining },
      { label: "Core limit", value: core.limit },
      { label: "Resets at", value: new Date(core.reset * 1000).toISOString() },
      { label: "Search remaining", value: search.remaining },
      { label: "Search limit", value: search.limit },
    ],
  });
}

const MANIFEST_PATHS = [
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "requirements.txt",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "Gemfile",
  "composer.json",
];

async function manifestRadar(
  url: string,
  cachedPaths?: string[],
): Promise<LabToolResult> {
  const paths = cachedPaths?.length
    ? cachedPaths
    : await fetchRepoTreePaths(url);
  const set = new Set(paths);
  const found = MANIFEST_PATHS.filter(
    (m) => set.has(m) || paths.some((p) => p.endsWith(`/${m}`) || p === m),
  );
  const rows = found.map((path) => {
    const full = paths.find((p) => p === path || p.endsWith(`/${path}`)) ?? path;
    return { manifest: full };
  });
  return ok("manifest-radar", "Manifest radar", {
    summary: `${rows.length} dependency manifests`,
    rows,
  });
}

async function topicCluster(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const { data } = await api().repos.get({ owner, repo });
  const tokens = (data.description ?? "")
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((t) => t.length > 2);
  return ok("topic-cluster", "Topic cluster", {
    summary: data.description ?? "—",
    metrics: [
      { label: "Topics", value: (data.topics ?? []).join(", ") || "—" },
      { label: "Homepage", value: data.homepage ?? "—" },
    ],
    rows: (data.topics ?? []).map((t) => ({ topic: t })),
    text: tokens.length ? `Description tokens: ${tokens.join(", ")}` : undefined,
  });
}

async function cloneMatrix(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const { data } = await api().repos.get({ owner, repo });
  return ok("clone-matrix", "Clone matrix", {
    rows: [
      { type: "HTTPS", url: data.clone_url ?? "—" },
      { type: "SSH", url: data.ssh_url ?? "—" },
      { type: "Git", url: data.git_url ?? "—" },
      {
        type: "Zipball",
        url: `https://api.github.com/repos/${owner}/${repo}/zipball/${data.default_branch}`,
      },
      {
        type: "Tarball",
        url: `https://api.github.com/repos/${owner}/${repo}/tarball/${data.default_branch}`,
      },
    ],
  });
}

async function trafficStats(url: string): Promise<LabToolResult> {
  const { owner, repo } = ctx(url);
  const api_ = api();
  try {
    const [clones, views] = await Promise.all([
      api_.repos.getClones({ owner, repo, per: "day" }),
      api_.repos.getViews({ owner, repo, per: "day" }),
    ]);
    const cloneRows = (clones.data.clones ?? []).slice(-7).map((c) => ({
      period: "clone",
      timestamp: c.timestamp,
      count: c.count,
      uniques: c.uniques,
    }));
    const viewRows = (views.data.views ?? []).slice(-7).map((v) => ({
      period: "view",
      timestamp: v.timestamp,
      count: v.count,
      uniques: v.uniques,
    }));
    return ok("traffic-stats", "Traffic stats", {
      summary: "Last 7 days (requires repo admin for private repos)",
      rows: [...cloneRows, ...viewRows] as Record<string, string | number>[],
    });
  } catch {
    return fail(
      "traffic-stats",
      "Traffic API requires push/admin access or may be unavailable",
    );
  }
}
