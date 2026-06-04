"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Node } from "@xyflow/react";
import type { FileNodeData, SelectedNode } from "@/lib/store/graph";
import {
  loadExplorerSession,
  saveExplorerSession,
} from "@/lib/explorer/session";
import {
  sortNodesForTour,
  getNodeNeighbors,
  type NodeNeighbors,
} from "@/lib/explorer/tour-order";
import type { Edge } from "@xyflow/react";

function nodePath(node: Node): string {
  const data = node.data as FileNodeData;
  return data.path ?? node.id;
}

export function sortFileNodes(nodes: Node[]): Node[] {
  return [...nodes]
    .filter((n) => n.type === "fileNode")
    .sort((a, b) => nodePath(a).localeCompare(nodePath(b)));
}

export function useGraphExplorer(
  repoId: string,
  nodes: Node[],
  edges: Edge[],
  setSelectedNode: (n: SelectedNode | null) => void,
) {
  const ordered = useMemo(() => sortNodesForTour(nodes), [nodes]);
  const [index, setIndex] = useState(0);
  const [viewedIds, setViewedIds] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const initialized = useRef(false);

  const focusAt = useCallback(
    (nextIndex: number) => {
      if (!ordered.length) return;
      const clamped = Math.max(0, Math.min(ordered.length - 1, nextIndex));
      const node = ordered[clamped];
      setIndex(clamped);
      setSelectedNode({
        id: node.id,
        type: node.type ?? "fileNode",
        data: node.data as FileNodeData,
      });
      setViewedIds((prev) => {
        const next = prev.includes(node.id) ? prev : [...prev, node.id];
        saveExplorerSession(repoId, {
          nodeIndex: clamped,
          viewedIds: next,
          updatedAt: new Date().toISOString(),
        });
        return next;
      });
    },
    [ordered, repoId, setSelectedNode],
  );

  useEffect(() => {
    initialized.current = false;
  }, [repoId]);

  useEffect(() => {
    if (!ordered.length || initialized.current) return;
    initialized.current = true;
    const saved = loadExplorerSession(repoId);
    const start =
      saved && saved.nodeIndex >= 0 && saved.nodeIndex < ordered.length
        ? saved.nodeIndex
        : 0;
    if (saved?.viewedIds) setViewedIds(saved.viewedIds);
    focusAt(start);
  }, [ordered, repoId, focusAt]);

  const goNext = useCallback(() => focusAt(index + 1), [focusAt, index]);
  const goPrev = useCallback(() => focusAt(index - 1), [focusAt, index]);
  const goRandom = useCallback(() => {
    if (ordered.length < 2) return;
    let r = Math.floor(Math.random() * ordered.length);
    if (r === index) r = (r + 1) % ordered.length;
    focusAt(r);
  }, [focusAt, index, ordered.length]);

  const currentNode = ordered[index] ?? null;

  const neighbors: NodeNeighbors = useMemo(() => {
    if (!currentNode) return { outgoing: [], incoming: [] };
    return getNodeNeighbors(currentNode.id, ordered, edges);
  }, [currentNode, ordered, edges]);

  const focusIdByNodeId = useCallback(
    (nodeId: string) => {
      const idx = ordered.findIndex((n) => n.id === nodeId);
      if (idx >= 0) focusAt(idx);
    },
    [ordered, focusAt],
  );

  return {
    ordered,
    index,
    total: ordered.length,
    viewedCount: viewedIds.length,
    currentPath: currentNode ? nodePath(currentNode) : "",
    currentNode,
    currentData: currentNode ? (currentNode.data as FileNodeData) : null,
    neighbors,
    showHelp,
    setShowHelp,
    goNext,
    goPrev,
    goRandom,
    focusAt,
    focusIdByNodeId,
  };
}
