import { prisma } from "@/lib/db";
import type { FetchedFile } from "@/lib/services/github-contents";

const MAX_BYTES_PER_FILE = parseInt(
  process.env.MAX_EXPORT_BYTES_PER_FILE || "32000",
  10,
);
const MAX_TOTAL_BYTES = parseInt(
  process.env.MAX_EXPORT_TOTAL_BYTES || "200000",
  10,
);

type FnRow = {
  name: string;
  code: string;
  startLine: number;
  endLine: number;
};

function stitchFunctions(functions: FnRow[]): string {
  const sorted = [...functions].sort((a, b) => a.startLine - b.startLine);
  return sorted
    .map(
      (f) =>
        `// --- ${f.name} (lines ${f.startLine}-${f.endLine}) ---\n${f.code}`,
    )
    .join("\n\n");
}

function capContent(
  path: string,
  raw: string,
  totalBytes: { value: number },
): FetchedFile {
  if (!raw.trim()) {
    return {
      path,
      content: "",
      truncated: false,
      error: "No parsed functions in database",
      source: "database",
    };
  }

  if (totalBytes.value >= MAX_TOTAL_BYTES) {
    return {
      path,
      content: "",
      truncated: true,
      error: "Bundle size cap reached",
      source: "database",
    };
  }

  const overFile = raw.length > MAX_BYTES_PER_FILE;
  let content = overFile ? raw.slice(0, MAX_BYTES_PER_FILE) : raw;
  const room = MAX_TOTAL_BYTES - totalBytes.value;
  if (content.length > room) content = content.slice(0, room);
  const truncated = overFile || content.length < raw.length;
  totalBytes.value += Buffer.byteLength(content, "utf-8");

  return { path, content, truncated, source: "database" };
}

/**
 * Reconstruct file snippets from stored FunctionNode.code (deep ingest only).
 */
export async function fetchDeepSnippetsFromDb(
  repoId: string,
  paths: string[],
): Promise<FetchedFile[]> {
  const unique = [...new Set(paths)].filter(Boolean);
  if (!unique.length) return [];

  const fileNodes = await prisma.fileNode.findMany({
    where: { repoId, path: { in: unique } },
    select: {
      id: true,
      path: true,
      moduleNodes: {
        select: {
          functionNodes: {
            select: {
              name: true,
              code: true,
              startLine: true,
              endLine: true,
            },
            orderBy: { startLine: "asc" },
          },
        },
      },
    },
  });

  const byPath = new Map(fileNodes.map((f) => [f.path, f]));
  const fileIds = fileNodes.map((f) => f.id);

  const looseByFile = new Map<string, FnRow[]>();
  if (fileIds.length) {
    const loose = await prisma.functionNode.findMany({
      where: { fileNodeId: { in: fileIds } },
      select: {
        fileNodeId: true,
        name: true,
        code: true,
        startLine: true,
        endLine: true,
      },
      orderBy: { startLine: "asc" },
    });
    for (const fn of loose) {
      if (!fn.fileNodeId || !fn.code?.trim()) continue;
      const list = looseByFile.get(fn.fileNodeId) ?? [];
      list.push({
        name: fn.name,
        code: fn.code,
        startLine: fn.startLine,
        endLine: fn.endLine,
      });
      looseByFile.set(fn.fileNodeId, list);
    }
  }

  const totalBytes = { value: 0 };
  const results: FetchedFile[] = [];

  for (const path of unique) {
    const file = byPath.get(path);
    if (!file) {
      results.push({
        path,
        content: "",
        truncated: false,
        error: "File not in deep analysis set",
        source: "database",
      });
      continue;
    }

    const functions: FnRow[] = [];
    const seen = new Set<string>();

    for (const mod of file.moduleNodes) {
      for (const fn of mod.functionNodes) {
        if (!fn.code?.trim() || seen.has(fn.name)) continue;
        seen.add(fn.name);
        functions.push({
          name: fn.name,
          code: fn.code,
          startLine: fn.startLine,
          endLine: fn.endLine,
        });
      }
    }

    if (!functions.length) {
      for (const fn of looseByFile.get(file.id) ?? []) {
        if (seen.has(fn.name)) continue;
        seen.add(fn.name);
        functions.push(fn);
      }
    }

    results.push(
      capContent(path, stitchFunctions(functions), totalBytes),
    );
  }

  return results;
}
