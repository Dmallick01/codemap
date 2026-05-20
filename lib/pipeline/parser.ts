import { prisma } from "@/lib/db";
import { parseFile, getLanguageForFile } from "@/lib/services/tree-sitter";
import { hashContent } from "@/lib/utils/hash";

const MAX_FILE_SIZE = 100_000;

export interface ParseStats {
  parsed: number;
  skipped: number;
  total: number;
}

export async function shouldSkipParse(
  repoId: string,
  filePath: string,
  contentHash: string
): Promise<{ skip: boolean; fileNodeId?: string }> {
  const existing = await prisma.fileNode.findFirst({
    where: { repoId, path: filePath, contentHash },
    include: {
      moduleNodes: {
        include: { functionNodes: { select: { id: true }, take: 1 } },
      },
    },
  });

  if (!existing) return { skip: false };

  const topLevelCount = await prisma.functionNode.count({
    where: { fileNodeId: existing.id, moduleNodeId: null },
  });

  const hasModuleFunctions = existing.moduleNodes.some(
    (m) => m.functionNodes.length > 0
  );

  if (hasModuleFunctions || topLevelCount > 0) {
    return { skip: true, fileNodeId: existing.id };
  }

  return { skip: false, fileNodeId: existing.id };
}

export async function parseSingleFile(
  repoId: string,
  fileNodeId: string,
  filePath: string,
  content: string,
  stats: ParseStats
): Promise<void> {
  const language = getLanguageForFile(filePath);
  if (!language) {
    stats.parsed++;
    return;
  }

  if (content.length > MAX_FILE_SIZE) {
    stats.parsed++;
    return;
  }

  const contentHash = hashContent(content);

  try {
    const { skip } = await shouldSkipParse(repoId, filePath, contentHash);
    if (skip) {
      stats.skipped++;
      stats.parsed++;
      console.log(`Skipped (unchanged): ${filePath}`);
      return;
    }

    const result = await parseFile(content, filePath);
    if (!result) {
      stats.parsed++;
      return;
    }

    // Clear stale AST nodes when content changed
    await prisma.moduleNode.deleteMany({ where: { fileNodeId } });
    await prisma.functionNode.deleteMany({
      where: { fileNodeId, moduleNodeId: null },
    });

    for (const mod of result.modules) {
      const moduleNode = await prisma.moduleNode.create({
        data: {
          fileNodeId,
          name: mod.name,
          type: mod.type,
          startLine: mod.startLine,
          endLine: mod.endLine,
        },
      });

      for (const fn of mod.functions) {
        await prisma.functionNode.create({
          data: {
            moduleNodeId: moduleNode.id,
            fileNodeId,
            name: fn.name,
            code: fn.code,
            startLine: fn.startLine,
            endLine: fn.endLine,
            language,
          },
        });
      }
    }

    for (const fn of result.functions) {
      await prisma.functionNode.create({
        data: {
          fileNodeId,
          name: fn.name,
          code: fn.code,
          startLine: fn.startLine,
          endLine: fn.endLine,
          language,
        },
      });
    }

    const summaryData =
      result.imports.length > 0
        ? JSON.stringify({ imports: result.imports })
        : null;

    await prisma.fileNode.update({
      where: { id: fileNodeId },
      data: {
        contentHash,
        ...(summaryData ? { summary: summaryData } : {}),
      },
    });
  } catch (err) {
    console.error(`Failed to parse ${filePath}:`, err);
  }

  stats.parsed++;
}

export async function updateParseJobProgress(
  jobId: string,
  stats: ParseStats
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      step: "parsing",
      progress: stats.parsed,
      total: stats.total,
      log: `Parsing: ${stats.parsed}/${stats.total} files (skipped ${stats.skipped} unchanged)`,
    },
  });
}

/** Batch parse from an in-memory map (legacy / tests). */
export async function parseAndStoreAST(
  repoId: string,
  jobId: string,
  files: Map<string, string>
) {
  const fileNodes = await prisma.fileNode.findMany({
    where: { repoId },
    select: { id: true, path: true },
  });

  const fileNodeMap = new Map(fileNodes.map((f) => [f.path, f.id]));
  const stats: ParseStats = {
    parsed: 0,
    skipped: 0,
    total: fileNodes.length,
  };

  await prisma.job.update({
    where: { id: jobId },
    data: { step: "parsing", progress: 0, total: stats.total },
  });

  for (const [filePath, content] of files) {
    const fileNodeId = fileNodeMap.get(filePath);
    if (!fileNodeId) continue;

    await parseSingleFile(repoId, fileNodeId, filePath, content, stats);

    if (stats.parsed % 50 === 0) {
      await updateParseJobProgress(jobId, stats);
    }
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      step: "analyzing",
      progress: 0,
      log: `Parsed ${stats.parsed} files (skipped ${stats.skipped} unchanged). Starting AI analysis...`,
    },
  });
}
