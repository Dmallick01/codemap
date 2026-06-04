import type { Node, Edge } from "@xyflow/react";
import type { FileNodeData } from "@/lib/store/graph";
import { uiStudioCategory } from "@/lib/graph/path-heuristics";
import type { FetchedFile } from "@/lib/services/github-contents";
import { getNodeNeighbors } from "@/lib/explorer/tour-order";

export type UiDesignExportInput = {
  repoName: string;
  repoUrl: string | null;
  mapMode: string;
  nodes: Node[];
  edges: Edge[];
  selectedNodeIds: string[];
  targetProject?: string;
  targetStack?: string;
  designNotes?: string;
  sourceFiles?: FetchedFile[];
  designMd?: string;
};

function sectionFiles(
  nodes: Node[],
  category: ReturnType<typeof uiStudioCategory>,
): Node[] {
  return nodes.filter(
    (n) => n.type === "fileNode" && uiStudioCategory((n.data as FileNodeData).path ?? "") === category,
  );
}

function formatFileList(nodes: Node[]): string {
  if (!nodes.length) return "_None mapped._";
  return nodes
    .map((n) => {
      const d = n.data as FileNodeData;
      const path = d.path ?? n.id;
      const name = path.split("/").pop();
      return `- **\`${name}\`** (\`${path}\`) — ${d.summary ?? d.purpose ?? "UI file"}`;
    })
    .join("\n");
}

function formatSourceBlock(files: FetchedFile[]): string {
  if (!files.length) return "";
  const parts = ["## Reference source (UI files)", ""];
  for (const f of files) {
    if (!f.content.trim()) continue;
    const lang = f.path.split(".").pop() ?? "tsx";
    const src =
      f.source === "database" ? "deep DB" : f.source === "github" ? "GitHub" : "";
    parts.push(
      `### \`${f.path}\`${src ? ` _(${src})_` : ""}\n\n\`\`\`${lang}\n${f.content}\n\`\`\`\n`,
    );
  }
  return parts.join("\n");
}

export function buildUiDesignPrompt(ctx: UiDesignExportInput): string {
  const {
    repoName,
    repoUrl,
    mapMode,
    nodes,
    edges,
    selectedNodeIds,
    targetProject,
    targetStack,
    designNotes,
    sourceFiles,
    designMd,
  } = ctx;

  const fileNodes = nodes.filter((n) => n.type === "fileNode");
  const selected =
    selectedNodeIds.length > 0
      ? fileNodes.filter((n) => selectedNodeIds.includes(n.id))
      : fileNodes;

  const sourceLine = repoUrl
    ? `**Source UI:** [${repoName}](${repoUrl})`
    : `**Source UI:** ${repoName}`;

  const target = targetProject
    ? `**Target app:** ${targetProject}${targetStack ? ` · ${targetStack}` : ""}`
    : "**Target app:** _(your product + design system)_";

  const entries = sectionFiles(selected, "entry");
  const routes = sectionFiles(selected, "routing");
  const components = sectionFiles(selected, "component");
  const hooks = sectionFiles(selected, "hook");
  const styles = sectionFiles(selected, "style");

  const connectionLines: string[] = [];
  for (const n of selected.slice(0, 12)) {
    const nb = getNodeNeighbors(n.id, fileNodes, edges);
    const outs = nb.outgoing
      .filter((l) => l.edgeType === "renders" || l.edgeType === "imports")
      .slice(0, 4);
    if (!outs.length) continue;
    const path = (n.data as FileNodeData).path ?? n.id;
    connectionLines.push(
      `- \`${path}\` → ${outs.map((o) => `\`${o.path}\``).join(", ")}`,
    );
  }

  const focusBlock =
    selectedNodeIds.length > 0
      ? `\n**Focus:** ${selectedNodeIds.length} selected component(s) — implement these first.\n`
      : "";

  return `# Recreate frontend UI from ${repoName}

You are rebuilding the **visual and interaction design** of an analyzed repository in a new codebase. This is not a full repo clone—only UI/UX patterns, layout, and component structure.

${sourceLine}
**Map mode:** ${mapMode}
${target}
${focusBlock}

${designNotes ? `**Designer notes:** ${designNotes}\n` : ""}

${designMd ? `\n---\n\n## Brand system (DESIGN.md)\n\nFollow this DESIGN.md specification for all visual decisions (colors, type, spacing, components, WCAG):\n\n\`\`\`markdown\n${designMd.trim()}\n\`\`\`\n\n---\n` : ""}

## Screens & entry routes

${formatFileList(entries)}

## Layouts & navigation shell

${formatFileList(routes)}

## Components & views

${formatFileList(components)}

## Hooks & client logic

${formatFileList(hooks)}

## Styles & tokens

${formatFileList(styles)}

---

## UI connection graph

How pieces compose (from CodeMap UI Studio):

${connectionLines.length ? connectionLines.join("\n") : "_Infer hierarchy from paths above._"}

---

## Instructions for the implementing agent

1. **Design system:** Map components to the target stack (e.g. shadcn, Tailwind, Chakra)—do not copy path names verbatim.
2. **Layout first:** Implement routing/layout shell before leaf components.
3. **Composition:** Parent layouts should render children matching the connection graph above.
4. **States:** Include loading, empty, and error states if the source routes define them.
5. **Responsive & a11y:** Preserve semantic HTML, focus order, and mobile breakpoints implied by the source.
6. **API boundaries:** Keep data fetching in hooks/server layers—UI files stay presentational where possible.
7. **Deliverables:** Component tree plan, key props/interfaces, then implementation.

## Anti-patterns

- Copying backend, database, or CI config
- Pixel-cloning without adapting to target brand tokens
- Monolithic pages without extracting reusable components

${sourceFiles?.length ? `\n---\n\n${formatSourceBlock(sourceFiles)}` : "\n_Enable “Attach UI source” in CodeMap to inline TSX/CSS reference._"}`;
}
