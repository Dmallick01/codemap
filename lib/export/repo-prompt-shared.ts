import type { Node, Edge } from "@xyflow/react";
import type { FileNodeData } from "@/lib/store/graph";
import { getNodeNeighbors } from "@/lib/explorer/tour-order";
import type { FetchedFile } from "@/lib/services/github-contents";
import { ROLE_META, type ArchRole } from "@/lib/graph/semantic";

export type RepoPromptMapContext = {
  repoName: string;
  repoUrl: string | null;
  mapMode: string;
  nodes: Node[];
  edges: Edge[];
  selectedNodeIds: string[];
  targetProject?: string;
  targetStack?: string;
  notes?: string;
  sourceFiles?: FetchedFile[];
};

export function targetBlock(ctx: {
  targetProject?: string;
  targetStack?: string;
}): string {
  return ctx.targetProject
    ? `**My project:** ${ctx.targetProject}${ctx.targetStack ? ` · stack: ${ctx.targetStack}` : ""}`
    : "**My project:** _(name your app + stack)_";
}

export function inspirationLine(repoName: string, repoUrl: string | null): string {
  return repoUrl ? `[${repoName}](${repoUrl})` : repoName;
}

export function getFileNodes(nodes: Node[]): Node[] {
  return nodes.filter((n) => n.type === "fileNode");
}

export function getSelectedFileNodes(
  nodes: Node[],
  selectedNodeIds: string[],
): Node[] {
  const fileNodes = getFileNodes(nodes);
  if (!selectedNodeIds.length) return [];
  return fileNodes.filter((n) => selectedNodeIds.includes(n.id));
}

export function formatNeighbors(
  nodeId: string,
  fileNodes: Node[],
  edges: Edge[],
): string {
  const nb = getNodeNeighbors(nodeId, fileNodes, edges);
  const lines: string[] = [];
  for (const o of nb.outgoing.slice(0, 6)) {
    lines.push(`- → \`${o.path}\`${o.roleLabel ? ` (${o.roleLabel})` : ""}${o.edgeLabel ? ` _${o.edgeLabel}_` : ""}`);
  }
  for (const i of nb.incoming.slice(0, 5)) {
    lines.push(`- ← \`${i.path}\`${i.roleLabel ? ` (${i.roleLabel})` : ""}`);
  }
  return lines.length ? lines.join("\n") : "_No graph edges recorded._";
}

export function formatSourceSnippet(
  files: FetchedFile[] | undefined,
  maxChars = 14000,
): string {
  if (!files?.length) return "";
  const parts: string[] = ["## Reference source from GitHub", ""];
  let used = 0;
  for (const f of files) {
    if (!f.content.trim() || used > maxChars) break;
    const chunk = f.content.slice(0, Math.min(4500, maxChars - used));
    used += chunk.length;
    const lang = f.path.split(".").pop() ?? "tsx";
    parts.push(`### \`${f.path}\`\n\n\`\`\`${lang}\n${chunk}\n\`\`\`\n`);
  }
  return parts.join("\n");
}

export function formatSelectedFilesList(nodes: Node[], max = 12): string {
  return nodes
    .slice(0, max)
    .map((n) => {
      const d = n.data as FileNodeData;
      const path = d.path ?? n.id;
      return `- \`${path}\` — ${d.summary ?? d.purpose ?? d.roleLabel ?? "file"}`;
    })
    .join("\n");
}

export type MapRoleStats = Record<ArchRole, number>;

export function computeMapStats(nodes: Node[]): {
  fileCount: number;
  edgeCount: number;
  byRole: MapRoleStats;
  sampleByRole: Partial<Record<ArchRole, string[]>>;
  frameworks: string[];
} {
  const fileNodes = getFileNodes(nodes);
  const byRole = {} as MapRoleStats;
  const sampleByRole: Partial<Record<ArchRole, string[]>> = {};
  const frameworks = new Set<string>();

  for (const role of Object.keys(ROLE_META) as ArchRole[]) {
    byRole[role] = 0;
  }

  for (const n of fileNodes) {
    const d = n.data as FileNodeData;
    const role = (d.role as ArchRole) ?? "core";
    byRole[role] = (byRole[role] ?? 0) + 1;
    if (!sampleByRole[role]) sampleByRole[role] = [];
    if ((sampleByRole[role]?.length ?? 0) < 4 && d.path) {
      sampleByRole[role]!.push(d.path);
    }
    if (d.frameworkLabel) frameworks.add(d.frameworkLabel);
  }

  return {
    fileCount: fileNodes.length,
    edgeCount: 0,
    byRole,
    sampleByRole,
    frameworks: [...frameworks],
  };
}

export function formatRoleOverview(stats: ReturnType<typeof computeMapStats>): string {
  const lines: string[] = [];
  for (const role of Object.keys(ROLE_META) as ArchRole[]) {
    const count = stats.byRole[role] ?? 0;
    if (!count) continue;
    const meta = ROLE_META[role];
    const samples = stats.sampleByRole[role]?.slice(0, 3).map((p) => `\`${p}\``).join(", ");
    lines.push(
      `- **${meta.label}** (${count} files): ${meta.description}${samples ? ` — e.g. ${samples}` : ""}`,
    );
  }
  return lines.length ? lines.join("\n") : "_No role breakdown available._";
}

export function attachSourceTip(hasFiles: boolean): string {
  return hasFiles
    ? ""
    : "\n_Tip: Enable “Attach reference source” in CodeMap to inline GitHub file contents._";
}
