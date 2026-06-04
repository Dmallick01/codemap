import { buildElementBuildPrompt, type ElementBuildPromptInput, type ElementCatalogId } from "@/lib/export/element-build-prompt";
import {
  buildSystemBuildPrompt,
  type SystemBuildPromptInput,
  type SystemCatalogId,
} from "@/lib/export/system-build-prompt";
import {
  buildExplainRepoPrompt,
  type ExplainDepth,
  type ExplainRepoPromptInput,
} from "@/lib/export/explain-repo-prompt";
import type { RepoPromptMapContext } from "@/lib/export/repo-prompt-shared";

export type PromptMode = "build-ui" | "build-system" | "explain-repo";

export type RepoPromptGeneratorInput = RepoPromptMapContext & {
  mode: PromptMode;
  elementId?: ElementCatalogId;
  customElement?: string;
  systemId?: SystemCatalogId;
  customSystem?: string;
  explainDepth?: ExplainDepth;
  explainAudience?: string;
  /** Natural-language question from the user (shown at top of exported prompt). */
  userQuestion?: string;
};

export const PROMPT_MODE_META: Record<
  PromptMode,
  { label: string; headline: string; description: string }
> = {
  "build-ui": {
    label: "Build UI element",
    headline: "Ask me how to build elements like:",
    description: "Components, layouts, and UI patterns inspired by a specific file",
  },
  "build-system": {
    label: "Build system / capability",
    headline: "Ask me how to build a subsystem like:",
    description: "Framework layers, agents, APIs, data, jobs — same shape as this repo",
  },
  "explain-repo": {
    label: "Explain this GitHub",
    headline: "Explain this GitHub repository:",
    description: "Wiki-style article — what it does, how it works, improvements, porting guide",
  },
};

function wrapWithUserQuestion(prompt: string, userQuestion?: string): string {
  const q = userQuestion?.trim();
  if (!q) return prompt;
  return `## What I asked\n\n> ${q.replace(/\n/g, "\n> ")}\n\n---\n\n${prompt}`;
}

export function buildRepoPrompt(ctx: RepoPromptGeneratorInput): string {
  const base = {
    repoName: ctx.repoName,
    repoUrl: ctx.repoUrl,
    mapMode: ctx.mapMode,
    nodes: ctx.nodes,
    edges: ctx.edges,
    selectedNodeIds: ctx.selectedNodeIds,
    targetProject: ctx.targetProject,
    targetStack: ctx.targetStack,
    notes: ctx.notes,
    sourceFiles: ctx.sourceFiles,
  };

  switch (ctx.mode) {
    case "build-ui":
      return wrapWithUserQuestion(
        buildElementBuildPrompt({
          ...base,
          elementId: ctx.elementId ?? "card-grid",
          customElement: ctx.customElement,
        } satisfies ElementBuildPromptInput),
        ctx.userQuestion,
      );
    case "build-system":
      return wrapWithUserQuestion(
        buildSystemBuildPrompt({
          ...base,
          systemId: ctx.systemId ?? "domain-module",
          customSystem: ctx.customSystem,
        } satisfies SystemBuildPromptInput),
        ctx.userQuestion,
      );
    case "explain-repo":
      return wrapWithUserQuestion(
        buildExplainRepoPrompt({
          ...base,
          depth: ctx.explainDepth ?? "overview",
          audience: ctx.explainAudience,
        } satisfies ExplainRepoPromptInput),
        ctx.userQuestion,
      );
    default:
      return wrapWithUserQuestion(
        buildExplainRepoPrompt({ ...base, depth: "overview" }),
        ctx.userQuestion,
      );
  }
}

export {
  ELEMENT_CATALOG,
  suggestElementId,
  type ElementCatalogId,
} from "@/lib/export/element-build-prompt";
export {
  SYSTEM_CATALOG,
  suggestSystemId,
  type SystemCatalogId,
} from "@/lib/export/system-build-prompt";
export { type ExplainDepth } from "@/lib/export/explain-repo-prompt";
