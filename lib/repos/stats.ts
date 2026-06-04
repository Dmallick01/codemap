import { prisma } from "@/lib/db";
import { parseSnapshot } from "@/lib/graph/snapshot";
import { analyzeFileSemantics, ROLE_META, type ArchRole } from "@/lib/graph/semantic";

export type RepoRoleStat = {
  role: ArchRole;
  label: string;
  count: number;
  color: string;
};

export type RepoStats = {
  repoId: string;
  name: string;
  url: string | null;
  status: string;
  sourceType: string;
  mode: "lite" | "deep";
  fileCount: number;
  edgeCount: number;
  roles: RepoRoleStat[];
  overview: {
    description?: string | null;
    readmePreview?: string | null;
    language?: string | null;
    stars?: number;
    totalPaths?: number;
    anchorCount?: number;
    topFolders?: { key: string; count: number }[];
  } | null;
};

function extractOverview(
  fileNodes: { path: string; summary: string | null }[],
): RepoStats["overview"] {
  for (const file of fileNodes) {
    if (!/^readme/i.test(file.path.split("/").pop() ?? "")) continue;
    try {
      const parsed = JSON.parse(file.summary || "{}");
      if (parsed.lite || parsed.readmePreview || parsed.description) {
        return {
          description: parsed.description ?? null,
          readmePreview: parsed.readmePreview ?? null,
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

export async function getRepoStats(repoId: string): Promise<RepoStats | null> {
  const repo = await prisma.repo.findUnique({
    where: { id: repoId },
    select: {
      id: true,
      name: true,
      url: true,
      status: true,
      sourceType: true,
      snapshot: true,
    },
  });

  if (!repo) return null;

  const stored = parseSnapshot(repo.snapshot);
  if (stored) {
    const isLite = repo.sourceType === "github-lite";
    const roles: RepoRoleStat[] = (stored.meta.roles ?? []).map((r) => {
      const role = r.role as ArchRole;
      const meta = ROLE_META[role] ?? ROLE_META.core;
      return {
        role,
        count: r.count,
        label: meta.label,
        color: meta.color,
      };
    });
    const overview = stored.meta.overview as RepoStats["overview"];
    return {
      repoId: repo.id,
      name: repo.name,
      url: repo.url ?? stored.url,
      status: repo.status,
      sourceType: repo.sourceType,
      mode: stored.meta.mode ?? (isLite ? "lite" : "deep"),
      fileCount: stored.meta.fileCount,
      edgeCount: stored.meta.edgeCount,
      roles,
      overview: overview ?? null,
    };
  }

  const fileNodes = await prisma.fileNode.findMany({
    where: { repoId },
    select: { path: true, summary: true },
  });

  const edgeCount = await prisma.edge.count({
    where: {
      OR: [
        { fromNode: { repoId } },
        { toNode: { repoId } },
      ],
    },
  });

  const roleCounts = new Map<ArchRole, number>();
  for (const f of fileNodes) {
    const role = analyzeFileSemantics(f.path).role;
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
  }

  const roles: RepoRoleStat[] = [...roleCounts.entries()]
    .map(([role, count]) => ({
      role,
      count,
      label: ROLE_META[role].label,
      color: ROLE_META[role].color,
    }))
    .sort((a, b) => b.count - a.count);

  const isLite = repo.sourceType === "github-lite";

  return {
    repoId: repo.id,
    name: repo.name,
    url: repo.url,
    status: repo.status,
    sourceType: repo.sourceType,
    mode: isLite ? "lite" : "deep",
    fileCount: fileNodes.length,
    edgeCount,
    roles,
    overview: extractOverview(fileNodes),
  };
}
