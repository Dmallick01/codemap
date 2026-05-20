import { prisma } from "@/lib/db";
import { fetchAndStoreFiles } from "./fetcher";
import { parseAndStoreAST } from "./parser";
import { analyzeWithAI } from "./analyzer";
import { buildDependencyGraph } from "./graph-builder";

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

    // Step 1: Fetch
    const files = await fetchAndStoreFiles(repoId, jobId, url);

    // Step 2: Parse
    await parseAndStoreAST(repoId, jobId, files);

    // Step 3: AI Analyze
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
    if (hasApiKey) {
      await analyzeWithAI(repoId, jobId);
    } else {
      console.warn("ANTHROPIC_API_KEY not set — skipping AI summarization");
      await prisma.job.update({
        where: { id: jobId },
        data: {
          step: "building",
          log: "Skipped AI summarization (no API key). Building graph...",
        },
      });
    }

    // Step 4: Build graph
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
