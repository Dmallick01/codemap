import { prisma } from "@/lib/db";
import { runLiteSnapshotPipeline } from "./lite-snapshot";

export async function runLitePipeline(
  repoId: string,
  jobId: string,
  url: string,
) {
  try {
    const repo = await prisma.repo.findUnique({
      where: { id: repoId },
      select: { name: true },
    });
    await runLiteSnapshotPipeline(
      repoId,
      jobId,
      url,
      repo?.name ?? "repository",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Lite pipeline failed for repo ${repoId}:`, message);

    await prisma.job.update({
      where: { id: jobId },
      data: { step: "error", log: `Lite pipeline error: ${message}` },
    });

    await prisma.repo.update({
      where: { id: repoId },
      data: { status: "error", errorMsg: message },
    });
  }
}
