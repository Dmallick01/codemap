import type { FileNodeData } from "@/lib/store/graph";
import { ROLE_META, type ArchRole } from "@/lib/graph/semantic";
import {
  type RepoPromptMapContext,
  targetBlock,
  inspirationLine,
  getFileNodes,
  getSelectedFileNodes,
  formatNeighbors,
  formatSourceSnippet,
  formatSelectedFilesList,
  computeMapStats,
  formatRoleOverview,
  attachSourceTip,
} from "@/lib/export/repo-prompt-shared";

export type ExplainDepth = "overview" | "deep-dive" | "onboarding";

export type ExplainRepoPromptInput = RepoPromptMapContext & {
  depth: ExplainDepth;
  audience?: string;
};

const DEPTH_INSTRUCTIONS: Record<ExplainDepth, string> = {
  overview:
    "High-level wiki article: purpose, architecture diagram in prose, main user journeys, tech stack.",
  "deep-dive":
    "Technical deep-dive: subsystem boundaries, data flows, extension points, trade-offs, and concrete improvement backlog.",
  onboarding:
    "Contributor onboarding: where to start reading code, how to run locally, conventions, and first PR checklist.",
};

export function buildExplainRepoPrompt(ctx: ExplainRepoPromptInput): string {
  const {
    repoName,
    repoUrl,
    mapMode,
    nodes,
    edges,
    selectedNodeIds,
    targetProject,
    targetStack,
    notes,
    sourceFiles,
    depth,
    audience,
  } = ctx;

  const inspiration = inspirationLine(repoName, repoUrl);
  const stats = computeMapStats(nodes);
  stats.edgeCount = edges.length;
  const fileNodes = getFileNodes(nodes);
  const selected = getSelectedFileNodes(nodes, selectedNodeIds);
  const primary = selected[0];
  const primaryData = primary?.data as FileNodeData | undefined;

  const focusSection = selected.length
    ? `## Focus area (selected on map)\n\n${formatSelectedFilesList(selected)}\n\n${
        primary
          ? `### Connections for \`${primaryData?.path}\`\n\n${formatNeighbors(primary.id, fileNodes, edges)}`
          : ""
      }`
    : "## Focus area\n\n_Whole-repository view (no file selected). Narrow to a folder by selecting nodes on the map._";

  const audienceLine = audience?.trim()
    ? `**Reader:** ${audience.trim()}`
    : "**Reader:** developer evaluating or learning from this codebase";

  return `Explain this GitHub repository like a **wiki article** for ${inspiration}.

You are CodeMap’s architecture narrator. Treat this prompt as instructions to produce an **exportable, teachable document** — not chat filler. The reader may never clone the repo; your job is to make the system legible and actionable.

${audienceLine}
${targetBlock({ targetProject, targetStack })}
**Map analyzed:** ${stats.fileCount} files · ${stats.edgeCount} dependency edges · mode: ${mapMode}
${notes ? `\n**Editor notes:** ${notes}\n` : ""}
**Article depth:** ${depth} — ${DEPTH_INSTRUCTIONS[depth]}

---

## Your task (wiki structure)

Write a markdown article with these sections:

### 1. What this repository is
- One-paragraph elevator pitch (product, library, framework, or internal tool)
- Who it is for and what problem it solves
- Maturity signal (production OSS, example app, research prototype, etc.)

### 2. How the system is organized
Use the CodeMap role breakdown below. Explain **layers**, not a file tree dump.

${formatRoleOverview(stats)}

${stats.frameworks.length ? `\n**Detected stacks / frameworks:** ${stats.frameworks.join(", ")}` : ""}

### 3. Main flows & subsystems
- Entry points → routing/shell → UI/API/core/data
- Describe 2–4 **end-to-end flows** (e.g. “user request → API → DB”, “agent loop → tools → model”)
- Call out cross-cutting concerns: auth, config, jobs, observability

### 4. What is done well
- Concrete strengths evidenced by structure (separation of concerns, test layout, docs, typing, etc.)
- Patterns worth **copying** into another project (${targetProject || "the reader's app"})

### 5. What could be improved further
- Gaps, risks, or tech debt **inferred** from the map (missing tests, god modules, tight coupling, unclear boundaries)
- Prioritized backlog: quick wins vs structural refactors
- Security, performance, and operability notes where relevant

### 6. If you wanted to build something similar
- Minimal skeleton to replicate the **same architectural shape** (not a fork)
- Which folders/modules to study first (cite paths from samples above)
- What **not** to copy (secrets, vendor lock-in, over-fitted code)

${depth === "onboarding" ? `### 7. New contributor path\n- Suggested reading order (5–10 files)\n- Local dev assumptions\n- How to validate a change before PR\n` : ""}

${depth === "deep-dive" ? `### 7. Design decisions & alternatives\n- Document implicit trade-offs (monolith vs packages, sync vs async, etc.)\n- Reasoning-model / agent patterns if present (plan → act → observe loops)\n` : ""}

---

${focusSection}

---

## Ask me to deliver

1. The full wiki article in markdown (use headings above).
2. A **mermaid** architecture diagram (flowchart or C4-style) matching section 2–3.
3. A table: subsystem → responsibility → key paths → improvement idea.
4. A short “compare to my project” paragraph if the reader is porting ideas to ${targetStack || "their stack"}.

${formatSourceSnippet(sourceFiles)}
${attachSourceTip(!!sourceFiles?.length)}`;
}
