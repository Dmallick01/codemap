import type { Node, Edge } from "@xyflow/react";
import type { FileNodeData } from "@/lib/store/graph";
import { ROLE_META, type ArchRole } from "@/lib/graph/semantic";
import { uiStudioCategory } from "@/lib/graph/path-heuristics";
import { mapFileNodeStyle } from "./map-tile-metrics";
import {
  DEFAULT_MAP_SPACING_SCALE,
  resolveMapSpacing,
  tileRowStride,
  type MapSpacingScale,
} from "./map-spacing";

const COL_START_Y = 40;

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
  spacingScale: MapSpacingScale = DEFAULT_MAP_SPACING_SCALE,
): { nodes: Node[]; edges: Edge[] } {
  const spacing = resolveMapSpacing(spacingScale);
  const rowStride = tileRowStride(spacing);
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
        position: { x: columnX, y: COL_START_Y + i * rowStride },
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

    columnX += mapFileNodeStyle.width + spacing.roleColGap;
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
