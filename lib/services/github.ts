import { Octokit } from "@octokit/rest";
import { Open } from "unzipper";

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

function getExtension(filePath: string): string {
  return filePath.includes(".") ? "." + filePath.split(".").pop()! : "";
}

function isPriorityPath(filePath: string): boolean {
  return PRIORITY_EXTENSIONS.has(getExtension(filePath).toLowerCase());
}

function relativePathFromEntry(entryPath: string): string | null {
  const parts = entryPath.split("/");
  const relativePath = parts.slice(1).join("/");
  if (!relativePath || isIgnoredPath(relativePath)) return null;
  return relativePath;
}

function selectPathsForProcessing(paths: string[]): string[] {
  if (paths.length <= MAX_FILES) return paths;

  const priority: string[] = [];
  const other: string[] = [];

  for (const filePath of paths) {
    if (isPriorityPath(filePath)) {
      priority.push(filePath);
    } else {
      other.push(filePath);
    }
  }

  const result: string[] = [];
  for (const filePath of priority) {
    if (result.length >= MAX_FILES) break;
    result.push(filePath);
  }
  for (const filePath of other) {
    if (result.length >= MAX_FILES) break;
    result.push(filePath);
  }
  return result;
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const cleaned = url.replace(/\.git$/, "").replace(/\/$/, "");
  const match = cleaned.match(
    /(?:github\.com\/|^)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/
  );
  if (!match) throw new Error(`Invalid GitHub URL: ${url}`);
  return { owner: match[1], repo: match[2] };
}

async function downloadZipDirectory(url: string) {
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
  return Open.buffer(buffer);
}

/**
 * Stream repository files entry-by-entry, invoking onFile for each text file.
 * Respects MAX_FILES with priority extension ordering when over limit.
 */
export async function fetchRepoFilesStreaming(
  url: string,
  onFile: (path: string, content: string) => Promise<void>,
  onBegin?: (totalExtracted: number) => void | Promise<void>
): Promise<{ totalExtracted: number; processed: number }> {
  const directory = await downloadZipDirectory(url);

  type ZipFile = (typeof directory.files)[number];
  const fileEntries: { path: string; entry: ZipFile }[] = [];

  for (const entry of directory.files) {
    if (entry.type === "Directory") continue;
    const relativePath = relativePathFromEntry(entry.path);
    if (!relativePath) continue;
    fileEntries.push({ path: relativePath, entry });
  }

  const totalExtracted = fileEntries.length;
  if (onBegin) await onBegin(totalExtracted);
  const pathsToProcess = selectPathsForProcessing(
    fileEntries.map((f) => f.path)
  );
  const pathSet = new Set(pathsToProcess);

  let processed = 0;

  for (const { path, entry } of fileEntries) {
    if (!pathSet.has(path)) continue;

    try {
      const content = await entry.buffer();
      const text = content.toString("utf-8");
      if (text.includes("\0")) continue;

      await onFile(path, text);
      processed++;
    } catch {
      // Skip files that can't be read as text
    }
  }

  return { totalExtracted, processed };
}

/** Collect all files into a Map (backward-compatible wrapper). */
export async function fetchRepoFiles(
  url: string
): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  await fetchRepoFilesStreaming(url, async (path, content) => {
    files.set(path, content);
  });
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
