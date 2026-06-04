import type { FileNodeData } from "@/lib/store/graph";
import { analyzeFileSemantics, type ArchRole } from "@/lib/graph/semantic";
import {
  type RepoPromptMapContext,
  targetBlock,
  inspirationLine,
  getFileNodes,
  getSelectedFileNodes,
  formatNeighbors,
  formatSourceSnippet,
  formatSelectedFilesList,
  attachSourceTip,
} from "@/lib/export/repo-prompt-shared";

export type SystemCatalogId =
  | "app-framework"
  | "monorepo-layout"
  | "auth-system"
  | "api-layer"
  | "data-layer"
  | "background-jobs"
  | "llm-integration"
  | "agent-loop"
  | "reasoning-pipeline"
  | "plugin-architecture"
  | "observability"
  | "testing-strategy"
  | "cicd-deploy"
  | "domain-module"
  | "custom-system";

export type SystemCatalogItem = {
  id: SystemCatalogId;
  label: string;
  hint: string;
};

export const SYSTEM_CATALOG: SystemCatalogItem[] = [
  { id: "app-framework", label: "App framework shell", hint: "Next/Vite app structure, providers, layouts" },
  { id: "monorepo-layout", label: "Monorepo / packages", hint: "Workspaces, shared libs, boundaries" },
  { id: "auth-system", label: "Auth & sessions", hint: "Login, middleware, tokens, RBAC" },
  { id: "api-layer", label: "API / BFF layer", hint: "Routes, validation, error contract" },
  { id: "data-layer", label: "Data & persistence", hint: "ORM, migrations, repositories" },
  { id: "background-jobs", label: "Jobs & queues", hint: "Workers, retries, idempotency" },
  { id: "llm-integration", label: "LLM integration", hint: "Providers, prompts, streaming" },
  { id: "agent-loop", label: "Agent / tool loop", hint: "Plan-act-observe, tools, memory" },
  { id: "reasoning-pipeline", label: "Reasoning pipeline", hint: "Chains, planners, eval hooks" },
  { id: "plugin-architecture", label: "Plugin / extension system", hint: "Hooks, registries, sandboxes" },
  { id: "observability", label: "Observability", hint: "Logs, metrics, tracing" },
  { id: "testing-strategy", label: "Testing strategy", hint: "Unit/integration/e2e layout" },
  { id: "cicd-deploy", label: "CI/CD & deploy", hint: "Pipelines, env promotion" },
  { id: "domain-module", label: "Domain module / service", hint: "One bounded context end-to-end" },
  { id: "custom-system", label: "Custom capability…", hint: "Describe the subsystem" },
];

const SYSTEM_BRIEFS: Record<Exclude<SystemCatalogId, "custom-system">, string[]> = {
  "app-framework": [
    "Bootstrap: entry, global providers, env loading",
    "Routing conventions and layout composition",
    "Build tooling and path aliases",
  ],
  "monorepo-layout": [
    "Package boundaries and dependency rules",
    "Shared types/utils vs app-specific code",
    "Versioning and internal publish flow",
  ],
  "auth-system": [
    "Session vs JWT; where checks run (middleware vs handler)",
    "Role/permission model",
    "OAuth/credential storage boundaries",
  ],
  "api-layer": [
    "Route organization and handler thinness",
    "Validation, error envelope, status codes",
    "Authz per route",
  ],
  "data-layer": [
    "Schema/migrations strategy",
    "Repository vs active record",
    "Transaction and connection lifecycle",
  ],
  "background-jobs": [
    "Queue choice and worker topology",
    "Retry, DLQ, idempotency keys",
    "Scheduling and observability",
  ],
  "llm-integration": [
    "Provider abstraction and failover",
    "Prompt templates and variable injection",
    "Streaming, token limits, cost controls",
  ],
  "agent-loop": [
    "Tool registry and argument schemas",
    "Loop termination and max steps",
    "Memory / scratchpad persistence",
  ],
  "reasoning-pipeline": [
    "Stages: retrieve → plan → execute → verify",
    "Human-in-the-loop checkpoints",
    "Eval and regression fixtures",
  ],
  "plugin-architecture": [
    "Extension points and discovery",
    "Isolation and capability security",
    "Versioning of plugin API",
  ],
  observability: [
    "Structured logging fields",
    "Metrics that matter for SLOs",
    "Trace propagation across services",
  ],
  "testing-strategy": [
    "Test pyramid placement in repo",
    "Fixtures, mocks, contract tests",
    "CI gates and flake control",
  ],
  "cicd-deploy": [
    "Pipeline stages and artifacts",
    "Secrets and environment matrix",
    "Rollback and preview deploys",
  ],
  "domain-module": [
    "Public API of the module",
    "Inbound/outbound dependencies",
    "Domain events and invariants",
  ],
};

function inferSystemFromPath(path: string): SystemCatalogId | null {
  const p = path.toLowerCase();
  if (/prisma|migration|schema|drizzle|typeorm/.test(p)) return "data-layer";
  if (/auth|session|clerk|next-auth|oauth/.test(p)) return "auth-system";
  if (/agent|tool-call|tools\//.test(p)) return "agent-loop";
  if (/llm|openai|anthropic|prompt|inference/.test(p)) return "llm-integration";
  if (/reason|plan|chain|workflow/.test(p)) return "reasoning-pipeline";
  if (/queue|worker|job|bull|temporal/.test(p)) return "background-jobs";
  if (/plugin|extension|hook-registry/.test(p)) return "plugin-architecture";
  if (/\.github\/workflows|vercel|docker|deploy/.test(p)) return "cicd-deploy";
  if (/test|spec|__tests__/.test(p)) return "testing-strategy";
  if (/log|metric|trace|sentry|otel/.test(p)) return "observability";
  if (/packages\/|turbo|nx\.json|pnpm-workspace/.test(p)) return "monorepo-layout";
  if (/api\/|route\.ts|handler|controller/.test(p)) return "api-layer";
  if (/app\/layout|next\.config|vite\.config/.test(p)) return "app-framework";
  return null;
}

export function getSystemLabel(id: SystemCatalogId, custom?: string): string {
  if (id === "custom-system" && custom?.trim()) return custom.trim();
  return SYSTEM_CATALOG.find((s) => s.id === id)?.label ?? "system capability";
}

export function suggestSystemId(
  nodes: import("@xyflow/react").Node[],
  selectedNodeIds: string[],
): SystemCatalogId {
  const fileNodes = getFileNodes(nodes);
  const focus =
    selectedNodeIds.length > 0
      ? fileNodes.filter((n) => selectedNodeIds.includes(n.id))
      : fileNodes.slice(0, 3);

  for (const n of focus) {
    const path = (n.data as FileNodeData).path ?? "";
    const inferred = inferSystemFromPath(path);
    if (inferred) return inferred;
    const role = ((n.data as FileNodeData).role as ArchRole) ?? analyzeFileSemantics(path).role;
    if (role === "api") return "api-layer";
    if (role === "data") return "data-layer";
    if (role === "tool") return "background-jobs";
    if (role === "core") return "domain-module";
    if (role === "routing") return "app-framework";
  }
  return "domain-module";
}

export type SystemBuildPromptInput = RepoPromptMapContext & {
  systemId: SystemCatalogId;
  customSystem?: string;
};

export function buildSystemBuildPrompt(ctx: SystemBuildPromptInput): string {
  const {
    repoName,
    repoUrl,
    mapMode,
    systemId,
    customSystem,
    nodes,
    edges,
    selectedNodeIds,
    targetProject,
    targetStack,
    notes,
    sourceFiles,
  } = ctx;

  const label = getSystemLabel(systemId, customSystem);
  const inspiration = inspirationLine(repoName, repoUrl);
  const fileNodes = getFileNodes(nodes);
  const selected = getSelectedFileNodes(nodes, selectedNodeIds);
  const primary = selected[0];
  const primaryData = primary?.data as FileNodeData | undefined;
  const primaryPath = primaryData?.path;

  const refLine = primaryPath
    ? ` — modeled after how **${inspiration}** implements it around \`${primaryPath}\``
    : ` — modeled after the architecture patterns in **${inspiration}**`;

  const brief =
    systemId !== "custom-system"
      ? SYSTEM_BRIEFS[systemId]
      : [
          "Boundaries and public API of the capability",
          "Dependencies allowed in/out",
          "Operational and failure modes",
        ];

  const catalogHint = SYSTEM_CATALOG.find((s) => s.id === systemId)?.hint ?? "";

  return `Ask me how to build a **${label}** subsystem similar to this GitHub project${refLine}.

You are my **systems architect coach**. I want to recreate this **capability** (framework layer, agent loop, data plane, reasoning pipeline, etc.) in my own codebase — using the reference repo as a **pattern library**, not a fork.

${targetBlock({ targetProject, targetStack })}
**CodeMap context:** ${mapMode} map · capability: ${label}${catalogHint ? ` · _${catalogHint}_` : ""}
${notes ? `\n**Constraints:** ${notes}\n` : ""}

---

## Reference subsystem (from map)

${primaryPath ? `**Anchor file:** \`${primaryPath}\`` : "**Anchor:** _(select files on the map that implement this capability)_"}
${primaryData?.summary ? `\n**Summary:** ${primaryData.summary}` : ""}
${primaryData?.purpose ? `\n**Purpose in repo:** ${primaryData.purpose}` : ""}
${selected.length > 1 ? `\n**Related paths:**\n${formatSelectedFilesList(selected.slice(1), 8)}` : ""}

### Dependency graph (anchor)

${primary ? formatNeighbors(primary.id, fileNodes, edges) : "_Select anchor files on the map._"}

---

## Patterns to extract from ${repoName}

${brief.map((b) => `- ${b}`).join("\n")}

---

## Ask me (implementation plan)

1. **Reverse-engineer** how ${repoName} structures this capability (modules, config, lifecycle).
2. **Compare** to ${targetStack || "my stack"} — map 1:1 equivalents (libraries, folders, runtime).
3. **Design** interfaces: public API, events, config schema, extension points.
4. **Sequence** a phased build (MVP → hardening → observability).
5. **List** tests and fixtures to prove parity with the reference behavior.
6. **Warn** what must NOT be copied (secrets, vendor-specific hacks, scale assumptions).

---

## Acceptance criteria

- Same **architectural responsibility** as the reference subsystem
- Clear module boundaries and documented extension points
- Runnable locally with minimal env
- Observable failures (logs/metrics) and test coverage for core paths

${formatSourceSnippet(sourceFiles)}
${attachSourceTip(!!sourceFiles?.length)}`;
}
