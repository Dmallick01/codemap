import { prisma } from "@/lib/db";
import {
  fetchRepoOverview,
  fetchRepoTreePaths,
  fetchReadmePreview,
} from "@/lib/services/github-lite";
import { selectAnchorPaths, folderStats } from "./lite-paths";
import { buildLiteEdges, type LiteGraphFile } from "./lite-edges";
import { enrichImportsInMemory } from "./lite-imports";
import { analyzeFileSemantics } from "@/lib/graph/semantic";
import { buildSemanticLayout } from "@/lib/graph/layout";
import { edgeStyle } from "@/lib/graph/semantic";
import {
  pathToFileId,
  serializeSnapshot,
  type CodemapSnapshot,
} from "@/lib/graph/snapshot";
import type { Edge } from "@xyflow/react";

function toReactFlowEdges(
  raw: { fromId: string; toId: string; type: string; label: string }[],
): Edge[] {
  return raw.map((e, i) => {
    const style = edgeStyle(e.type);
    return {
      id: `e-${i}-${e.fromId}-${e.toId}`,
      source: e.fromId,
      target: e.toId,
      type: "smoothstep",
      label: style.label ?? e.label,
      labelStyle: { fill: "#94a3b8", fontSize: 9 },
      labelBgStyle: { fill: "#0f172a", fillOpacity: 0.85 },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 4,
      style: { stroke: style.stroke, strokeWidth: style.strokeWidth },
      data: { edgeType: e.type },
    };
  });
}

/**
 * Build map in memory, persist one JSON snapshot — no FileNode / Edge rows.
 */
export async function runLiteSnapshotPipeline(
  repoId: string,
  jobId: string,
  url: string,
  repoName: string,
) {
  await prisma.repo.update({
    where: { id: repoId },
    data: { status: "processing", storageMode: "snapshot" },
  });

  await prisma.job.update({
    where: { id: jobId },
    data: {
      step: "fetching",
      log: "GitHub tree + metadata (nothing stored per-file)…",
    },
  });

  const [overview, allPaths, readmePreview] = await Promise.all([
    fetchRepoOverview(url),
    fetchRepoTreePaths(url),
    fetchReadmePreview(url),
  ]);

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

  const files: LiteGraphFile[] = anchors.map((anchor) => {
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

    return {
      id: pathToFileId(anchor.path),
      path: anchor.path,
      summary: JSON.stringify(summaryJson),
    };
  });

  await prisma.job.update({
    where: { id: jobId },
    data: {
      step: "building",
      log: "Resolving imports in memory (not saved per file)…",
    },
  });

  await enrichImportsInMemory(files, url, anchors.map((a) => a.path));

  const rawEdges = buildLiteEdges(files);
  const graphEdges = toReactFlowEdges(rawEdges);

  const layoutInputs = files.map((f) => {
    let fileSummary = "";
    let imports: string[] = [];
    try {
      const parsed = JSON.parse(f.summary || "{}");
      fileSummary = parsed.summary || "";
      imports = parsed.imports || [];
    } catch {
      fileSummary = f.summary || "";
    }
    const sem = analyzeFileSemantics(f.path, imports);
    return {
      id: f.id,
      path: f.path,
      language: anchors.find((a) => a.path === f.path)?.language ?? null,
      summary: fileSummary,
      imports,
    };
  });

  const { nodes } = buildSemanticLayout(layoutInputs, graphEdges);

  const rolesPresent = [
    ...new Set(files.map((f) => analyzeFileSemantics(f.path).role)),
  ].map((role) => ({
    role,
    count: files.filter(
      (f) => analyzeFileSemantics(f.path).role === role,
    ).length,
  }));

  const snapshot: CodemapSnapshot = {
    version: 1,
    name: repoName,
    url,
    sourceType: "github-lite",
    exportedAt: new Date().toISOString(),
    nodes,
    edges: graphEdges,
    meta: {
      fileCount: files.length,
      edgeCount: graphEdges.length,
      layout: "semantic-2d",
      mode: "lite",
      overview: overviewPayload,
      roles: rolesPresent.map((r) => ({
        role: r.role,
        count: r.count,
      })),
    },
  };

  await prisma.repo.update({
    where: { id: repoId },
    data: {
      status: "done",
      snapshot: serializeSnapshot(snapshot),
    },
  });

  await prisma.job.update({
    where: { id: jobId },
    data: {
      step: "done",
      progress: graphEdges.length,
      total: files.length,
      log: `Snapshot map: ${files.length} anchors, ${graphEdges.length} connections (no per-file DB storage).`,
    },
  });
}
