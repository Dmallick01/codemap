/**
 * Infer how a file participates in the project (role, folder group, framework).
 * Used for layout bands and colors — not isolated AST units.
 */

export type ArchRole =
  | "entry"
  | "routing"
  | "ui"
  | "api"
  | "core"
  | "data"
  | "config"
  | "test"
  | "tool";

export type FrameworkHint =
  | "next"
  | "react"
  | "pipeline"
  | "database"
  | "node"
  | "generic";

export type FileSemantics = {
  path: string;
  role: ArchRole;
  roleLabel: string;
  group: string;
  groupLabel: string;
  framework: FrameworkHint;
  frameworkLabel: string;
  purpose: string;
};

export const ROLE_ORDER: ArchRole[] = [
  "entry",
  "routing",
  "ui",
  "api",
  "core",
  "tool",
  "data",
  "config",
  "test",
];

export const ROLE_META: Record<
  ArchRole,
  { label: string; description: string; color: string; bg: string; border: string }
> = {
  entry: {
    label: "Entry",
    description: "App bootstrap, pages users land on",
    color: "#f472b6",
    bg: "rgba(244,114,182,0.12)",
    border: "rgba(244,114,182,0.45)",
  },
  routing: {
    label: "Routing",
    description: "Routes, layouts, navigation shell",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    border: "rgba(167,139,250,0.45)",
  },
  ui: {
    label: "UI",
    description: "Components, views, presentation",
    color: "#34d399",
    bg: "rgba(56,189,248,0.12)",
    border: "rgba(56,189,248,0.45)",
  },
  api: {
    label: "API",
    description: "HTTP handlers, server actions, webhooks",
    color: "#34d399",
    bg: "rgba(52,211,153,0.12)",
    border: "rgba(52,211,153,0.45)",
  },
  core: {
    label: "Core logic",
    description: "Business rules, services, shared libraries",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.12)",
    border: "rgba(251,191,36,0.45)",
  },
  tool: {
    label: "Pipeline",
    description: "Ingest, parse, build, automation",
    color: "#fb923c",
    bg: "rgba(251,146,60,0.12)",
    border: "rgba(251,146,60,0.45)",
  },
  data: {
    label: "Data",
    description: "Models, schema, persistence",
    color: "#2dd4bf",
    bg: "rgba(45,212,191,0.12)",
    border: "rgba(45,212,191,0.45)",
  },
  config: {
    label: "Config",
    description: "Build, env, tooling setup",
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.12)",
    border: "rgba(148,163,184,0.45)",
  },
  test: {
    label: "Tests",
    description: "Specs and fixtures",
    color: "#64748b",
    bg: "rgba(100,116,139,0.1)",
    border: "rgba(100,116,139,0.35)",
  },
};

const FRAMEWORK_LABELS: Record<FrameworkHint, string> = {
  next: "Next.js App Router",
  react: "React UI",
  pipeline: "Processing pipeline",
  database: "Database layer",
  node: "Node / server",
  generic: "Application code",
};

function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function isTestPath(path: string): boolean {
  return (
    /(^|\/)(__tests__|tests?|spec|e2e)(\/|$)/i.test(path) ||
    /\.(test|spec)\.[a-z]+$/i.test(path)
  );
}

function isConfigPath(path: string): boolean {
  const base = basename(path);
  return (
    /^(\.|vite|next|tailwind|postcss|eslint|prettier|tsconfig|package|prisma)/i.test(
      base,
    ) || /config\.[a-z]+$/i.test(path)
  );
}

export function folderGroup(path: string): { key: string; label: string } {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return { key: "root", label: "Project root" };
  }
  const depth = Math.min(parts.length - 1, 2);
  const key = parts.slice(0, depth).join("/");
  const label = parts.slice(0, depth).join(" / ");
  return { key, label };
}

export function inferArchRole(path: string): ArchRole {
  const lower = path.toLowerCase();
  const base = basename(lower);

  if (isTestPath(path)) return "test";
  if (isConfigPath(path)) return "config";

  if (
    /(^|\/)(app|pages)\/page\.(tsx|jsx|js)$/i.test(path) ||
    /(^|\/)(main|index)\.(tsx?|jsx?)$/i.test(path) ||
    base === "page.tsx" ||
    base === "page.jsx"
  ) {
    return "entry";
  }

  if (
    /(^|\/)(app|pages)\/(layout|loading|error|not-found|template)\./i.test(path) ||
    /router\.(tsx?|jsx?)$/i.test(base) ||
    /(^|\/)middleware\.(tsx?|js)$/i.test(path)
  ) {
    return "routing";
  }

  if (
    /(^|\/)(components|ui|views|screens|widgets)(\/|$)/i.test(path) ||
    /(^|\/)app\/.*\/components\//i.test(path)
  ) {
    return "ui";
  }

  if (
    /(^|\/)(app\/api|api\/|routes\/|server\/|actions\/)/i.test(path) ||
    /route\.(tsx?|js)$/i.test(base)
  ) {
    return "api";
  }

  if (/(^|\/)prisma\//i.test(path) || /schema\.prisma$/i.test(path)) {
    return "data";
  }

  if (
    /(^|\/)lib\/(pipeline|services|db)/i.test(path) ||
    /(^|\/)(scripts|jobs|workers)(\/|$)/i.test(path) ||
    /(fetcher|parser|analyzer|graph-builder)\./i.test(base)
  ) {
    return "tool";
  }

  if (
    /(^|\/)lib\//i.test(path) ||
    /(^|\/)(src\/lib|utils|helpers|hooks|store)(\/|$)/i.test(path)
  ) {
    return "core";
  }

  if (/(model|entity|repository|migration)/i.test(path)) {
    return "data";
  }

  return "core";
}

export function inferFramework(
  path: string,
  imports: string[] = [],
): FrameworkHint {
  const lower = path.toLowerCase();
  const imp = imports.join(" ").toLowerCase();

  if (/(^|\/)app\//i.test(lower) || imp.includes("next/")) return "next";
  if (/(^|\/)prisma\//i.test(lower) || imp.includes("@prisma")) return "database";
  if (/(pipeline|ingest|parse|graph-builder)/i.test(lower)) return "pipeline";
  if (
    /(^|\/)components\//i.test(lower) ||
    imp.includes("react") ||
    /\.(tsx|jsx)$/i.test(lower)
  ) {
    return "react";
  }
  if (/(^|\/)app\/api\//i.test(lower) || /route\.ts$/i.test(lower)) {
    return "node";
  }
  return "generic";
}

export function buildPurpose(sem: {
  role: ArchRole;
  framework: FrameworkHint;
  groupLabel: string;
}): string {
  const roleDesc = ROLE_META[sem.role].description;
  const fw = FRAMEWORK_LABELS[sem.framework];
  return `${roleDesc} · ${fw} · ${sem.groupLabel}`;
}

export function analyzeFileSemantics(
  path: string,
  imports: string[] = [],
): FileSemantics {
  const role = inferArchRole(path);
  const { key, label } = folderGroup(path);
  const framework = inferFramework(path, imports);
  const meta = ROLE_META[role];

  return {
    path,
    role,
    roleLabel: meta.label,
    group: key,
    groupLabel: label,
    framework,
    frameworkLabel: FRAMEWORK_LABELS[framework],
    purpose: buildPurpose({ role, framework, groupLabel: label }),
  };
}

export function roleXIndex(role: ArchRole): number {
  return ROLE_ORDER.indexOf(role);
}

export function edgeStyle(type: string): {
  stroke: string;
  strokeWidth: number;
  animated?: boolean;
  label?: string;
} {
  switch (type) {
    case "imports":
      return { stroke: "#6366f1", strokeWidth: 2, label: "depends on" };
    case "powers":
      return { stroke: "#22d3ee", strokeWidth: 2, label: "powers" };
    case "defines":
      return { stroke: "#a78bfa", strokeWidth: 1.5, label: "defines" };
    case "flows":
      return { stroke: "#f472b6", strokeWidth: 2, label: "flows to" };
    case "contains":
      return { stroke: "#64748b", strokeWidth: 1, label: "contains" };
    case "renders":
      return { stroke: "#34d399", strokeWidth: 2, label: "renders" };
    default:
      return { stroke: "#475569", strokeWidth: 1.5 };
  }
}

/** Colored translucent pills for edge labels (not flat black). */
const EDGE_LABEL_THEME: Record<
  string,
  { bg: string; text: string }
> = {
  imports: { bg: "rgba(79, 70, 229, 0.88)", text: "#eef2ff" },
  powers: { bg: "rgba(8, 145, 178, 0.88)", text: "#ecfeff" },
  flows: { bg: "rgba(219, 39, 119, 0.88)", text: "#fdf2f8" },
  defines: { bg: "rgba(124, 58, 237, 0.85)", text: "#f5f3ff" },
  contains: { bg: "rgba(71, 85, 105, 0.85)", text: "#f1f5f9" },
  renders: { bg: "rgba(5, 150, 105, 0.88)", text: "#ecfdf5" },
};

export function edgeLabelPresentation(edgeType: string): {
  label?: string;
  labelStyle: { fill: string; fontSize: number; fontWeight: number };
  labelBgStyle: { fill: string; fillOpacity: number };
  labelBgPadding: [number, number];
  labelBgBorderRadius: number;
} {
  const base = edgeStyle(edgeType);
  const theme =
    EDGE_LABEL_THEME[edgeType] ??
    ({ bg: "rgba(20, 50, 36, 0.9)", text: "#ecfdf5" } as const);
  return {
    label: base.label,
    labelStyle: {
      fill: theme.text,
      fontSize: 14,
      fontWeight: 600,
    },
    labelBgStyle: {
      fill: theme.bg,
      fillOpacity: 1,
    },
    labelBgPadding: [6, 9],
    labelBgBorderRadius: 6,
  };
}
