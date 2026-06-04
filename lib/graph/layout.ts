import type { Node, Edge } from "@xyflow/react";
import {
  type ArchRole,
  type FileSemantics,
  ROLE_META,
  roleXIndex,
  analyzeFileSemantics,
} from "./semantic";

export type LayoutFileInput = {
  id: string;
  path: string;
  language?: string | null;
  summary?: string;
  imports?: string[];
  modules?: unknown[];
};

const NODE_W = 240;
const NODE_H = 92;
const GROUP_PAD_X = 28;
const GROUP_PAD_Y = 44;
const GROUP_GAP_Y = 48;
const ROLE_STEP_X = 300;
const FILE_GAP_Y = 108;

export type GroupNodeData = {
  label: string;
  role: ArchRole;
  roleLabel: string;
  fileCount: number;
  color: string;
  bg: string;
  border: string;
};

export type LayoutResult = {
  nodes: Node[];
  edges: Edge[];
  semantics: Map<string, FileSemantics>;
};

/**
 * Spread the repo on X (architectural role + dependency depth) and Y (folder groups).
 */
export function buildSemanticLayout(
  files: LayoutFileInput[],
  graphEdges: Edge[],
): LayoutResult {
  const semantics = new Map<string, FileSemantics>();
  const enriched = files.map((f) => {
    const sem = analyzeFileSemantics(f.path, f.imports ?? []);
    semantics.set(f.id, sem);
    return { ...f, sem };
  });

  const depth = computeDependencyDepth(
    enriched.map((f) => f.id),
    graphEdges,
  );

  type Bucket = { groupKey: string; groupLabel: string; role: ArchRole; files: typeof enriched };
  const buckets = new Map<string, Bucket>();

  for (const file of enriched) {
    const key = `${file.sem.role}::${file.sem.group}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        groupKey: file.sem.group,
        groupLabel: file.sem.groupLabel,
        role: file.sem.role,
        files: [],
      });
    }
    buckets.get(key)!.files.push(file);
  }

  const sortedBuckets = [...buckets.values()].sort((a, b) => {
    const rx = roleXIndex(a.role) - roleXIndex(b.role);
    if (rx !== 0) return rx;
    return a.groupLabel.localeCompare(b.groupLabel);
  });

  const nodes: Node[] = [];
  const roleBandY = new Map<ArchRole, number>();

  for (const bucket of sortedBuckets) {
    const meta = ROLE_META[bucket.role];
    const groupId = `group:${bucket.role}:${bucket.groupKey}`;

    bucket.files.sort((a, b) => a.path.localeCompare(b.path));

    const maxDepthInBucket = Math.max(
      0,
      ...bucket.files.map((f) => depth.get(f.id) ?? 0),
    );
    const baseX =
      roleXIndex(bucket.role) * ROLE_STEP_X + maxDepthInBucket * 36;

    const baseY = roleBandY.get(bucket.role) ?? 0;
    const groupWidth = GROUP_PAD_X * 2 + NODE_W;
    const groupHeight =
      GROUP_PAD_Y * 2 + bucket.files.length * FILE_GAP_Y;

    nodes.push({
      id: groupId,
      type: "groupNode",
      position: { x: baseX, y: baseY },
      data: {
        label: bucket.groupLabel,
        role: bucket.role,
        roleLabel: meta.label,
        fileCount: bucket.files.length,
        color: meta.color,
        bg: meta.bg,
        border: meta.border,
      } satisfies GroupNodeData,
      style: {
        width: groupWidth,
        height: groupHeight,
        zIndex: 0,
      },
      selectable: false,
      draggable: true,
    });

    bucket.files.forEach((file, i) => {
      const d = depth.get(file.id) ?? 0;
      nodes.push({
        id: file.id,
        type: "fileNode",
        parentId: groupId,
        extent: "parent",
        position: {
          x: GROUP_PAD_X + d * 24,
          y: GROUP_PAD_Y + i * FILE_GAP_Y,
        },
        data: {
          path: file.path,
          language: file.language,
          summary: file.summary,
          modules: file.modules,
          role: file.sem.role,
          roleLabel: file.sem.roleLabel,
          group: file.sem.group,
          groupLabel: file.sem.groupLabel,
          framework: file.sem.framework,
          frameworkLabel: file.sem.frameworkLabel,
          purpose: file.sem.purpose,
        },
        style: { zIndex: 1 },
      });
    });

    roleBandY.set(bucket.role, baseY + groupHeight + GROUP_GAP_Y);
  }

  return { nodes, edges: graphEdges, semantics };
}

function computeDependencyDepth(
  nodeIds: string[],
  edges: Edge[],
): Map<string, number> {
  const idSet = new Set(nodeIds);
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

  for (const id of nodeIds) {
    incoming.set(id, []);
    outgoing.set(id, []);
  }

  for (const e of edges) {
    if (e.type !== "imports" && e.type !== "powers") continue;
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    outgoing.get(e.source)!.push(e.target);
    incoming.get(e.target)!.push(e.source);
  }

  const depth = new Map<string, number>();
  const entries = nodeIds.filter((id) => incoming.get(id)!.length === 0);
  const seeds = entries.length > 0 ? entries : nodeIds.slice(0, 8);

  const queue: { id: string; d: number }[] = seeds.map((id) => ({ id, d: 0 }));
  const seen = new Set<string>();

  while (queue.length > 0) {
    const { id, d } = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    depth.set(id, Math.max(depth.get(id) ?? 0, d));
    for (const next of outgoing.get(id) ?? []) {
      queue.push({ id: next, d: d + 1 });
    }
  }

  for (const id of nodeIds) {
    if (!depth.has(id)) depth.set(id, 0);
  }
  return depth;
}
