import PQueue from "p-queue";
import { prisma } from "@/lib/db";
import { fetchAndStoreFiles } from "./fetcher";
import { analyzeFileSummary, analyzeFunctionsForFile } from "./analyzer";
import { buildDependencyGraph } from "./graph-builder";
import {
  parseSingleFile,
  updateParseJobProgress,
  type ParseStats,
} from "./parser";

const PARSE_CONCURRENCY = 12;
const AI_CONCURRENCY = 10;

export async function runPipeline(
  repoId: string,
  jobId: string,
  url: string
) {
  try {
    await prisma.repo.update({
      where: { id: repoId },
      data: { status: "processing" },
    });

    const parseQueue = new PQueue({ concurrency: PARSE_CONCURRENCY });
    const aiQueue = new PQueue({ concurrency: AI_CONCURRENCY });

    const parseStats: ParseStats = { parsed: 0, skipped: 0, total: 0 };
    let aiCompleted = 0;
    let aiTotal = 0;

    const fetchPromise = fetchAndStoreFiles(
      repoId,
      jobId,
      url,
      (fileNodeId, path, content) => {
        parseStats.total++;
        parseQueue.add(async () => {
          await parseSingleFile(repoId, fileNodeId, path, content, parseStats);

          if (parseStats.parsed % 25 === 0) {
            await updateParseJobProgress(jobId, parseStats);
          }

          const fileNode = await prisma.fileNode.findUnique({
            where: { id: fileNodeId },
            select: { contentHash: true },
          });

          aiTotal++;
          aiQueue.add(async () => {
            try {
              await analyzeFunctionsForFile(
                fileNodeId,
                fileNode?.contentHash ?? null
              );
              await analyzeFileSummary(
                fileNodeId,
                fileNode?.contentHash ?? null
              );
            } catch (err) {
              console.error(`AI analysis failed for ${path}:`, err);
            }
            aiCompleted++;
            if (aiCompleted % 10 === 0 || aiCompleted === aiTotal) {
              await prisma.job.update({
                where: { id: jobId },
                data: {
                  step: "analyzing",
                  progress: aiCompleted,
                  total: aiTotal,
                  log: `Analyzing: ${aiCompleted}/${aiTotal} files...`,
                },
              });
            }
          });
        });
      }
    );

    await fetchPromise;
    await parseQueue.onIdle();

    await prisma.job.update({
      where: { id: jobId },
      data: {
        step: "analyzing",
        progress: parseStats.parsed,
        total: parseStats.total,
        log: `Parsed ${parseStats.parsed}/${parseStats.total} files (skipped ${parseStats.skipped} unchanged). Running AI analysis...`,
      },
    });

    await aiQueue.onIdle();

    await prisma.job.update({
      where: { id: jobId },
      data: {
        step: "building",
        progress: 0,
        log: "AI analysis complete. Building dependency graph...",
      },
    });

    await buildDependencyGraph(repoId, jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Pipeline failed for repo ${repoId}:`, message);

    await prisma.job.update({
      where: { id: jobId },
      data: {
        step: "error",
        log: `Pipeline error: ${message}`,
      },
    });

    await prisma.repo.update({
      where: { id: repoId },
      data: {
        status: "error",
        errorMsg: message,
      },
    });
  }
}
