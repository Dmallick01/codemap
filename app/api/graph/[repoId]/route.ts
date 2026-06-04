import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseSnapshot } from "@/lib/graph/snapshot";
import { analyzeFileSemantics, ROLE_META } from "@/lib/graph/semantic";
import { buildSemanticLayout, type LayoutFileInput } from "@/lib/graph/layout";
import { edgeStyle } from "@/lib/graph/semantic";
import type { Edge } from "@xyflow/react";
import { formatDbError } from "@/lib/db-errors";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ repoId: string }> },
) {
  try {
    return await getGraphResponse(params);
  } catch (err) {
    console.error("Graph API error:", err);
    return NextResponse.json(
      { error: formatDbError(err) },
      { status: 500 },
    );
  }
}

async function getGraphResponse(
  params: Promise<{ repoId: string }>,
) {
  const { repoId } = await params;

  const repo = await prisma.repo.findUnique({
    where: { id: repoId },
  });

  if (!repo) {
    return NextResponse.json({ error: "Repo not found" }, { status: 404 });
  }

  const stored = parseSnapshot(repo.snapshot);
  if (stored) {
    const isLite = repo.sourceType === "github-lite";
    return NextResponse.json({
      repoId,
      repoName: repo.name,
      repoUrl: repo.url ?? stored.url,
      status: repo.status,
      storageMode: repo.storageMode,
      sourceType: repo.sourceType,
      nodes: stored.nodes,
      edges: stored.edges,
      meta: {
        ...stored.meta,
        mode: stored.meta.mode ?? (isLite ? "lite" : "deep"),
        overview: stored.meta.overview ?? null,
      },
    });
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

  if (!fileNodes.length) {
    return NextResponse.json(
      { error: "No map data. Re-analyze or import a .codemap.json file." },
      { status: 404 },
    );
  }

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
      labelStyle: { fill: "#94a3b8", fontSize: 11 },
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

  const isLite = repo.sourceType === "github-lite";
  const overview = extractLiteOverview(fileNodes);

  const rolesPresent = [
    ...new Set(fileNodes.map((f) => analyzeFileSemantics(f.path).role)),
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
    storageMode: repo.storageMode,
    sourceType: repo.sourceType,
    nodes,
    edges: graphEdges,
    meta: {
      fileCount: fileNodes.length,
      edgeCount: edges.length,
      roles: rolesPresent,
      layout: "semantic-2d",
      mode: isLite ? "lite" : "deep",
      overview,
    },
  });
}

function extractLiteOverview(
  fileNodes: { path: string; summary: string | null }[],
) {
  for (const file of fileNodes) {
    if (!/^readme/i.test(file.path.split("/").pop() ?? "")) continue;
    try {
      const parsed = JSON.parse(file.summary || "{}");
      if (parsed.lite || parsed.readmePreview || parsed.description) {
        return {
          lite: !!parsed.lite,
          description: parsed.description ?? null,
          readmePreview: parsed.readmePreview ?? null,
          summary: parsed.summary ?? null,
          language: parsed.language ?? null,
          stars: parsed.stars,
          totalPaths: parsed.totalPaths,
          anchorCount: parsed.anchorCount,
          topFolders: parsed.topFolders,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}
