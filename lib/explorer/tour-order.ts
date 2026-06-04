import type { Node, Edge } from "@xyflow/react";
import type { FileNodeData } from "@/lib/store/graph";
import type { ArchRole } from "@/lib/graph/semantic";

const TOUR_ROLE_ORDER: ArchRole[] = [
  "entry",
  "routing",
  "ui",
  "api",
  "core",
  "tool",
  "data",
  "config",
  "test",
];

function pathOf(node: Node): string {
  return (node.data as FileNodeData).path ?? node.id;
}

function roleOf(node: Node): ArchRole {
  return ((node.data as FileNodeData).role as ArchRole) ?? "core";
}

function isReadmePath(path: string): boolean {
  return /^readme/i.test(path.split("/").pop() ?? "");
}

/**
 * HF Viewer–style tour: README first, then layers entry → API → core (not raw A–Z).
 */
export function sortNodesForTour(nodes: Node[]): Node[] {
  return [...nodes].sort((a, b) => {
    const pa = pathOf(a);
    const pb = pathOf(b);
    const aReadme = isReadmePath(pa);
    const bReadme = isReadmePath(pb);
    if (aReadme && !bReadme) return -1;
    if (bReadme && !aReadme) return 1;

    const ra = TOUR_ROLE_ORDER.indexOf(roleOf(a));
    const rb = TOUR_ROLE_ORDER.indexOf(roleOf(b));
    if (ra !== rb) return ra - rb;

    return pa.localeCompare(pb);
  });
}

export type NeighborLink = {
  id: string;
  path: string;
  roleLabel?: string;
  edgeType?: string;
  edgeLabel?: string;
};

export type NodeNeighbors = {
  outgoing: NeighborLink[];
  incoming: NeighborLink[];
};

export function getNodeNeighbors(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
): NodeNeighbors {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const outgoing: NeighborLink[] = [];
  const incoming: NeighborLink[] = [];

  for (const e of edges) {
    const edgeType = (e.data as { edgeType?: string })?.edgeType;
    const edgeLabel =
      typeof e.label === "string" ? e.label : edgeType ?? undefined;

    if (e.source === nodeId) {
      const target = byId.get(e.target);
      if (target) {
        const d = target.data as FileNodeData;
        outgoing.push({
          id: target.id,
          path: d.path ?? target.id,
          roleLabel: d.roleLabel,
          edgeType,
          edgeLabel,
        });
      }
    }
    if (e.target === nodeId) {
      const source = byId.get(e.source);
      if (source) {
        const d = source.data as FileNodeData;
        incoming.push({
          id: source.id,
          path: d.path ?? source.id,
          roleLabel: d.roleLabel,
          edgeType,
          edgeLabel,
        });
      }
    }
  }

  return { outgoing, incoming };
}
