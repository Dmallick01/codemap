import type { Node, Edge } from "@xyflow/react";
import type { FileNodeData } from "@/lib/store/graph";
import { buildSemanticLayout, type LayoutFileInput } from "@/lib/graph/layout";
import { buildUiStudioLayout, filterUiStudioFiles } from "@/lib/graph/ui-layout";

/**
 * Recompute node positions from current tile metrics (fixes snapshots saved with old spacing).
 */
export function relayoutArchitectureNodes(nodes: Node[], edges: Edge[]): Node[] {
  const fileNodes = nodes.filter((n) => n.type === "fileNode");
  if (!fileNodes.length) return nodes;

  const inputs: LayoutFileInput[] = fileNodes.map((n) => {
    const d = n.data as FileNodeData;
    return {
      id: n.id,
      path: d.path ?? n.id,
      language: d.language,
      summary: d.summary,
    };
  });

  const { nodes: laid } = buildSemanticLayout(inputs, edges);
  return laid;
}

export function relayoutUiStudioNodes(nodes: Node[], edges: Edge[]): Node[] {
  const fileNodes = nodes.filter((n) => n.type === "fileNode");
  if (!fileNodes.length) return nodes;

  const inputs = fileNodes.map((n) => {
    const d = n.data as FileNodeData;
    return {
      id: n.id,
      path: d.path ?? n.id,
      language: d.language,
      summary: d.summary,
      role: d.role,
      roleLabel: d.roleLabel,
      purpose: d.purpose,
      frameworkLabel: d.frameworkLabel,
    };
  });

  const uiFiles = filterUiStudioFiles(inputs);
  const { nodes: laid } = buildUiStudioLayout(uiFiles, edges);
  return laid;
}
