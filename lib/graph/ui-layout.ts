import type { Node, Edge } from "@xyflow/react";
import type { FileNodeData } from "@/lib/store/graph";
import { ROLE_META, type ArchRole } from "@/lib/graph/semantic";
import { uiStudioCategory } from "@/lib/graph/path-heuristics";
import { MAP_TILE_ROW_STRIDE, mapFileNodeStyle } from "./map-tile-metrics";

const COL_GAP = 20;
const COL_START_Y = 32;

export type UiLayoutInput = {
  id: string;
  path: string;
  language?: string | null;
  summary?: string;
  role?: string;
  roleLabel?: string;
  purpose?: string;
  frameworkLabel?: string;
};

/**
 * UI Studio: columns sized to tile width + tight vertical stacking.
 */
export function buildUiStudioLayout(
  files: UiLayoutInput[],
  graphEdges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const uiFiles = files.filter((f) => {
    const cat = uiStudioCategory(f.path);
    return cat !== "other" || f.role === "ui" || f.role === "entry";
  });

  const buckets = new Map<string, UiLayoutInput[]>();
  for (const f of uiFiles) {
    const key = uiStudioCategory(f.path);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(f);
  }

  const order = ["entry", "routing", "component", "hook", "style"] as const;
  const nodes: Node[] = [];
  const ids = new Set(uiFiles.map((f) => f.id));

  let columnX = 0;
  for (const key of order) {
    const list = (buckets.get(key) ?? []).sort((a, b) =>
      a.path.localeCompare(b.path),
    );
    if (!list.length) continue;

    list.forEach((file, i) => {
      const role = (file.role as ArchRole) ?? "ui";
      const meta = ROLE_META[role] ?? ROLE_META.ui;
      nodes.push({
        id: file.id,
        type: "fileNode",
        position: { x: columnX, y: COL_START_Y + i * MAP_TILE_ROW_STRIDE },
        data: {
          path: file.path,
          language: file.language ?? undefined,
          summary: file.summary,
          role: file.role ?? role,
          roleLabel: file.roleLabel ?? meta.label,
          purpose: file.purpose,
          frameworkLabel: file.frameworkLabel,
          uiCategory: key,
        } satisfies FileNodeData & { uiCategory?: string },
        style: { ...mapFileNodeStyle },
      });
    });

    columnX += mapFileNodeStyle.width + COL_GAP;
  }

  const edges = graphEdges.filter(
    (e) => ids.has(e.source) && ids.has(e.target),
  );

  return { nodes, edges };
}

export function filterUiStudioFiles<T extends { path: string; role?: string }>(
  files: T[],
): T[] {
  return files.filter((f) => {
    const cat = uiStudioCategory(f.path);
    return cat !== "other" || f.role === "ui" || f.role === "entry";
  });
}
