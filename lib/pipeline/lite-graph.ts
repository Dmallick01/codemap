import { prisma } from "@/lib/db";
import { buildLiteEdges } from "./lite-edges";

/** Legacy: persist edges to DB for repos using storageMode=files. */
export async function buildLiteStructuralGraph(
  repoId: string,
  jobId: string,
) {
  const fileNodes = await prisma.fileNode.findMany({
    where: { repoId },
    select: { id: true, path: true, summary: true },
  });

  await prisma.edge.deleteMany({
    where: {
      OR: [
        { fromId: { in: fileNodes.map((f) => f.id) } },
        { toId: { in: fileNodes.map((f) => f.id) } },
      ],
    },
  });

  const edges = buildLiteEdges(fileNodes);

  if (edges.length > 0) {
    await prisma.edge.createMany({ data: edges });
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      step: "done",
      progress: edges.length,
      total: fileNodes.length,
      log: `Legacy file storage: ${fileNodes.length} files, ${edges.length} connections.`,
    },
  });

  await prisma.repo.update({
    where: { id: repoId },
    data: { status: "done" },
  });
}
