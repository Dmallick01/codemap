import type { Node, Edge } from "@xyflow/react";
import type { FileNodeData } from "@/lib/store/graph";
import { ROLE_META, type ArchRole } from "@/lib/graph/semantic";
import { uiStudioCategory } from "@/lib/graph/path-heuristics";

const COL = {
  entry: 0,
  routing: 320,
  component: 680,
  hook: 1040,
  style: 1280,
  other: 920,
};

/** Vertical gap between UI Studio file rows (larger tiles). */
const ROW_GAP = 112;
const NODE_W = 300;

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
 * Dedicated UI Studio layout: columns by screen / layout / component / styles.
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
    const cat = uiStudioCategory(f.path);
    const key = cat;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(f);
  }

  const order = ["entry", "routing", "component", "hook", "style"] as const;
  const nodes: Node[] = [];
  const ids = new Set(uiFiles.map((f) => f.id));

  for (const key of order) {
    const list = (buckets.get(key) ?? []).sort((a, b) =>
      a.path.localeCompare(b.path),
    );
    const x = COL[key];
    list.forEach((file, i) => {
      const role = (file.role as ArchRole) ?? "ui";
      const meta = ROLE_META[role] ?? ROLE_META.ui;
      nodes.push({
        id: file.id,
        type: "fileNode",
        position: { x, y: 40 + i * ROW_GAP },
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
        style: { width: NODE_W, zIndex: 1 },
      });
    });
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
    if (cat !== "other") return true;
    return f.role === "ui" || f.role === "entry" || f.role === "routing";
  });
}
