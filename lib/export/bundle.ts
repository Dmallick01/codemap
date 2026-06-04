import type { Node, Edge } from "@xyflow/react";
import type { FileNodeData } from "@/lib/store/graph";
import { getNodeNeighbors } from "@/lib/explorer/tour-order";

export const MAX_BUNDLE_ANCHORS = 8;
export const MAX_BUNDLE_PATHS = 16;

export type BundleAnchor = {
  nodeId: string;
  path: string;
  data: FileNodeData;
};

export function anchorFromNode(node: Node): BundleAnchor | null {
  if (node.type !== "fileNode") return null;
  const data = node.data as FileNodeData;
  if (!data.path) return null;
  return { nodeId: node.id, path: data.path, data };
}

/**
 * Paths to fetch for selective gitingest: anchors + optional 1-hop neighbors (deduped).
 */
export function resolveBundlePaths(
  anchors: BundleAnchor[],
  fileNodes: Node[],
  edges: Edge[],
  includeNeighbors: boolean,
): string[] {
  const paths = new Set<string>();

  for (const a of anchors) {
    paths.add(a.path);
    if (!includeNeighbors) continue;
    const n = getNodeNeighbors(a.nodeId, fileNodes, edges);
    for (const link of [...n.outgoing, ...n.incoming]) {
      paths.add(link.path);
    }
  }

  const sorted = [...paths].sort((a, b) => a.localeCompare(b));
  return sorted.slice(0, MAX_BUNDLE_PATHS);
}

export function mergeNeighborsForAnchors(
  anchors: BundleAnchor[],
  fileNodes: Node[],
  edges: Edge[],
): { outgoing: Map<string, string[]>; incoming: Map<string, string[]> } {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const a of anchors) {
    const n = getNodeNeighbors(a.nodeId, fileNodes, edges);
    if (n.outgoing.length) {
      outgoing.set(
        a.path,
        n.outgoing.map((x) => x.path),
      );
    }
    if (n.incoming.length) {
      incoming.set(
        a.path,
        n.incoming.map((x) => x.path),
      );
    }
  }

  return { outgoing, incoming };
}
