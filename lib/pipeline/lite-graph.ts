import { prisma } from "@/lib/db";
import { inferArchRole, type ArchRole } from "@/lib/graph/semantic";

const LAYER_FLOW: ArchRole[] = [
  "entry",
  "routing",
  "ui",
  "api",
  "core",
  "tool",
  "data",
];

type AnchorRow = { id: string; path: string };

function pickRepresentative(
  files: AnchorRow[],
  role: ArchRole,
): AnchorRow | undefined {
  return files.find((f) => inferArchRole(f.path) === role);
}

export async function buildLiteStructuralGraph(
  repoId: string,
  jobId: string,
) {
  const fileNodes = await prisma.fileNode.findMany({
    where: { repoId },
    select: { id: true, path: true },
  });

  await prisma.edge.deleteMany({
    where: {
      OR: [
        { fromId: { in: fileNodes.map((f) => f.id) } },
        { toId: { in: fileNodes.map((f) => f.id) } },
      ],
    },
  });

  const edgeKey = new Set<string>();
  const edges: { fromId: string; toId: string; type: string; label: string }[] =
    [];

  function addEdge(
    fromId: string,
    toId: string,
    type: string,
    label: string,
  ) {
    if (fromId === toId) return;
    const key = `${fromId}|${toId}|${type}`;
    if (edgeKey.has(key)) return;
    edgeKey.add(key);
    edges.push({ fromId, toId, type, label });
  }

  // Layer flow: how the app is structured left-to-right
  for (let i = 0; i < LAYER_FLOW.length - 1; i++) {
    const from = pickRepresentative(fileNodes, LAYER_FLOW[i]);
    const to = pickRepresentative(fileNodes, LAYER_FLOW[i + 1]);
    if (from && to) {
      addEdge(
        from.id,
        to.id,
        "flows",
        `${LAYER_FLOW[i]} → ${LAYER_FLOW[i + 1]}`,
      );
    }
  }

  // Entry defines layout in same app/ tree
  const entry = pickRepresentative(fileNodes, "entry");
  const routing = pickRepresentative(fileNodes, "routing");
  if (entry && routing) {
    const entryDir = entry.path.split("/").slice(0, -1).join("/");
    if (routing.path.startsWith(entryDir) || routing.path.startsWith("app/")) {
      addEdge(entry.id, routing.id, "defines", "shell");
    }
  }

  const surface = fileNodes.filter((f) => {
    const r = inferArchRole(f.path);
    return r === "api" || r === "entry" || r === "routing";
  });
  for (const role of ["core", "tool", "data"] as ArchRole[]) {
    const target = pickRepresentative(fileNodes, role);
    const source = surface[0];
    if (source && target) {
      addEdge(source.id, target.id, "powers", "uses");
    }
  }

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

  if (edges.length > 0) {
    await prisma.edge.createMany({ data: edges });
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      step: "done",
      progress: edges.length,
      total: fileNodes.length,
      log: `Lite map: ${fileNodes.length} anchor files, ${edges.length} structural connections.`,
    },
  });

  await prisma.repo.update({
    where: { id: repoId },
    data: { status: "done" },
  });
}
