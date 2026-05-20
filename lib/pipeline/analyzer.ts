import { prisma } from "@/lib/db";
import {
  summarizeFunction,
  summarizeFile,
  withConcurrency,
} from "@/lib/services/ai";

function hasFileSummary(summary: string | null): boolean {
  if (!summary) return false;
  try {
    const parsed = JSON.parse(summary);
    return typeof parsed.summary === "string" && parsed.summary.length > 0;
  } catch {
    return summary.length > 0;
  }
}

export async function analyzeFunctionsForFile(
  fileNodeId: string,
  contentHash: string | null
): Promise<number> {
  const file = await prisma.fileNode.findUnique({
    where: { id: fileNodeId },
    select: { path: true, contentHash: true },
  });
  if (!file) return 0;

  const hash = file.contentHash ?? contentHash;

  const functions = await prisma.functionNode.findMany({
    where: {
      OR: [
        { fileNodeId, moduleNodeId: null },
        { moduleNode: { fileNodeId } },
      ],
    },
  });

  let analyzed = 0;

  for (const fn of functions) {
    if (fn.summary && fn.summary.length > 0 && hash && file.contentHash === hash) {
      continue;
    }

    try {
      const summary = await summarizeFunction(fn.name, fn.code, file.path);
      if (summary) {
        await prisma.functionNode.update({
          where: { id: fn.id },
          data: { summary },
        });
        analyzed++;
      }
    } catch (err) {
      console.error(`Failed to summarize function ${fn.name}:`, err);
    }
  }

  return analyzed;
}

export async function analyzeFileSummary(
  fileNodeId: string,
  contentHash: string | null
): Promise<void> {
  const file = await prisma.fileNode.findUnique({
    where: { id: fileNodeId },
    include: {
      moduleNodes: {
        include: { functionNodes: { select: { summary: true, name: true } } },
      },
    },
  });

  if (!file) return;

  const hash = file.contentHash ?? contentHash;

  if (hasFileSummary(file.summary) && file.contentHash && file.contentHash === hash) {
    return;
  }

  const fnSummaries = file.moduleNodes
    .flatMap((m) => m.functionNodes)
    .filter((fn) => fn.summary)
    .map((fn) => `${fn.name}: ${fn.summary}`);

  const topLevelFns = await prisma.functionNode.findMany({
    where: { fileNodeId: file.id, moduleNodeId: null },
    select: { name: true, summary: true },
  });
  for (const fn of topLevelFns) {
    if (fn.summary) fnSummaries.push(`${fn.name}: ${fn.summary}`);
  }

  if (fnSummaries.length === 0) return;

  try {
    let imports: string[] = [];
    if (file.summary) {
      try {
        const parsed = JSON.parse(file.summary);
        imports = parsed.imports || [];
      } catch {
        // Not JSON
      }
    }

    const fileSummary = await summarizeFile(file.path, fnSummaries);
    await prisma.fileNode.update({
      where: { id: file.id },
      data: {
        summary: JSON.stringify({ summary: fileSummary, imports }),
      },
    });
  } catch (err) {
    console.error(`Failed to summarize file ${file.path}:`, err);
  }
}

export async function analyzeWithAI(repoId: string, jobId: string) {
  const functionNodes = await prisma.functionNode.findMany({
    where: {
      OR: [
        { moduleNode: { fileNode: { repoId } } },
        { fileNodeId: { not: null } },
      ],
    },
    include: { moduleNode: { include: { fileNode: true } } },
  });

  const repoFunctions = functionNodes.filter((fn) => {
    if (fn.moduleNode?.fileNode?.repoId === repoId) return true;
    return fn.fileNodeId != null;
  });

  const fileHashes = new Map(
    (
      await prisma.fileNode.findMany({
        where: { repoId },
        select: { id: true, contentHash: true },
      })
    ).map((f) => [f.id, f.contentHash])
  );

  const total = repoFunctions.length;
  await prisma.job.update({
    where: { id: jobId },
    data: {
      step: "analyzing",
      total,
      progress: 0,
      log: `Summarizing ${total} functions...`,
    },
  });

  let progress = 0;

  await withConcurrency(repoFunctions, 10, async (fn) => {
    const fileNodeId =
      fn.moduleNode?.fileNode?.id ?? fn.fileNodeId ?? null;
    const contentHash = fileNodeId
      ? (fileHashes.get(fileNodeId) ?? null)
      : null;

    if (
      fn.summary &&
      fn.summary.length > 0 &&
      contentHash &&
      fileNodeId &&
      fileHashes.get(fileNodeId) === contentHash
    ) {
      progress++;
      return;
    }

    try {
      const filePath = fn.moduleNode?.fileNode?.path ?? "unknown";
      const summary = await summarizeFunction(fn.name, fn.code, filePath);
      await prisma.functionNode.update({
        where: { id: fn.id },
        data: { summary },
      });
    } catch (err) {
      console.error(`Failed to summarize function ${fn.name}:`, err);
    }
    progress++;
    if (progress % 5 === 0 || progress === total) {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          progress,
          log: `Summarized ${progress}/${total} functions`,
        },
      });
    }
  });

  const fileNodes = await prisma.fileNode.findMany({
    where: { repoId },
    include: {
      moduleNodes: {
        include: { functionNodes: { select: { summary: true, name: true } } },
      },
    },
  });

  await prisma.job.update({
    where: { id: jobId },
    data: { log: `Generating file summaries for ${fileNodes.length} files...` },
  });

  await withConcurrency(fileNodes, 10, async (file) => {
    if (hasFileSummary(file.summary) && file.contentHash) {
      return;
    }

    await analyzeFileSummary(file.id, file.contentHash);
  });

  await prisma.job.update({
    where: { id: jobId },
    data: {
      step: "building",
      progress: 0,
      log: "AI analysis complete. Building dependency graph...",
    },
  });
}
