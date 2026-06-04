import { prisma } from "@/lib/db";
import {
  fetchRepoOverview,
  fetchRepoTreePaths,
  fetchReadmePreview,
} from "@/lib/services/github-lite";
import { selectAnchorPaths, folderStats } from "./lite-paths";
import { buildLiteStructuralGraph } from "./lite-graph";
import { analyzeFileSemantics } from "@/lib/graph/semantic";

export async function runLitePipeline(
  repoId: string,
  jobId: string,
  url: string,
) {
  try {
    await prisma.repo.update({
      where: { id: repoId },
      data: { status: "processing" },
    });

    await prisma.job.update({
      where: { id: jobId },
      data: {
        step: "fetching",
        log: "Reading repo from GitHub (metadata + file tree, no zip download)…",
      },
    });

    const [overview, allPaths, readmePreview] = await Promise.all([
      fetchRepoOverview(url),
      fetchRepoTreePaths(url),
      fetchReadmePreview(url),
    ]);

    await prisma.job.update({
      where: { id: jobId },
      data: {
        step: "mapping",
        progress: 0,
        total: allPaths.length,
        log: `Mapped ${allPaths.length} paths (lite cap). Picking anchor files…`,
      },
    });

    const anchors = selectAnchorPaths(allPaths);
    const folders = folderStats(allPaths);

    const overviewPayload = {
      lite: true,
      description: overview.description,
      readmePreview,
      defaultBranch: overview.defaultBranch,
      stars: overview.stars,
      language: overview.language,
      topics: overview.topics,
      totalPaths: allPaths.length,
      anchorCount: anchors.length,
      topFolders: folders.slice(0, 8),
      summary:
        readmePreview?.slice(0, 280) ??
        overview.description ??
        `A ${overview.language ?? "software"} project on GitHub.`,
    };

    for (const anchor of anchors) {
      const sem = analyzeFileSemantics(anchor.path);
      const summaryJson = anchor.isReadme
        ? {
            ...overviewPayload,
            summary:
              readmePreview?.slice(0, 400) ??
              overview.description ??
              sem.purpose,
            imports: [] as string[],
          }
        : {
            lite: true,
            summary: sem.purpose,
            imports: [] as string[],
          };

      await prisma.fileNode.create({
        data: {
          repoId,
          path: anchor.path,
          language: anchor.language,
          summary: JSON.stringify(summaryJson),
        },
      });
    }

    await prisma.job.update({
      where: { id: jobId },
      data: {
        step: "building",
        log: `Placing ${anchors.length} anchors into architecture map…`,
      },
    });

    await buildLiteStructuralGraph(repoId, jobId);
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
