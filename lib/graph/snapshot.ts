import type { Node, Edge } from "@xyflow/react";

export const SNAPSHOT_VERSION = 1;

export type CodemapSnapshotMeta = {
  fileCount: number;
  edgeCount: number;
  layout: string;
  mode: "lite" | "deep";
  overview?: Record<string, unknown> | null;
  roles?: { role: string; count: number }[];
};

export type CodemapSnapshot = {
  version: number;
  name: string;
  url: string | null;
  sourceType: string;
  exportedAt: string;
  nodes: Node[];
  edges: Edge[];
  meta: CodemapSnapshotMeta;
};

/** Stable node id from repo path (no DB). */
export function pathToFileId(path: string): string {
  return `file:${path}`;
}

export function parseSnapshot(raw: string | null | undefined): CodemapSnapshot | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as CodemapSnapshot;
    if (!data.version || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function serializeSnapshot(snapshot: CodemapSnapshot): string {
  return JSON.stringify(snapshot);
}

export function validateSnapshotInput(body: unknown): CodemapSnapshot | null {
  if (!body || typeof body !== "object") return null;
  const o = body as CodemapSnapshot;
  if (o.version !== SNAPSHOT_VERSION && o.version !== 1) return null;
  if (!o.name || typeof o.name !== "string") return null;
  if (!Array.isArray(o.nodes) || !Array.isArray(o.edges)) return null;
  return o;
}
