import type { Node, Edge } from "@xyflow/react";
import type { FileNodeData } from "@/lib/store/graph";
import type { ArchRole } from "@/lib/graph/semantic";
import { buildSemanticLayout, type LayoutFileInput } from "@/lib/graph/layout";
import type { MapSpacingScale } from "@/lib/graph/map-spacing";
import { buildUiStudioLayout, filterUiStudioFiles } from "@/lib/graph/ui-layout";

function toLayoutInput(node: Node): LayoutFileInput {
  const d = node.data as FileNodeData;
  return {
    id: node.id,
    path: d.path ?? node.id,
    language: d.language,
    summary: d.summary,
    role: d.role as ArchRole | undefined,
    roleLabel: d.roleLabel,
    group: d.group,
    groupLabel: d.groupLabel,
    framework: d.framework as LayoutFileInput["framework"],
    frameworkLabel: d.frameworkLabel,
    purpose: d.purpose,
  };
}

/**
 * Recompute positions using stored roles/groups (spacing only — not re-bucket by path).
 */
export function relayoutArchitectureNodes(
  nodes: Node[],
  edges: Edge[],
  spacingScale?: MapSpacingScale,
): Node[] {
  const fileNodes = nodes.filter((n) => n.type === "fileNode");
  if (!fileNodes.length) return nodes;

  const inputs = fileNodes.map(toLayoutInput);
  const dataById = new Map(fileNodes.map((n) => [n.id, n.data]));
  const { nodes: laid } = buildSemanticLayout(inputs, edges, spacingScale);
  return laid.map((n) => {
    if (n.type !== "fileNode" || !dataById.has(n.id)) return n;
    return {
      ...n,
      data: { ...(dataById.get(n.id) as object), ...n.data },
    };
  });
}

export function relayoutUiStudioNodes(
  nodes: Node[],
  edges: Edge[],
  spacingScale?: MapSpacingScale,
): Node[] {
  const fileNodes = nodes.filter((n) => n.type === "fileNode");
  if (!fileNodes.length) return nodes;

  const inputs = fileNodes.map(toLayoutInput);
  const uiFiles = filterUiStudioFiles(inputs);
  const { nodes: laid } = buildUiStudioLayout(uiFiles, edges, spacingScale);
  return laid;
}
