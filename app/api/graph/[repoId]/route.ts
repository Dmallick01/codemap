import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const { repoId } = await params;

  const repo = await prisma.repo.findUnique({
    where: { id: repoId },
  });

  if (!repo) {
    return NextResponse.json({ error: "Repo not found" }, { status: 404 });
  }

  const fileNodes = await prisma.fileNode.findMany({
    where: { repoId },
    include: {
      moduleNodes: {
        include: {
          functionNodes: {
            select: {
              id: true,
              name: true,
              summary: true,
              startLine: true,
              endLine: true,
              language: true,
              code: true,
            },
          },
        },
      },
    },
  });

  const edges = await prisma.edge.findMany({
    where: {
      OR: [
        { fromId: { in: fileNodes.map((f) => f.id) } },
        { toId: { in: fileNodes.map((f) => f.id) } },
      ],
    },
  });

  // Transform to @xyflow/react compatible format
  const nodes = fileNodes.map((file, index) => {
    let fileSummary = "";
    try {
      const parsed = JSON.parse(file.summary || "{}");
      fileSummary = parsed.summary || "";
    } catch {
      fileSummary = file.summary || "";
    }

    return {
      id: file.id,
      type: "fileNode",
      position: { x: (index % 6) * 280, y: Math.floor(index / 6) * 200 },
      data: {
        path: file.path,
        language: file.language,
        summary: fileSummary,
        modules: file.moduleNodes.map((m) => ({
          id: m.id,
          name: m.name,
          type: m.type,
          summary: m.summary,
          functions: m.functionNodes,
        })),
      },
    };
  });

  const graphEdges = edges.map((e) => ({
    id: e.id,
    source: e.fromId,
    target: e.toId,
    type: e.type,
    label: e.label || undefined,
  }));

  return NextResponse.json({
    repoId,
    repoName: repo.name,
    repoUrl: repo.url,
    status: repo.status,
    nodes,
    edges: graphEdges,
  });
}
