import { Octokit } from "@octokit/rest";
import { parseGitHubUrl } from "@/lib/services/github";

export async function commitDesignMdToGitHub(
  repoUrl: string,
  content: string,
): Promise<{ ok: true; sha: string } | { ok: false; error: string }> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    return { ok: false, error: "GITHUB_TOKEN required to commit DESIGN.md" };
  }

  const { owner, repo } = parseGitHubUrl(repoUrl);
  const octokit = new Octokit({ auth: token });
  const path = "DESIGN.md";

  try {
    let sha: string | undefined;
    try {
      const existing = await octokit.repos.getContent({ owner, repo, path });
      if (!Array.isArray(existing.data) && existing.data.type === "file") {
        sha = existing.data.sha;
      }
    } catch {
      /* new file */
    }

    const res = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: "chore: update DESIGN.md from CodeMap UI Studio",
      content: Buffer.from(content, "utf8").toString("base64"),
      sha,
    });

    return { ok: true, sha: res.data.commit.sha ?? "" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "GitHub commit failed";
    return { ok: false, error: msg };
  }
}
