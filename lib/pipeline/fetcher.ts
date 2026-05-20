import { prisma } from "@/lib/db";
import { fetchRepoFilesStreaming } from "@/lib/services/github";
import { getLanguageForFile } from "@/lib/services/tree-sitter";

export type OnFileStoredCallback = (
  fileNodeId: string,
  path: string,
  content: string
) => void | Promise<void>;

export interface FetchStats {
  totalExtracted: number;
  fetched: number;
}

export async function fetchAndStoreFiles(
  repoId: string,
  jobId: string,
  url: string,
  onFileStored?: OnFileStoredCallback
): Promise<FetchStats> {
  await prisma.job.update({
    where: { id: jobId },
    data: { step: "fetching", log: "Downloading repository..." },
  });

  const stats: FetchStats = { totalExtracted: 0, fetched: 0 };

  const result = await fetchRepoFilesStreaming(
    url,
    async (filePath, content) => {
    try {
      const language = getLanguageForFile(filePath);
      const existing = await prisma.fileNode.findFirst({
        where: { repoId, path: filePath },
        select: { id: true },
      });

      const fileNode = existing
        ? await prisma.fileNode.update({
            where: { id: existing.id },
            data: { language },
          })
        : await prisma.fileNode.create({
            data: { repoId, path: filePath, language },
          });

      stats.fetched++;

      if (stats.fetched % 25 === 0) {
        await prisma.job.update({
          where: { id: jobId },
          data: {
            progress: stats.fetched,
            total: stats.totalExtracted || stats.fetched,
            log: `Fetching: ${stats.fetched}/${stats.totalExtracted} files...`,
          },
        });
      }

      if (onFileStored) {
        await onFileStored(fileNode.id, filePath, content);
      }
    } catch (err) {
      console.error(`Failed to store file ${filePath}:`, err);
    }
  },
    async (totalExtracted) => {
      stats.totalExtracted = totalExtracted;
      await prisma.job.update({
        where: { id: jobId },
        data: { total: totalExtracted, log: `Found ${totalExtracted} files in archive. Fetching...` },
      });
    }
  );

  stats.totalExtracted = result.totalExtracted;
  stats.fetched = result.processed;

  await prisma.job.update({
    where: { id: jobId },
    data: {
      step: "parsing",
      progress: 0,
      total: stats.fetched,
      log: `Fetched ${stats.fetched}/${stats.totalExtracted} files. Parsing...`,
    },
  });

  return stats;
}
