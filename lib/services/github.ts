import { Octokit } from "@octokit/rest";
import { Open } from "unzipper";
import { Readable } from "stream";

const MAX_FILES = parseInt(process.env.MAX_FILES || "500", 10);

const PRIORITY_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java",
]);

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
]);

const IGNORED_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  ".DS_Store",
  "Thumbs.db",
]);

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp",
  ".woff", ".woff2", ".ttf", ".eot",
  ".mp3", ".mp4", ".wav", ".avi",
  ".zip", ".tar", ".gz", ".rar",
  ".pdf", ".doc", ".docx",
  ".exe", ".dll", ".so", ".dylib",
  ".wasm", ".pyc", ".class",
]);

function isIgnoredPath(filePath: string): boolean {
  const parts = filePath.split("/");
  for (const part of parts) {
    if (IGNORED_DIRS.has(part)) return true;
  }
  const fileName = parts[parts.length - 1];
  if (IGNORED_FILES.has(fileName)) return true;
  if (fileName.startsWith(".") && fileName !== ".env.example") return true;

  const ext = fileName.includes(".") ? "." + fileName.split(".").pop()! : "";
  if (BINARY_EXTENSIONS.has(ext.toLowerCase())) return true;

  return false;
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const cleaned = url.replace(/\.git$/, "").replace(/\/$/, "");
  const match = cleaned.match(
    /(?:github\.com\/|^)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/
  );
  if (!match) throw new Error(`Invalid GitHub URL: ${url}`);
  return { owner: match[1], repo: match[2] };
}

export async function fetchRepoFiles(
  url: string
): Promise<Map<string, string>> {
  const { owner, repo } = parseGitHubUrl(url);

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined,
  });

  const { data } = await octokit.repos.downloadZipballArchive({
    owner,
    repo,
    ref: "HEAD",
  });

  const buffer = Buffer.from(data as ArrayBuffer);
  const directory = await Open.buffer(buffer);

  const files = new Map<string, string>();

  for (const entry of directory.files) {
    if (entry.type === "Directory") continue;

    // Strip the top-level dir (GitHub adds owner-repo-sha/)
    const parts = entry.path.split("/");
    const relativePath = parts.slice(1).join("/");

    if (!relativePath || isIgnoredPath(relativePath)) continue;

    try {
      const content = await entry.buffer();
      const text = content.toString("utf-8");
      // Skip files that look binary (contain null bytes)
      if (text.includes("\0")) continue;
      files.set(relativePath, text);
    } catch {
      // Skip files that can't be read as text
    }
  }

  if (files.size > MAX_FILES) {
    const priorityFiles = new Map<string, string>();
    const otherFiles = new Map<string, string>();

    for (const [filePath, content] of files) {
      const ext = filePath.includes(".") ? "." + filePath.split(".").pop()! : "";
      if (PRIORITY_EXTENSIONS.has(ext.toLowerCase())) {
        priorityFiles.set(filePath, content);
      } else {
        otherFiles.set(filePath, content);
      }
    }

    const result = new Map<string, string>();
    for (const [filePath, content] of priorityFiles) {
      if (result.size >= MAX_FILES) break;
      result.set(filePath, content);
    }
    for (const [filePath, content] of otherFiles) {
      if (result.size >= MAX_FILES) break;
      result.set(filePath, content);
    }
    return result;
  }

  return files;
}

export async function getRepoMetadata(url: string) {
  const { owner, repo } = parseGitHubUrl(url);
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined,
  });
  const { data } = await octokit.repos.get({ owner, repo });
  return {
    name: data.full_name,
    description: data.description,
    defaultBranch: data.default_branch,
    language: data.language,
    stars: data.stargazers_count,
  };
}
