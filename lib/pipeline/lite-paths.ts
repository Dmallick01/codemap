import { analyzeFileSemantics, inferArchRole } from "@/lib/graph/semantic";
import { getLanguageForFile } from "@/lib/services/tree-sitter";

const MAX_ANCHOR_FILES = parseInt(process.env.MAX_LITE_FILES || "64", 10);
const MAX_PER_FOLDER = parseInt(process.env.MAX_LITE_PER_FOLDER || "4", 10);
const MAX_UI_FILES = parseInt(process.env.MAX_LITE_UI_FILES || "24", 10);

const ANCHOR_BASENAMES = new Set([
  "readme.md",
  "package.json",
  "pyproject.toml",
  "cargo.toml",
  "go.mod",
  "docker-compose.yml",
  "dockerfile",
  "makefile",
  "vercel.json",
  "next.config.ts",
  "next.config.js",
  "prisma.schema",
  "globals.css",
  "global.css",
]);

function basename(path: string): string {
  return path.split("/").pop()?.toLowerCase() ?? path;
}

function isAnchorBasename(path: string): boolean {
  const base = basename(path);
  if (ANCHOR_BASENAMES.has(base)) return true;
  if (base === "schema.prisma") return true;
  if (/^page\.(tsx|jsx|ts|js)$/.test(base)) return true;
  if (/^layout\.(tsx|jsx|ts|js)$/.test(base)) return true;
  if (/^route\.(tsx|js|ts)$/.test(base)) return true;
  if (/^index\.(tsx|jsx|ts|js)$/.test(base)) return true;
  if (/^main\.(tsx|ts|js|py|go|rs)$/.test(base)) return true;
  if (/loading\.(tsx|jsx)$/.test(base)) return true;
  if (/error\.(tsx|jsx)$/.test(base)) return true;
  return false;
}

function folderKey(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 1) return "root";
  return parts.slice(0, Math.min(2, parts.length - 1)).join("/");
}

export type LiteAnchor = {
  path: string;
  language: string | null;
  role: string;
  roleLabel: string;
  purpose: string;
  isReadme: boolean;
};

/**
 * Pick anchors that explain the repo — expanded for detailed maps.
 */
export function selectAnchorPaths(allPaths: string[]): LiteAnchor[] {
  const chosen = new Set<string>();
  const anchors: LiteAnchor[] = [];
  let uiCount = 0;

  function add(path: string, isReadme = false) {
    if (chosen.has(path) || anchors.length >= MAX_ANCHOR_FILES) return;
    const role = inferArchRole(path);
    if (role === "ui") {
      if (uiCount >= MAX_UI_FILES) return;
      uiCount++;
    }
    chosen.add(path);
    const sem = analyzeFileSemantics(path);
    anchors.push({
      path,
      language: getLanguageForFile(path),
      role: sem.role,
      roleLabel: sem.roleLabel,
      purpose: sem.purpose,
      isReadme,
    });
  }

  for (const p of allPaths) {
    if (/^readme/i.test(basename(p))) add(p, true);
  }

  for (const p of allPaths) {
    if (isAnchorBasename(p)) add(p);
  }

  // All UI-related TSX/JSX (components, app routes with UI)
  const uiCandidates = allPaths
    .filter(
      (p) =>
        /\.(tsx|jsx)$/i.test(p) &&
        (inferArchRole(p) === "ui" ||
          inferArchRole(p) === "entry" ||
          inferArchRole(p) === "routing"),
    )
    .sort((a, b) => a.localeCompare(b));

  for (const p of uiCandidates) {
    if (anchors.length >= MAX_ANCHOR_FILES || uiCount >= MAX_UI_FILES) break;
    add(p);
  }

  const byFolder = new Map<string, string[]>();
  for (const p of allPaths) {
    const fk = folderKey(p);
    if (!byFolder.has(fk)) byFolder.set(fk, []);
    byFolder.get(fk)!.push(p);
  }

  const significantFolders = [...byFolder.keys()]
    .filter((k) => k !== "root")
    .sort((a, b) => (byFolder.get(b)?.length ?? 0) - (byFolder.get(a)?.length ?? 0));

  for (const fk of significantFolders) {
    if (anchors.length >= MAX_ANCHOR_FILES) break;
    const files = byFolder
      .get(fk)!
      .filter((f) => /\.(ts|tsx|js|jsx|py|go|rs|css)$/i.test(f))
      .sort((a, b) => {
        const aAnchor = isAnchorBasename(a) ? 0 : 1;
        const bAnchor = isAnchorBasename(b) ? 0 : 1;
        if (aAnchor !== bAnchor) return aAnchor - bAnchor;
        return a.localeCompare(b);
      });

    let picked = 0;
    for (const f of files) {
      if (picked >= MAX_PER_FOLDER) break;
      add(f);
      picked++;
    }
  }

  // Hooks & styles used by frontend
  for (const p of allPaths) {
    if (anchors.length >= MAX_ANCHOR_FILES) break;
    if (/(^|\/)hooks\/.*\.(ts|tsx)$/i.test(p)) add(p);
    if (/\.module\.(css|scss)$/i.test(p)) add(p);
  }

  return anchors.sort((a, b) => a.path.localeCompare(b.path));
}

export function folderStats(allPaths: string[]): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of allPaths) {
    const fk = folderKey(p);
    counts.set(fk, (counts.get(fk) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}
