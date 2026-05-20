import { prisma } from "@/lib/db";
import {
  summarizeFunction,
  summarizeFile,
  withConcurrency,
} from "@/lib/services/ai";

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
    // For top-level functions, verify through fileNodeId
    return fn.fileNodeId != null;
  });

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

  await withConcurrency(repoFunctions, 5, async (fn) => {
    try {
      const summary = await summarizeFunction(
        fn.code,
        fn.language || "unknown",
        fn.name
      );
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

  // File-level summaries
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

  await withConcurrency(fileNodes, 5, async (file) => {
    const fnSummaries = file.moduleNodes
      .flatMap((m) => m.functionNodes)
      .filter((fn) => fn.summary)
      .map((fn) => `${fn.name}: ${fn.summary}`);

    // Also get top-level functions
    const topLevelFns = await prisma.functionNode.findMany({
      where: { fileNodeId: file.id, moduleNodeId: null },
      select: { name: true, summary: true },
    });
    for (const fn of topLevelFns) {
      if (fn.summary) fnSummaries.push(`${fn.name}: ${fn.summary}`);
    }

    if (fnSummaries.length === 0) return;

    try {
      const existingSummary = file.summary;
      let imports: string[] = [];
      if (existingSummary) {
        try {
          const parsed = JSON.parse(existingSummary);
          imports = parsed.imports || [];
        } catch {
          // Not JSON, that's fine
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
