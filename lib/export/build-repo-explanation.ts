import type { FileNodeData } from "@/lib/store/graph";
import { ROLE_META, type ArchRole } from "@/lib/graph/semantic";
import type { ExplainDepth } from "@/lib/export/explain-repo-prompt";
import {
  type RepoPromptMapContext,
  inspirationLine,
  getFileNodes,
  getSelectedFileNodes,
  formatNeighbors,
  computeMapStats,
  formatRoleOverview,
} from "@/lib/export/repo-prompt-shared";

export type RepoOverviewForExplain = {
  lite?: boolean;
  description?: string | null;
  readmePreview?: string | null;
  summary?: string;
  language?: string | null;
  stars?: number;
  totalPaths?: number;
  anchorCount?: number;
  topFolders?: { key: string; count: number }[];
};

export type BuildRepoExplanationInput = RepoPromptMapContext & {
  depth: ExplainDepth;
  overview?: RepoOverviewForExplain | null;
  userQuestion?: string;
};

function inferImprovements(stats: ReturnType<typeof computeMapStats>): string[] {
  const ideas: string[] = [];
  if ((stats.byRole.test ?? 0) === 0) {
    ideas.push("Add or expand automated tests — the map shows no dedicated test layer.");
  }
  if ((stats.byRole.config ?? 0) === 0) {
    ideas.push("Document setup and environment in config/tooling folders for faster onboarding.");
  }
  if ((stats.byRole.entry ?? 0) === 0) {
    ideas.push("Clarify entry points (pages, CLI, or main) so new contributors know where execution starts.");
  }
  if ((stats.byRole.api ?? 0) > 0 && (stats.byRole.data ?? 0) === 0) {
    ideas.push("API surface exists without an obvious data layer — confirm persistence and schema boundaries.");
  }
  if (stats.fileCount > 40 && (stats.byRole.core ?? 0) > stats.fileCount * 0.5) {
    ideas.push("Core logic dominates the map — consider splitting domains into smaller modules.");
  }
  if (ideas.length === 0) {
    ideas.push("Structure looks balanced; next gains are likely docs, observability, and tighter module APIs.");
  }
  return ideas;
}

function buildLayerStack(stats: ReturnType<typeof computeMapStats>): string {
  const order: ArchRole[] = ["entry", "routing", "ui", "api", "core", "tool", "data", "config", "test"];
  const layers = order.filter((r) => (stats.byRole[r] ?? 0) > 0);
  if (layers.length < 2) return "";
  return layers
    .map((r, i) => {
      const arrow = i < layers.length - 1 ? " → " : "";
      return `**${ROLE_META[r].label}** (${stats.byRole[r]} files)${arrow}`;
    })
    .join("");
}

function buildFlows(stats: ReturnType<typeof computeMapStats>): string {
  const lines: string[] = [];
  if (stats.byRole.entry && stats.byRole.ui) {
    lines.push("- **User-facing path:** Entry → UI components → API/core as needed.");
  }
  if (stats.byRole.api && stats.byRole.data) {
    lines.push("- **Data path:** API handlers → core services → data/models.");
  }
  if (stats.byRole.tool) {
    lines.push("- **Automation path:** Pipeline/tooling modules orchestrate ingest, build, or background work.");
  }
  if (!lines.length) {
    lines.push("- Trace imports on the map edges to follow how modules call each other.");
  }
  return lines.join("\n");
}

export function buildRepoExplanation(ctx: BuildRepoExplanationInput): string {
  const {
    repoName,
    repoUrl,
    mapMode,
    nodes,
    edges,
    selectedNodeIds,
    depth,
    overview,
    userQuestion,
  } = ctx;

  const stats = computeMapStats(nodes);
  stats.edgeCount = edges.length;
  const fileNodes = getFileNodes(nodes);
  const selected = getSelectedFileNodes(nodes, selectedNodeIds);
  const primary = selected[0];
  const primaryData = primary?.data as FileNodeData | undefined;

  const pitch =
    overview?.summary ??
    overview?.readmePreview?.slice(0, 400) ??
    overview?.description ??
    `A ${overview?.language ?? "software"} codebase mapped by CodeMap (${stats.fileCount} anchor files, ${stats.edgeCount} edges).`;

  const improvements = inferImprovements(stats);
  const layerStack = buildLayerStack(stats);

  const focusBlock = selected.length
    ? `## Focus: ${primaryData?.path ?? "selection"}\n\n${selected
        .slice(0, 8)
        .map((n) => {
          const d = n.data as FileNodeData;
          return `- **\`${d.path}\`** — ${d.summary ?? d.purpose ?? d.roleLabel ?? "file"}`;
        })
        .join("\n")}\n\n${
        primary
          ? `### Connections\n\n${formatNeighbors(primary.id, fileNodes, edges)}`
          : ""
      }`
    : "";

  const depthNote =
    depth === "onboarding"
      ? "Contributor onboarding view"
      : depth === "deep-dive"
        ? "Technical deep-dive"
        : "Overview";

  const tableRows = (Object.keys(ROLE_META) as ArchRole[])
    .filter((r) => (stats.byRole[r] ?? 0) > 0)
    .map((r) => {
      const meta = ROLE_META[r];
      const sample = stats.sampleByRole[r]?.[0] ?? "—";
      return `| ${meta.label} | ${meta.description} | \`${sample}\` | ${stats.byRole[r]} files |`;
    })
    .join("\n");

  return `# ${repoName}

${inspirationLine(repoName, repoUrl)} · **${depthNote}** · map mode: **${mapMode}**

${userQuestion?.trim() ? `> ${userQuestion.trim()}\n\n` : ""}

## What this repository is

${pitch}

${overview?.language ? `Primary language: **${overview.language}**` : ""}${overview?.stars != null ? ` · **${overview.stars}** stars` : ""}${overview?.totalPaths != null ? ` · **${overview.totalPaths}** paths in tree` : ""}

## How the system is organized

${formatRoleOverview(stats)}

${stats.frameworks.length ? `**Stacks detected:** ${stats.frameworks.join(", ")}` : ""}

${layerStack ? `**Typical layer flow:** ${layerStack}` : ""}

## Main flows

${buildFlows(stats)}

## What is done well

- Clear **role-colored map** — layers are labeled (entry, UI, API, core, data, etc.) so you can navigate by responsibility.
- **${stats.edgeCount} dependency edges** recorded between anchors — use them to see coupling, not just folders.
${(stats.byRole.ui ?? 0) > 0 ? "- UI layer is represented — good for design export and component prompts." : ""}
${(stats.byRole.test ?? 0) > 0 ? "- Test files are present in the map." : ""}

## What could be improved

${improvements.map((i) => `- ${i}`).join("\n")}

## Subsystem reference

| Layer | Responsibility | Example path | Size |
|-------|----------------|--------------|------|
${tableRows}

## Building something similar

1. Start from **entry + routing**, then grow **UI/API** and **core** modules.
2. Study the sample paths in each row above before copying patterns.
3. Use CodeMap **build prompts** when you want Cursor-ready instructions for a specific file.

${focusBlock}`.trim();
}

export function isExplainIntent(question: string): boolean {
  const q = question.trim().toLowerCase();
  if (!q) return false;
  return /explain|wiki|what does|how does.*work|overview|walk me through|understand this repo|describe this (github|repo)/.test(
    q,
  );
}
