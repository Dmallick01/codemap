import { prisma } from "@/lib/db";
import { fetchRepoFiles } from "@/lib/services/github";
import { getLanguageForFile } from "@/lib/services/tree-sitter";

export async function fetchAndStoreFiles(
  repoId: string,
  jobId: string,
  url: string
): Promise<Map<string, string>> {
  await prisma.job.update({
    where: { id: jobId },
    data: { step: "fetching", log: "Downloading repository..." },
  });

  const files = await fetchRepoFiles(url);

  const isLargeRepo = files.size >= 500;
  const fetchLog = isLargeRepo
    ? `Large repo detected. Processing top 500 source files. Creating file nodes...`
    : `Downloaded ${files.size} files. Creating file nodes...`;

  await prisma.job.update({
    where: { id: jobId },
    data: {
      log: fetchLog,
      total: files.size,
    },
  });

  let progress = 0;
  const batch = [];

  for (const [filePath] of files) {
    batch.push({
      repoId,
      path: filePath,
      language: getLanguageForFile(filePath),
    });
    progress++;

    if (batch.length >= 50) {
      await prisma.fileNode.createMany({ data: batch });
      batch.length = 0;
      await prisma.job.update({
        where: { id: jobId },
        data: { progress },
      });
    }
  }

  if (batch.length > 0) {
    await prisma.fileNode.createMany({ data: batch });
    await prisma.job.update({
      where: { id: jobId },
      data: { progress },
    });
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      step: "parsing",
      log: `Fetched ${files.size} files. Starting parse...`,
      progress: 0,
      total: files.size,
    },
  });

  return files;
}
