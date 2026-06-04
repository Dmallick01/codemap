import { prisma } from "@/lib/db";
import { fetchRepoFilesAtPaths } from "@/lib/services/github-contents";
import { extractImportPaths } from "@/lib/graph/path-heuristics";
import type { LiteGraphFile } from "./lite-edges";

const MAX_FETCH = parseInt(process.env.MAX_LITE_IMPORT_FETCH || "28", 10);

function mergeImportsIntoSummary(
  summaryJson: string | null,
  imports: string[],
): string {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(summaryJson || "{}");
  } catch {
    payload = { summary: summaryJson ?? "" };
  }
  return JSON.stringify({ ...payload, imports });
}

/** Update in-memory file rows (snapshot pipeline). */
export async function enrichImportsInMemory(
  files: LiteGraphFile[],
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

  for (const file of files) {
    const content = byPath.get(file.path);
    if (!content?.trim()) continue;
    const imports = extractImportPaths(content);
    file.summary = mergeImportsIntoSummary(file.summary, imports);
  }
}

/** Legacy: per-file DB rows (deep / old lite only). */
export async function enrichLiteImports(
  repoId: string,
  repoUrl: string,
  paths: string[],
): Promise<void> {
  const candidates = paths
    .filter((p) => /\.(tsx|jsx|ts|js)$/i.test(p))
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

    await prisma.fileNode.update({
      where: { id: node.id },
      data: { summary: mergeImportsIntoSummary(node.summary, imports) },
    });
  }
}
