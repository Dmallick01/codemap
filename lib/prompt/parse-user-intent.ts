import type { ExplainDepth } from "@/lib/export/explain-repo-prompt";
import type { ElementCatalogId } from "@/lib/export/element-build-prompt";
import type { PromptMode } from "@/lib/export/repo-prompt-generator";
import type { SystemCatalogId } from "@/lib/export/system-build-prompt";

export type ParsedUserIntent = {
  mode: PromptMode;
  elementId?: ElementCatalogId;
  systemId?: SystemCatalogId;
  customLabel?: string;
  explainDepth?: ExplainDepth;
  confidence: "high" | "medium" | "low";
  summary: string;
};

export function parseUserIntent(question: string): ParsedUserIntent {
  const q = question.trim().toLowerCase();
  if (!q) {
    return {
      mode: "build-ui",
      elementId: "card-grid",
      confidence: "low",
      summary: "Describe what you want to build from this repo.",
    };
  }

  if (
    /explain|wiki|what does|how does.*work|overview|document|understand|improve|architecture of|walk me through/.test(
      q,
    )
  ) {
    const depth: ExplainDepth = /onboard|contributor|new hire|first pr/.test(q)
      ? "onboarding"
      : /deep|improve|debt|gap|security|refactor/.test(q)
        ? "deep-dive"
        : "overview";
    return {
      mode: "explain-repo",
      explainDepth: depth,
      confidence: "high",
      summary: "Explain this GitHub repo as a wiki article",
    };
  }

  if (/agent|tool loop|tool-call|reasoning|planner|llm|openai|anthropic|rag|chain/.test(q)) {
    const systemId: SystemCatalogId = /reason|plan/.test(q)
      ? "reasoning-pipeline"
      : /llm|model|gpt|claude/.test(q)
        ? "llm-integration"
        : "agent-loop";
    return {
      mode: "build-system",
      systemId,
      confidence: "high",
      summary: `Build a subsystem like: ${systemId}`,
    };
  }

  if (/monorepo|turbo|workspace|framework|next\.js|vite|app shell|bootstrap/.test(q)) {
    return {
      mode: "build-system",
      systemId: /monorepo|workspace|package/.test(q) ? "monorepo-layout" : "app-framework",
      confidence: "medium",
      summary: "Build app framework / monorepo structure",
    };
  }

  if (/auth|login|session|oauth|middleware|rbac/.test(q)) {
    return {
      mode: "build-system",
      systemId: "auth-system",
      confidence: "high",
      summary: "Build auth & session system",
    };
  }

  if (/api|route handler|endpoint|rest|graphql|bff/.test(q)) {
    return {
      mode: "build-system",
      systemId: "api-layer",
      confidence: "high",
      summary: "Build API layer",
    };
  }

  if (/database|prisma|orm|migration|postgres|data layer/.test(q)) {
    return {
      mode: "build-system",
      systemId: "data-layer",
      confidence: "high",
      summary: "Build data layer",
    };
  }

  if (/job|queue|worker|background|cron/.test(q)) {
    return {
      mode: "build-system",
      systemId: "background-jobs",
      confidence: "medium",
      summary: "Build background jobs",
    };
  }

  const uiMap: [RegExp, ElementCatalogId][] = [
    [/nav|navbar|header|top bar|menu bar/, "nav-shell"],
    [/sidebar|side nav|drawer/, "sidebar"],
    [/hero|landing|banner/, "hero"],
    [/table|datagrid|data grid/, "data-table"],
    [/modal|dialog|popup/, "modal"],
    [/login form|sign.?in|sign.?up|auth form/, "form-auth"],
    [/footer/, "footer"],
    [/toast|notification|snackbar/, "toast"],
    [/search|command palette|cmd.?k/, "search-command"],
    [/dashboard/, "dashboard"],
    [/settings|preferences/, "settings-page"],
    [/button|cta/, "cta-button"],
    [/card|grid|gallery/, "card-grid"],
    [/hook|use[A-Z]|fetch|swr|react query/, "data-hook"],
    [/api route|handler/, "api-handler"],
  ];

  for (const [re, id] of uiMap) {
    if (re.test(q)) {
      return {
        mode: "build-ui",
        elementId: id,
        confidence: "high",
        summary: `Build UI element: ${id}`,
      };
    }
  }

  if (/build|recreate|implement|copy|like this|similar|component|ui|layout|page|screen/.test(q)) {
    return {
      mode: "build-ui",
      elementId: "custom",
      customLabel: question.trim(),
      confidence: "medium",
      summary: "Custom UI / feature from your description",
    };
  }

  return {
    mode: "explain-repo",
    explainDepth: "overview",
    confidence: "low",
    summary: "General repo question — defaulting to wiki explain",
  };
}
