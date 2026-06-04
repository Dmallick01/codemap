import { Octokit } from "@octokit/rest";
import { parseGitHubUrl } from "@/lib/services/github";

const MAX_TREE_PATHS = parseInt(process.env.MAX_LITE_TREE_PATHS || "400", 10);

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "__pycache__",
  ".venv",
  "venv",
  "dist",
  "build",
  ".cache",
  "coverage",
  "vendor",
  "target",
  ".turbo",
  ".vercel",
]);

const IGNORED_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
]);

function octokit() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });
}

function isIgnoredPath(filePath: string): boolean {
  const parts = filePath.split("/");
  for (const part of parts) {
    if (IGNORED_DIRS.has(part)) return true;
  }
  const fileName = parts[parts.length - 1];
  if (IGNORED_FILES.has(fileName)) return true;
  if (fileName.startsWith(".") && fileName !== ".env.example") return true;
  return false;
}

export type RepoOverview = {
  name: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  stars: number;
  topics: string[];
};

export async function fetchRepoOverview(url: string): Promise<RepoOverview> {
  const { owner, repo } = parseGitHubUrl(url);
  const { data } = await octokit().repos.get({ owner, repo });
  return {
    name: data.full_name,
    description: data.description,
    defaultBranch: data.default_branch,
    language: data.language,
    stars: data.stargazers_count,
    topics: data.topics ?? [],
  };
}

/**
 * List file paths via Git Trees API — no zip download, no file contents.
 */
export async function fetchRepoTreePaths(url: string): Promise<string[]> {
  const { owner, repo } = parseGitHubUrl(url);
  const api = octokit();

  const { data: repoData } = await api.repos.get({ owner, repo });
  const branch = repoData.default_branch;

  const { data: refData } = await api.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });

  const commitSha = refData.object.sha;
  const { data: commitData } = await api.git.getCommit({
    owner,
    repo,
    commit_sha: commitSha,
  });

  const { data: treeData } = await api.git.getTree({
    owner,
    repo,
    tree_sha: commitData.tree.sha,
    recursive: "true",
  });

  const paths: string[] = [];
  for (const item of treeData.tree) {
    if (item.type !== "blob" || !item.path) continue;
    if (isIgnoredPath(item.path)) continue;
    paths.push(item.path);
    if (paths.length >= MAX_TREE_PATHS) break;
  }

  return paths.sort((a, b) => a.localeCompare(b));
}

/** First ~600 chars of README for the overview panel. */
export async function fetchReadmePreview(url: string): Promise<string | null> {
  const { owner, repo } = parseGitHubUrl(url);
  const api = octokit();

  for (const path of ["README.md", "readme.md", "README.MD", "README"]) {
    try {
      const { data } = await api.repos.getContent({ owner, repo, path });
      if (Array.isArray(data) || data.type !== "file") continue;
      if ("content" in data && data.content) {
        const decoded = Buffer.from(data.content, "base64").toString("utf-8");
        return decoded.slice(0, 600).trim();
      }
    } catch {
      continue;
    }
  }
  return null;
}
