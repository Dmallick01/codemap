import { prisma } from "@/lib/db";
import path from "path";

/**
 * Resolve a relative import path against the importing file.
 * e.g. "./utils" from "src/components/App.tsx" -> "src/components/utils"
 */
function resolveImport(
  importPath: string,
  fromFilePath: string,
  allPaths: Set<string>
): string | null {
  if (!importPath.startsWith(".")) {
    // External package import — skip
    return null;
  }

  const dir = path.dirname(fromFilePath);
  let resolved = path.join(dir, importPath);
  // Normalize path separators
  resolved = resolved.replace(/\\/g, "/");

  // Try exact match, then with common extensions
  const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (allPaths.has(candidate)) return candidate;
  }

  return null;
}

export async function buildDependencyGraph(repoId: string, jobId: string) {
  const fileNodes = await prisma.fileNode.findMany({
    where: { repoId },
    select: { id: true, path: true, summary: true },
  });

  const pathToId = new Map(fileNodes.map((f) => [f.path, f.id]));
  const allPaths = new Set(fileNodes.map((f) => f.path));

  const edges: { fromId: string; toId: string; type: string; label: string }[] = [];

  for (const file of fileNodes) {
    if (!file.summary) continue;

    let imports: string[] = [];
    try {
      const parsed = JSON.parse(file.summary);
      imports = parsed.imports || [];
    } catch {
      continue;
    }

    for (const imp of imports) {
      const resolvedPath = resolveImport(imp, file.path, allPaths);
      if (!resolvedPath) continue;

      const targetId = pathToId.get(resolvedPath);
      if (!targetId || targetId === file.id) continue;

      edges.push({
        fromId: file.id,
        toId: targetId,
        type: "imports",
        label: imp,
      });
    }
  }

  if (edges.length > 0) {
    await prisma.edge.createMany({ data: edges });
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      step: "done",
      progress: edges.length,
      total: edges.length,
      log: `Built dependency graph: ${edges.length} edges between ${fileNodes.length} files.`,
    },
  });

  await prisma.repo.update({
    where: { id: repoId },
    data: { status: "done" },
  });
}
