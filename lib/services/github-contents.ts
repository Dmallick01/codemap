import { Octokit } from "@octokit/rest";
import { parseGitHubUrl } from "@/lib/services/github";

const MAX_BYTES_PER_FILE = parseInt(
  process.env.MAX_EXPORT_BYTES_PER_FILE || "32000",
  10,
);
const MAX_TOTAL_BYTES = parseInt(
  process.env.MAX_EXPORT_TOTAL_BYTES || "200000",
  10,
);

function octokit() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });
}

export type FetchedFile = {
  path: string;
  content: string;
  truncated: boolean;
  error?: string;
};

/**
 * Fetch raw source for specific paths only (selective gitingest).
 */
export async function fetchRepoFilesAtPaths(
  repoUrl: string,
  paths: string[],
): Promise<FetchedFile[]> {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const api = octokit();
  const unique = [...new Set(paths)].filter(Boolean);
  const results: FetchedFile[] = [];
  let totalBytes = 0;

  for (const path of unique) {
    if (totalBytes >= MAX_TOTAL_BYTES) {
      results.push({
        path,
        content: "",
        truncated: true,
        error: "Bundle size cap reached",
      });
      continue;
    }

    try {
      const { data } = await api.repos.getContent({ owner, repo, path });
      if (Array.isArray(data) || data.type !== "file") {
        results.push({
          path,
          content: "",
          truncated: false,
          error: "Not a file",
        });
        continue;
      }
      if (!("content" in data) || !data.content) {
        results.push({
          path,
          content: "",
          truncated: false,
          error: "Empty content",
        });
        continue;
      }

      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      if (decoded.includes("\0")) {
        results.push({
          path,
          content: "",
          truncated: false,
          error: "Binary file skipped",
        });
        continue;
      }

      const overFile = decoded.length > MAX_BYTES_PER_FILE;
      const slice = overFile
        ? decoded.slice(0, MAX_BYTES_PER_FILE)
        : decoded;
      const room = MAX_TOTAL_BYTES - totalBytes;
      const final =
        slice.length > room ? slice.slice(0, room) : slice;
      const truncated = overFile || final.length < decoded.length;

      totalBytes += Buffer.byteLength(final, "utf-8");
      results.push({ path, content: final, truncated });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        path,
        content: "",
        truncated: false,
        error: message,
      });
    }
  }

  return results;
}
