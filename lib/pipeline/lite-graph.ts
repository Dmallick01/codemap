import { prisma } from "@/lib/db";
import { inferArchRole, type ArchRole } from "@/lib/graph/semantic";
import {
  resolvePathImport,
  sameUiFolder,
  sharesAppSegment,
} from "@/lib/graph/path-heuristics";

const LAYER_FLOW: ArchRole[] = [
  "entry",
  "routing",
  "ui",
  "api",
  "core",
  "tool",
  "data",
];

const MAX_EDGES = parseInt(process.env.MAX_LITE_EDGES || "180", 10);
const MAX_UI_TO_API = 24;
const MAX_SIBLING_UI = 8;

type AnchorRow = { id: string; path: string; summary: string | null };

function byRole(files: AnchorRow[]): Map<ArchRole, AnchorRow[]> {
  const m = new Map<ArchRole, AnchorRow[]>();
  for (const f of files) {
    const r = inferArchRole(f.path);
    if (!m.has(r)) m.set(r, []);
    m.get(r)!.push(f);
  }
  return m;
}

function getImports(file: AnchorRow): string[] {
  if (!file.summary) return [];
  try {
    const p = JSON.parse(file.summary);
    return Array.isArray(p.imports) ? p.imports : [];
  } catch {
    return [];
  }
}

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

  const pathToId = new Map(fileNodes.map((f) => [f.path, f.id]));
  const allPaths = new Set(fileNodes.map((f) => f.path));
  const edgeKey = new Set<string>();
  const edges: { fromId: string; toId: string; type: string; label: string }[] =
    [];

  function addEdge(
    fromId: string,
    toId: string,
    type: string,
    label: string,
  ): boolean {
    if (edges.length >= MAX_EDGES) return false;
    if (fromId === toId) return false;
    const key = `${fromId}|${toId}|${type}`;
    if (edgeKey.has(key)) return false;
    edgeKey.add(key);
    edges.push({ fromId, toId, type, label });
    return true;
  }

  const roles = byRole(fileNodes);

  // Layer flow: connect each file in role N to representative targets in N+1
  for (let i = 0; i < LAYER_FLOW.length - 1; i++) {
    const fromRole = LAYER_FLOW[i];
    const toRole = LAYER_FLOW[i + 1];
    const fromFiles = roles.get(fromRole) ?? [];
    const toFiles = roles.get(toRole) ?? [];
    if (!fromFiles.length || !toFiles.length) continue;

    for (const from of fromFiles) {
      const targets =
        toFiles.length <= 4
          ? toFiles
          : [
              toFiles[0],
              toFiles[Math.floor(toFiles.length / 2)],
              toFiles[toFiles.length - 1],
            ];
      for (const to of targets) {
        if (!addEdge(from.id, to.id, "flows", `${fromRole} → ${toRole}`)) break;
      }
    }
  }

  // Entry → all routing in same app tree
  const entries = roles.get("entry") ?? [];
  const routings = roles.get("routing") ?? [];
  for (const entry of entries) {
    for (const route of routings) {
      if (
        sharesAppSegment(entry.path, route.path) ||
        route.path.startsWith("app/") ||
        entry.path.startsWith("app/")
      ) {
        addEdge(entry.id, route.id, "defines", "layout shell");
      }
    }
  }

  // Routing → UI files under same route segment
  const uis = roles.get("ui") ?? [];
  for (const route of routings) {
    const routeDir = route.path.split("/").slice(0, -1).join("/");
    let linked = 0;
    for (const ui of uis) {
      if (linked >= 12) break;
      if (
        ui.path.startsWith(routeDir) ||
        (route.path.includes("/app/") && ui.path.startsWith("app/"))
      ) {
        if (addEdge(route.id, ui.id, "renders", "renders")) linked++;
      }
    }
  }

  // UI → API (data fetching surfaces)
  const apis = roles.get("api") ?? [];
  if (uis.length && apis.length) {
    let count = 0;
    for (const ui of uis) {
      for (const api of apis) {
        if (count >= MAX_UI_TO_API) break;
        if (addEdge(ui.id, api.id, "powers", "calls API")) count++;
      }
    }
  }

  // UI siblings in same folder
  const byDir = new Map<string, AnchorRow[]>();
  for (const ui of uis) {
    const dir = ui.path.split("/").slice(0, -1).join("/") || "root";
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(ui);
  }
  for (const [, group] of byDir) {
    if (group.length < 2) continue;
    const hub = group[0];
    for (let i = 1; i < Math.min(group.length, MAX_SIBLING_UI); i++) {
      addEdge(hub.id, group[i].id, "contains", "co-located UI");
    }
  }

  // Folder parent → child (all anchors)
  for (const a of fileNodes) {
    for (const b of fileNodes) {
      if (a.id === b.id) continue;
      if (
        b.path.startsWith(a.path + "/") &&
        b.path.split("/").length === a.path.split("/").length + 1
      ) {
        addEdge(a.id, b.id, "contains", "folder");
      }
    }
  }

  // Import edges from enriched summaries
  for (const file of fileNodes) {
    for (const imp of getImports(file)) {
      const resolved = resolvePathImport(imp, file.path, allPaths);
      if (!resolved) continue;
      const targetId = pathToId.get(resolved);
      if (!targetId) continue;
      addEdge(file.id, targetId, "imports", imp);

      const fromR = inferArchRole(file.path);
      const toR = inferArchRole(resolved);
      if (fromR === "ui" && toR === "ui" && sameUiFolder(file.path, resolved)) {
        addEdge(file.id, targetId, "renders", "uses component");
      }
    }
  }

  // Core/tool powers surface layers
  const surface = fileNodes.filter((f) => {
    const r = inferArchRole(f.path);
    return r === "api" || r === "entry" || r === "routing";
  });
  for (const role of ["core", "tool", "data"] as ArchRole[]) {
    const targets = roles.get(role) ?? [];
    for (const target of targets.slice(0, 6)) {
      for (const source of surface.slice(0, 4)) {
        addEdge(source.id, target.id, "powers", "uses");
      }
    }
  }

  if (edges.length > 0) {
    await prisma.edge.createMany({ data: edges });
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      step: "done",
      progress: edges.length,
      total: fileNodes.length,
      log: `Detailed lite map: ${fileNodes.length} files, ${edges.length} connections.`,
    },
  });

  await prisma.repo.update({
    where: { id: repoId },
    data: { status: "done" },
  });
}
