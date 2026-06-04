import type { Node, Edge } from "@xyflow/react";
import type { CodemapSnapshot, CodemapSnapshotMeta } from "@/lib/graph/snapshot";
import { SNAPSHOT_VERSION } from "@/lib/graph/snapshot";

export function buildSnapshotFromGraph(params: {
  name: string;
  url: string | null;
  sourceType: string;
  nodes: Node[];
  edges: Edge[];
  meta: CodemapSnapshotMeta;
}): CodemapSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    name: params.name,
    url: params.url,
    sourceType: params.sourceType,
    exportedAt: new Date().toISOString(),
    nodes: params.nodes,
    edges: params.edges,
    meta: params.meta,
  };
}

export function downloadCodemapFile(snapshot: CodemapSnapshot): void {
  const safe = snapshot.name.replace(/[^\w.-]+/g, "-") || "codemap";
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.codemap.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
