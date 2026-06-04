import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeFileSemantics, ROLE_META } from "@/lib/graph/semantic";
import { buildSemanticLayout, type LayoutFileInput } from "@/lib/graph/layout";
import { edgeStyle } from "@/lib/graph/semantic";
import type { Edge } from "@xyflow/react";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ repoId: string }> },
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

  const layoutInputs: LayoutFileInput[] = fileNodes.map((file) => {
    let fileSummary = "";
    let imports: string[] = [];
    try {
      const parsed = JSON.parse(file.summary || "{}");
      fileSummary = parsed.summary || "";
      imports = parsed.imports || [];
    } catch {
      fileSummary = file.summary || "";
    }

    return {
      id: file.id,
      path: file.path,
      language: file.language,
      summary: fileSummary,
      imports,
      modules: file.moduleNodes.map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        summary: m.summary,
        functions: m.functionNodes,
      })),
    };
  });

  const graphEdges: Edge[] = edges.map((e) => {
    const style = edgeStyle(e.type);
    return {
      id: e.id,
      source: e.fromId,
      target: e.toId,
      type: "smoothstep",
      label: style.label ?? e.label ?? undefined,
      labelStyle: { fill: "#94a3b8", fontSize: 9 },
      labelBgStyle: { fill: "#0f172a", fillOpacity: 0.85 },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 4,
      style: {
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
      },
      data: { edgeType: e.type },
    };
  });

  const { nodes } = buildSemanticLayout(layoutInputs, graphEdges);

  const fileCount = fileNodes.length;
  const rolesPresent = [
    ...new Set(
      fileNodes.map((f) => analyzeFileSemantics(f.path).role),
    ),
  ].map((role) => ({
    role,
    ...ROLE_META[role],
    count: fileNodes.filter(
      (f) => analyzeFileSemantics(f.path).role === role,
    ).length,
  }));

  return NextResponse.json({
    repoId,
    repoName: repo.name,
    repoUrl: repo.url,
    status: repo.status,
    nodes,
    edges: graphEdges,
    meta: {
      fileCount,
      edgeCount: edges.length,
      roles: rolesPresent,
      layout: "semantic-2d",
    },
  });
}
