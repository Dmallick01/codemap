export type ExplorerSession = {
  nodeIndex: number;
  viewedIds: string[];
  updatedAt: string;
};

function storageKey(repoId: string) {
  return `codemap-explorer-${repoId}`;
}

export function loadExplorerSession(repoId: string): ExplorerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(repoId));
    if (!raw) return null;
    return JSON.parse(raw) as ExplorerSession;
  } catch {
    return null;
  }
}

export function saveExplorerSession(repoId: string, session: ExplorerSession) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(repoId), JSON.stringify(session));
  } catch {
    /* quota */
  }
}
