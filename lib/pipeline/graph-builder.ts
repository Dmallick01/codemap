import { prisma } from "@/lib/db";
import path from "path";
import { inferArchRole } from "@/lib/graph/semantic";

/**
 * Resolve a relative import path against the importing file.
 */
function resolveImport(
  importPath: string,
  fromFilePath: string,
  allPaths: Set<string>,
): string | null {
  if (!importPath.startsWith(".")) {
    return null;
  }

  const dir = path.dirname(fromFilePath);
  let resolved = path.join(dir, importPath);
  resolved = resolved.replace(/\\/g, "/");

  const extensions = [
    "",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    "/index.ts",
    "/index.tsx",
    "/index.js",
  ];
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

  const edgeKey = new Set<string>();
  const edges: { fromId: string; toId: string; type: string; label: string }[] =
    [];

  function addEdge(
    fromId: string,
    toId: string,
    type: string,
    label: string,
  ) {
    if (fromId === toId) return;
    const key = `${fromId}|${toId}|${type}`;
    if (edgeKey.has(key)) return;
    edgeKey.add(key);
    edges.push({ fromId, toId, type, label });
  }

  for (const file of fileNodes) {
    if (!file.summary) continue;

    let imports: string[] = [];
    try {
      const parsed = JSON.parse(file.summary);
      imports = parsed.imports || [];
    } catch {
      continue;
    }

    const fromRole = inferArchRole(file.path);

    for (const imp of imports) {
      const resolvedPath = resolveImport(imp, file.path, allPaths);
      if (!resolvedPath) continue;

      const targetId = pathToId.get(resolvedPath);
      if (!targetId) continue;

      const toRole = inferArchRole(resolvedPath);
      addEdge(file.id, targetId, "imports", imp);

      // Framework flow: higher layers "power" pipeline/core targets
      if (
        (fromRole === "entry" || fromRole === "routing" || fromRole === "api") &&
        (toRole === "tool" || toRole === "core" || toRole === "data")
      ) {
        addEdge(
          file.id,
          targetId,
          "powers",
          `${fromRole} → ${toRole}`,
        );
      }
    }
  }

  // Entry files that bootstrap the app (no incoming imports in repo)
  const entryPaths = fileNodes.filter(
    (f) => inferArchRole(f.path) === "entry",
  );
  for (const entry of entryPaths) {
    for (const file of fileNodes) {
      if (file.id === entry.id) continue;
      const role = inferArchRole(file.path);
      if (role === "routing" && file.path.includes("layout")) {
        const entryDir = path.dirname(entry.path);
        if (file.path.startsWith(entryDir)) {
          addEdge(entry.id, file.id, "defines", "layout shell");
        }
      }
    }
  }

  await prisma.edge.deleteMany({
    where: {
      OR: [
        { fromId: { in: fileNodes.map((f) => f.id) } },
        { toId: { in: fileNodes.map((f) => f.id) } },
      ],
    },
  });

  if (edges.length > 0) {
    await prisma.edge.createMany({ data: edges });
  }

  const roleCounts = new Map<string, number>();
  for (const f of fileNodes) {
    const r = inferArchRole(f.path);
    roleCounts.set(r, (roleCounts.get(r) ?? 0) + 1);
  }
  const roleSummary = [...roleCounts.entries()]
    .map(([r, n]) => `${r}:${n}`)
    .join(", ");

  await prisma.job.update({
    where: { id: jobId },
    data: {
      step: "done",
      progress: edges.length,
      total: edges.length,
      log: `Built architecture graph: ${edges.length} connections across ${fileNodes.length} files (${roleSummary}).`,
    },
  });

  await prisma.repo.update({
    where: { id: repoId },
    data: { status: "done" },
  });
}
