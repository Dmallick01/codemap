import { prisma } from "@/lib/db";
import { parseFile, getLanguageForFile } from "@/lib/services/tree-sitter";

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

  let progress = 0;
  const total = fileNodes.length;

  await prisma.job.update({
    where: { id: jobId },
    data: { step: "parsing", progress: 0, total },
  });

  for (const [filePath, content] of files) {
    const fileNodeId = fileNodeMap.get(filePath);
    if (!fileNodeId) continue;

    const language = getLanguageForFile(filePath);
    if (!language) {
      progress++;
      continue;
    }

    const result = await parseFile(content, filePath);
    if (!result) {
      progress++;
      continue;
    }

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

    // Store import paths in fileNode as JSON string for graph-builder
    if (result.imports.length > 0) {
      await prisma.fileNode.update({
        where: { id: fileNodeId },
        data: { summary: JSON.stringify({ imports: result.imports }) },
      });
    }

    progress++;
    if (progress % 10 === 0) {
      await prisma.job.update({
        where: { id: jobId },
        data: { progress, log: `Parsed ${progress}/${total} files` },
      });
    }
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      step: "analyzing",
      progress: 0,
      log: `Parsed ${progress} files. Starting AI analysis...`,
    },
  });
}
