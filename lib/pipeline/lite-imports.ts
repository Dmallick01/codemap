import { prisma } from "@/lib/db";
import { fetchRepoFilesAtPaths } from "@/lib/services/github-contents";
import { extractImportPaths } from "@/lib/graph/path-heuristics";

const MAX_FETCH = parseInt(process.env.MAX_LITE_IMPORT_FETCH || "28", 10);

/**
 * Fetch source for key UI/route files and store import paths in file summary JSON.
 */
export async function enrichLiteImports(
  repoId: string,
  repoUrl: string,
  paths: string[],
): Promise<void> {
  const candidates = paths
    .filter((p) => /\.(tsx|jsx|ts|js)$/i.test(p))
    .filter(
      (p) =>
        /(components|app\/|pages\/|hooks\/|ui\/)/i.test(p) ||
        /page\.(tsx|jsx)/i.test(p) ||
        /layout\.(tsx|jsx)/i.test(p),
    )
    .slice(0, MAX_FETCH);

  if (!candidates.length) return;

  const fetched = await fetchRepoFilesAtPaths(repoUrl, candidates);
  const byPath = new Map(fetched.map((f) => [f.path, f.content]));

  for (const filePath of candidates) {
    const content = byPath.get(filePath);
    if (!content?.trim()) continue;

    const imports = extractImportPaths(content);
    const node = await prisma.fileNode.findFirst({
      where: { repoId, path: filePath },
      select: { id: true, summary: true },
    });
    if (!node) continue;

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(node.summary || "{}");
    } catch {
      payload = { summary: node.summary ?? "" };
    }

    await prisma.fileNode.update({
      where: { id: node.id },
      data: {
        summary: JSON.stringify({
          ...payload,
          lite: true,
          imports,
        }),
      },
    });
  }
}
