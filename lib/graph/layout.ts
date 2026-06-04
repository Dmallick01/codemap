import type { Node, Edge } from "@xyflow/react";
import {
  type ArchRole,
  type FileSemantics,
  ROLE_META,
  ROLE_ORDER,
  roleXIndex,
  analyzeFileSemantics,
} from "./semantic";
import {
  MAP_TILE_ROW_STRIDE,
  MAP_GROUP_PAD_X,
  MAP_GROUP_PAD_Y,
  MAP_GROUP_GAP_Y,
  MAP_ROLE_COL_GAP,
  MAP_DEPTH_STEP_X,
  groupHeightForFileCount,
  groupWidthForDepth,
  mapFileNodeStyle,
} from "./map-tile-metrics";

export type LayoutFileInput = {
  id: string;
  path: string;
  language?: string | null;
  summary?: string;
  imports?: string[];
  modules?: unknown[];
  /** Keep snapshot / map roles — do not re-guess from path on relayout */
  role?: ArchRole;
  roleLabel?: string;
  group?: string;
  groupLabel?: string;
  framework?: FileSemantics["framework"];
  frameworkLabel?: string;
  purpose?: string;
};

export function getEdgeSemanticType(edge: Edge): string {
  const data = edge.data as { edgeType?: string } | undefined;
  if (data?.edgeType) return data.edgeType;
  if (typeof edge.label === "string") {
    if (edge.label.includes("depends")) return "imports";
    if (edge.label.includes("powers")) return "powers";
    if (edge.label.includes("flows")) return "flows";
  }
  return "imports";
}

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

type EnrichedFile = LayoutFileInput & { sem: FileSemantics };

type Bucket = {
  groupKey: string;
  groupLabel: string;
  role: ArchRole;
  files: EnrichedFile[];
};

/**
 * Spread the repo on X (role columns, width = content) and Y (folder groups stacked per role).
 */
export function buildSemanticLayout(
  files: LayoutFileInput[],
  graphEdges: Edge[],
): LayoutResult {
  const semantics = new Map<string, FileSemantics>();
  const enriched = files.map((f) => {
    const sem = semanticsFromInput(f);
    semantics.set(f.id, sem);
    return { ...f, sem };
  });

  const depth = computeDependencyDepth(
    enriched.map((f) => f.id),
    graphEdges,
  );

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

  /** Per-role column X and max width (no shifting whole groups by import depth). */
  const roleColumnX = new Map<ArchRole, number>();
  const roleMaxWidth = new Map<ArchRole, number>();

  for (const bucket of sortedBuckets) {
    const maxDepth = Math.max(
      0,
      ...bucket.files.map((f) => depth.get(f.id) ?? 0),
    );
    const w = groupWidthForDepth(maxDepth);
    roleMaxWidth.set(
      bucket.role,
      Math.max(roleMaxWidth.get(bucket.role) ?? 0, w),
    );
  }

  let columnX = 0;
  for (const role of ROLE_ORDER) {
    const w = roleMaxWidth.get(role);
    if (!w) continue;
    roleColumnX.set(role, columnX);
    columnX += w + MAP_ROLE_COL_GAP;
  }

  const nodes: Node[] = [];
  const roleBandY = new Map<ArchRole, number>();

  for (const bucket of sortedBuckets) {
    const meta = ROLE_META[bucket.role];
    const groupId = `group:${bucket.role}:${bucket.groupKey}`;

    bucket.files.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));

    const maxDepthInBucket = Math.max(
      0,
      ...bucket.files.map((f) => depth.get(f.id) ?? 0),
    );
    const baseX = roleColumnX.get(bucket.role) ?? 0;
    const baseY = roleBandY.get(bucket.role) ?? 0;
    const groupWidth = groupWidthForDepth(maxDepthInBucket);
    const groupHeight = groupHeightForFileCount(bucket.files.length);

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
      const d =
        MAP_DEPTH_STEP_X > 0 ? (depth.get(file.id) ?? 0) : 0;
      nodes.push({
        id: file.id,
        type: "fileNode",
        parentId: groupId,
        extent: "parent",
        position: {
          x: MAP_GROUP_PAD_X + d * MAP_DEPTH_STEP_X,
          y: MAP_GROUP_PAD_Y + i * MAP_TILE_ROW_STRIDE,
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
        style: { ...mapFileNodeStyle },
      });
    });

    roleBandY.set(bucket.role, baseY + groupHeight + MAP_GROUP_GAP_Y);
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
    const edgeKind = getEdgeSemanticType(e);
    if (edgeKind !== "imports" && edgeKind !== "powers") continue;
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

function semanticsFromInput(f: LayoutFileInput): FileSemantics {
  if (f.role && f.group) {
    const role = f.role as ArchRole;
    const meta = ROLE_META[role] ?? ROLE_META.core;
    return {
      path: f.path,
      role,
      roleLabel: f.roleLabel ?? meta.label,
      group: f.group,
      groupLabel: f.groupLabel ?? f.group,
      framework: f.framework ?? "generic",
      frameworkLabel: f.frameworkLabel ?? "Application code",
      purpose: f.purpose ?? meta.description,
    };
  }
  return analyzeFileSemantics(f.path, f.imports ?? []);
}
