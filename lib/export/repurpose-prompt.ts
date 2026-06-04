import type { FileNodeData, ModuleData } from "@/lib/store/graph";
import type { NodeNeighbors } from "@/lib/explorer/tour-order";
import type { BundleAnchor } from "@/lib/export/bundle";
import { mergeNeighborsForAnchors } from "@/lib/export/bundle";
import type { Node, Edge } from "@xyflow/react";
import { formatTemplateBlock, getCapabilityTemplate } from "@/lib/export/capability-templates";
import type { ArchRole } from "@/lib/graph/semantic";
import type { FetchedFile } from "@/lib/services/github-contents";

export type RepurposeExportContext = {
  repoName: string;
  repoUrl: string | null;
  mapMode: string;
  nodeId: string;
  data: FileNodeData;
  neighbors: NodeNeighbors;
  targetProject?: string;
  targetStack?: string;
};

export type BundleExportContext = {
  repoName: string;
  repoUrl: string | null;
  mapMode: string;
  anchors: BundleAnchor[];
  fileNodes: Node[];
  edges: Edge[];
  includeNeighbors: boolean;
  bundlePaths: string[];
  targetProject?: string;
  targetStack?: string;
  sourceFiles?: FetchedFile[];
};

function formatNeighborSection(neighbors: NodeNeighbors): string {
  const lines: string[] = [];

  if (neighbors.outgoing.length) {
    lines.push("**Depends on / connects to:**");
    for (const n of neighbors.outgoing) {
      lines.push(
        `- \`${n.path}\`${n.roleLabel ? ` (${n.roleLabel})` : ""}${n.edgeLabel ? ` — ${n.edgeLabel}` : ""}`,
      );
    }
  }

  if (neighbors.incoming.length) {
    lines.push("");
    lines.push("**Used by / called from:**");
    for (const n of neighbors.incoming) {
      lines.push(
        `- \`${n.path}\`${n.roleLabel ? ` (${n.roleLabel})` : ""}${n.edgeLabel ? ` — ${n.edgeLabel}` : ""}`,
      );
    }
  }

  return lines.length ? lines.join("\n") : "_No structural edges recorded._";
}

function formatFunctions(modules?: ModuleData[]): string {
  if (!modules?.length) return "";

  const rows: string[] = [];
  for (const mod of modules) {
    for (const fn of mod.functions ?? []) {
      if (!fn.summary && !fn.name) continue;
      const range =
        fn.startLine != null && fn.endLine != null
          ? ` (L${fn.startLine}–${fn.endLine})`
          : "";
      rows.push(`- \`${fn.name}\`${range}: ${fn.summary ?? "(no summary)"}`);
    }
  }

  if (!rows.length) return "";
  return ["**Notable symbols (deep analysis):**", ...rows].join("\n");
}

function formatAnchorBlock(a: BundleAnchor): string {
  const path = a.path;
  const fname = path.split("/").pop() ?? path;
  const role = a.data.role ?? "core";
  const fnBlock = formatFunctions(a.data.modules);

  return `#### \`${fname}\` (\`${path}\`)

- **Role:** ${a.data.roleLabel ?? role} — ${a.data.purpose ?? a.data.summary ?? "—"}
- **Summary:** ${a.data.summary ?? "—"}
${a.data.frameworkLabel ? `- **Stack:** ${a.data.frameworkLabel}` : ""}

${formatTemplateBlock(role as ArchRole)}

${fnBlock ? `${fnBlock}\n` : ""}`;
}

function formatSourceFilesBlock(files: FetchedFile[]): string {
  if (!files.length) return "";

  const parts: string[] = ["## Source files (selective gitingest)", ""];
  for (const f of files) {
    if (f.error && !f.content) {
      parts.push(`### \`${f.path}\`\n\n_${f.error}_\n`);
      continue;
    }
    const lang = f.path.includes(".")
      ? f.path.split(".").pop() ?? ""
      : "";
    const note = f.truncated ? "\n\n_(truncated for size cap)_" : "";
    parts.push(
      `### \`${f.path}\`${note}\n\n\`\`\`${lang}\n${f.content}\n\`\`\`\n`,
    );
  }
  return parts.join("\n");
}

function targetBlock(ctx: { targetProject?: string; targetStack?: string }): string {
  return ctx.targetProject
    ? `**Target project:** ${ctx.targetProject}${ctx.targetStack ? ` (${ctx.targetStack})` : ""}`
    : "**Target project:** _(your app name + stack)_";
}

/**
 * Multi-anchor selective bundle prompt.
 */
export function buildBundlePrompt(ctx: BundleExportContext): string {
  const { repoName, repoUrl, mapMode, anchors, bundlePaths, sourceFiles } =
    ctx;
  const isLite = mapMode === "lite" || mapMode.includes("lite");
  const merged = mergeNeighborsForAnchors(
    anchors,
    ctx.fileNodes,
    ctx.edges,
  );

  const sourceLine = repoUrl
    ? `**Source:** [${repoName}](${repoUrl})`
    : `**Source:** ${repoName}`;

  const anchorBlocks = anchors.map(formatAnchorBlock).join("\n---\n\n");

  const depLines: string[] = ["## Dependency closure", ""];
  depLines.push(
    `Paths in this bundle (${bundlePaths.length}, selective—not whole repo):`,
  );
  for (const p of bundlePaths) {
    depLines.push(`- \`${p}\``);
  }

  if (merged.outgoing.size || merged.incoming.size) {
    depLines.push("", "**Per-anchor edges:**");
    for (const a of anchors) {
      const out = merged.outgoing.get(a.path);
      const inc = merged.incoming.get(a.path);
      if (!out?.length && !inc?.length) continue;
      depLines.push(`- \`${a.path}\`:`);
      if (out?.length) depLines.push(`  - → ${out.map((p) => `\`${p}\``).join(", ")}`);
      if (inc?.length) depLines.push(`  - ← ${inc.map((p) => `\`${p}\``).join(", ")}`);
    }
  }

  const roles = [...new Set(anchors.map((a) => a.data.role ?? "core"))];
  const primaryTemplate =
    roles.length === 1
      ? formatTemplateBlock(roles[0] as ArchRole)
      : anchors
          .map((a) => {
            const t = getCapabilityTemplate(a.data.role);
            return `- **${a.path}:** ${t.title}`;
          })
          .join("\n");

  const sourceSection = sourceFiles?.length
    ? `\n---\n\n${formatSourceFilesBlock(sourceFiles)}`
    : isLite
      ? "\n\n_Enable “Attach source files” in CodeMap to inline file contents here (selective gitingest)._"
      : "";

  return `# Repurpose capability bundle

You are porting **selected capabilities** from an analyzed repository into another project—not cloning the repo.

${sourceLine}
**Anchors:** ${anchors.length} file(s)
**Map mode:** ${mapMode}
${targetBlock(ctx)}

---

## Capabilities to reproduce

${anchorBlocks}

---

${depLines.join("\n")}

---

## Combined porting checklist

${primaryTemplate}

---

## Instructions for the implementing agent

1. **Scope:** Implement only the anchors and dependency paths listed above.
2. **Order:** Start with data/config deps, then core/api, then UI/entry.
3. **Adapt:** Use the target stack’s routing, auth, and styling conventions.
4. **Verify:** Satisfy acceptance criteria per role before marking done.
5. **Sources:** ${sourceFiles?.length ? "Use the source file section below for implementation detail." : `Fetch paths from GitHub when coding (${bundlePaths.join(", ")}).`}

## Deliverables

- [ ] Plan: files to add/change in the **target** repo
- [ ] Implementation per anchor
- [ ] List of source paths **not** ported and why

## Anti-patterns

- Whole-repo context dumps (this bundle is the max scope)
- Copying tests/config unless required by an anchor
${sourceSection}`;
}

/** Single-element export (wraps bundle builder). */
export function buildRepurposePrompt(ctx: RepurposeExportContext): string {
  const anchor: BundleAnchor = {
    nodeId: ctx.nodeId,
    path: ctx.data.path ?? "unknown",
    data: ctx.data,
  };

  const neighborPaths = [
    ...ctx.neighbors.outgoing.map((n) => n.path),
    ...ctx.neighbors.incoming.map((n) => n.path),
  ];
  const bundlePaths = [anchor.path, ...neighborPaths.filter((p) => p !== anchor.path)];

  let prompt = buildBundlePrompt({
    repoName: ctx.repoName,
    repoUrl: ctx.repoUrl,
    mapMode: ctx.mapMode,
    anchors: [anchor],
    fileNodes: [],
    edges: [],
    includeNeighbors: true,
    bundlePaths: [...new Set(bundlePaths)].slice(0, 16),
    targetProject: ctx.targetProject,
    targetStack: ctx.targetStack,
  });

  const neighborBlock = formatNeighborSection(ctx.neighbors);
  prompt = prompt.replace(
    "## Dependency closure",
    `## Dependency closure\n\n${neighborBlock}\n\n`,
  );

  const fname = anchor.path.split("/").pop() ?? anchor.path;
  prompt = prompt.replace(
    "# Repurpose capability bundle",
    `# Repurpose capability: ${fname}`,
  );

  return prompt;
}
