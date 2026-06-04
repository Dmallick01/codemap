"use client";

import { useCallback, useEffect, useState } from "react";
import type { Node } from "@xyflow/react";
import {
  anchorFromNode,
  MAX_BUNDLE_ANCHORS,
  type BundleAnchor,
} from "@/lib/export/bundle";

const storageKey = (repoId: string) => `codemap-bundle-${repoId}`;

function loadIds(repoId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(repoId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveIds(repoId: string, ids: string[]) {
  sessionStorage.setItem(storageKey(repoId), JSON.stringify(ids));
}

export function useBundleSelection(repoId: string, fileNodes: Node[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedIds(loadIds(repoId));
  }, [repoId]);

  const persist = useCallback(
    (ids: string[]) => {
      setSelectedIds(ids);
      saveIds(repoId, ids);
    },
    [repoId],
  );

  const toggle = useCallback(
    (nodeId: string) => {
      persist(
        selectedIds.includes(nodeId)
          ? selectedIds.filter((id) => id !== nodeId)
          : selectedIds.length >= MAX_BUNDLE_ANCHORS
            ? selectedIds
            : [...selectedIds, nodeId],
      );
    },
    [selectedIds, persist],
  );

  const add = useCallback(
    (nodeId: string) => {
      if (selectedIds.includes(nodeId)) return;
      if (selectedIds.length >= MAX_BUNDLE_ANCHORS) return;
      persist([...selectedIds, nodeId]);
    },
    [selectedIds, persist],
  );

  const remove = useCallback(
    (nodeId: string) => {
      persist(selectedIds.filter((id) => id !== nodeId));
    },
    [selectedIds, persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const anchors: BundleAnchor[] = fileNodes
    .filter((n) => selectedIds.includes(n.id))
    .map(anchorFromNode)
    .filter((a): a is BundleAnchor => a !== null);

  const isSelected = useCallback(
    (nodeId: string) => selectedIds.includes(nodeId),
    [selectedIds],
  );

  const atCap = selectedIds.length >= MAX_BUNDLE_ANCHORS;

  return {
    selectedIds,
    anchors,
    count: selectedIds.length,
    toggle,
    add,
    remove,
    clear,
    isSelected,
    atCap,
    max: MAX_BUNDLE_ANCHORS,
  };
}
