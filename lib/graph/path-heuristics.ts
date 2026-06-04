import path from "path";
import { inferArchRole, type ArchRole } from "@/lib/graph/semantic";

const ALIAS_ROOTS = ["", "src/", "app/"];

/**
 * Resolve import string to a path in the anchor set (lite / no full AST).
 */
export function resolvePathImport(
  importPath: string,
  fromFilePath: string,
  allPaths: Set<string>,
): string | null {
  if (importPath.startsWith(".")) {
    const dir = path.dirname(fromFilePath).replace(/\\/g, "/");
    let resolved = path.join(dir, importPath).replace(/\\/g, "/");
    const exts = [
      "",
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      "/index.ts",
      "/index.tsx",
      "/index.js",
    ];
    for (const ext of exts) {
      const c = resolved + ext;
      if (allPaths.has(c)) return c;
    }
    return null;
  }

  if (importPath.startsWith("@/")) {
    const rest = importPath.slice(2).replace(/\\/g, "/");
    for (const root of ALIAS_ROOTS) {
      const base = root + rest;
      const tries = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}.jsx`,
        `${base}/index.ts`,
        `${base}/index.tsx`,
      ];
      for (const t of tries) {
        if (allPaths.has(t)) return t;
      }
    }
  }

  return null;
}

/** Extract static import paths from source text (regex, lite-safe). */
export function extractImportPaths(source: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /import\s+(?:type\s+)?(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /export\s+(?:type\s+)?(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      const p = m[1];
      if (p && (p.startsWith(".") || p.startsWith("@/"))) found.add(p);
    }
  }
  return [...found];
}

export function isUiRelatedPath(filePath: string): boolean {
  const role = inferArchRole(filePath);
  if (role === "ui" || role === "entry" || role === "routing") return true;
  if (/(^|\/)hooks\/.*\.(tsx?|jsx?)$/i.test(filePath)) return true;
  if (/globals?\.css$/i.test(filePath)) return true;
  if (/\.module\.(css|scss)$/i.test(filePath)) return true;
  return false;
}

export function uiStudioCategory(
  filePath: string,
): "entry" | "routing" | "component" | "hook" | "style" | "other" {
  if (/globals?\.css|\.module\.(css|scss)|tailwind/i.test(filePath)) {
    return "style";
  }
  if (/(^|\/)hooks\//i.test(filePath)) return "hook";
  const role = inferArchRole(filePath);
  if (role === "entry") return "entry";
  if (role === "routing") return "routing";
  if (role === "ui") return "component";
  return "other";
}

export function sameUiFolder(a: string, b: string): boolean {
  const da = path.dirname(a).replace(/\\/g, "/");
  const db = path.dirname(b).replace(/\\/g, "/");
  return da === db && da.length > 0;
}

export function sharesAppSegment(a: string, b: string): boolean {
  const segA = a.split("/")[0];
  const segB = b.split("/")[0];
  return (
    (segA === "app" || segA === "pages") &&
    segA === segB &&
    a.split("/").length >= 2 &&
    b.split("/").length >= 2
  );
}

export function roleLayerOrder(role: ArchRole): number {
  const order: ArchRole[] = [
    "entry",
    "routing",
    "ui",
    "api",
    "core",
    "tool",
    "data",
  ];
  return order.indexOf(role);
}
