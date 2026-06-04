import type { Node } from "@xyflow/react";
import type { FileNodeData } from "@/lib/store/graph";
import { uiStudioCategory } from "@/lib/graph/path-heuristics";
import { analyzeFileSemantics, type ArchRole } from "@/lib/graph/semantic";
import {
  type RepoPromptMapContext,
  targetBlock,
  inspirationLine,
  getFileNodes,
  getSelectedFileNodes,
  formatNeighbors,
  formatSourceSnippet,
  attachSourceTip,
} from "@/lib/export/repo-prompt-shared";

export type ElementCatalogId =
  | "nav-shell"
  | "sidebar"
  | "hero"
  | "card-grid"
  | "data-table"
  | "form-auth"
  | "modal"
  | "cta-button"
  | "dashboard"
  | "settings-page"
  | "toast"
  | "search-command"
  | "footer"
  | "api-handler"
  | "data-hook"
  | "custom";

export type ElementCatalogItem = {
  id: ElementCatalogId;
  label: string;
  category: "ui" | "arch";
  hint: string;
};

export const ELEMENT_CATALOG: ElementCatalogItem[] = [
  { id: "nav-shell", label: "Top navigation bar", category: "ui", hint: "Header links, logo, mobile menu" },
  { id: "sidebar", label: "Sidebar layout", category: "ui", hint: "Collapsible nav, active states, sections" },
  { id: "hero", label: "Hero / landing section", category: "ui", hint: "Headline, subcopy, primary CTA" },
  { id: "card-grid", label: "Card grid / gallery", category: "ui", hint: "Responsive grid, hover, metadata" },
  { id: "data-table", label: "Data table", category: "ui", hint: "Sort, filter, pagination, empty state" },
  { id: "form-auth", label: "Auth / sign-in form", category: "ui", hint: "Fields, validation, OAuth buttons" },
  { id: "modal", label: "Modal / dialog", category: "ui", hint: "Focus trap, overlay, actions" },
  { id: "cta-button", label: "Button / CTA system", category: "ui", hint: "Variants, loading, icon slots" },
  { id: "dashboard", label: "Dashboard shell", category: "ui", hint: "Widgets, KPIs, chart placeholders" },
  { id: "settings-page", label: "Settings page", category: "ui", hint: "Sections, toggles, save feedback" },
  { id: "toast", label: "Toast / notification", category: "ui", hint: "Queue, dismiss, severity styles" },
  { id: "search-command", label: "Search / command palette", category: "ui", hint: "Keyboard shortcut, fuzzy list" },
  { id: "footer", label: "Site footer", category: "ui", hint: "Columns, legal links, newsletter" },
  { id: "api-handler", label: "API route handler", category: "arch", hint: "Method, validation, errors" },
  { id: "data-hook", label: "Data hook / client fetch", category: "arch", hint: "SWR/React Query pattern" },
  { id: "custom", label: "Custom element…", category: "ui", hint: "Describe your own" },
];

export function getElementLabel(id: ElementCatalogId, custom?: string): string {
  if (id === "custom" && custom?.trim()) return custom.trim();
  return ELEMENT_CATALOG.find((e) => e.id === id)?.label ?? "UI element";
}

export type ElementBuildPromptInput = RepoPromptMapContext & {
  elementId: ElementCatalogId;
  customElement?: string;
};

function inferElementFromPath(path: string): ElementCatalogId | null {
  const p = path.toLowerCase();
  if (/nav|header|navbar|topbar/.test(p)) return "nav-shell";
  if (/sidebar|sidenav|drawer/.test(p)) return "sidebar";
  if (/hero|landing|banner/.test(p)) return "hero";
  if (/table|datagrid|grid.*row/.test(p)) return "data-table";
  if (/modal|dialog|sheet/.test(p)) return "modal";
  if (/login|sign-?in|auth|register/.test(p)) return "form-auth";
  if (/footer/.test(p)) return "footer";
  if (/toast|snackbar|notification/.test(p)) return "toast";
  if (/command|palette|search/.test(p)) return "search-command";
  if (/dashboard/.test(p)) return "dashboard";
  if (/settings|preferences/.test(p)) return "settings-page";
  if (/button|btn/.test(p)) return "cta-button";
  if (/card/.test(p)) return "card-grid";
  if (/api\/|route\.ts|handler/.test(p)) return "api-handler";
  if (/use[A-Z]|hook/.test(p)) return "data-hook";
  return null;
}

const ELEMENT_BRIEFS: Record<Exclude<ElementCatalogId, "custom">, string[]> = {
  "nav-shell": ["Layout: logo, links, responsive collapse", "States: active route, mobile drawer", "A11y: keyboard nav"],
  sidebar: ["Sections, icons, collapse", "Active route styling", "Persist layout preference"],
  hero: ["Type scale, CTA hierarchy", "Media/background treatment", "Spacing rhythm"],
  "card-grid": ["Grid breakpoints", "Card anatomy", "Skeleton/empty states"],
  "data-table": ["Columns, sort, filter", "Pagination", "Row actions"],
  "form-auth": ["Fields, validation UX", "Submit loading", "OAuth row if any"],
  modal: ["Overlay, sizes", "Focus trap", "Footer actions"],
  "cta-button": ["Variant matrix", "Icon slots", "Loading/disabled"],
  dashboard: ["Widget grid", "KPI placeholders", "Filter bar"],
  "settings-page": ["Grouped sections", "Save feedback", "Danger zone"],
  toast: ["Stack position", "Dismiss", "Severity styles"],
  "search-command": ["Kbd hint", "Grouped results", "Empty state"],
  footer: ["Link columns", "Legal row", "Newsletter slot"],
  "api-handler": ["Method, schema", "Auth order", "Error envelope"],
  "data-hook": ["Cache policy", "Loading/error shape", "Optimistic updates"],
};

export function suggestElementId(nodes: Node[], selectedNodeIds: string[]): ElementCatalogId {
  const fileNodes = getFileNodes(nodes);
  const focus =
    selectedNodeIds.length > 0
      ? fileNodes.filter((n) => selectedNodeIds.includes(n.id))
      : fileNodes.slice(0, 1);

  for (const n of focus) {
    const path = (n.data as FileNodeData).path ?? "";
    const inferred = inferElementFromPath(path);
    if (inferred) return inferred;
    const cat = uiStudioCategory(path);
    if (cat === "routing") return "nav-shell";
    if (cat === "entry") return "hero";
    if (cat === "component") return "card-grid";
    if (cat === "hook") return "data-hook";
    if (cat === "style") return "cta-button";
  }

  const first = focus[0];
  if (first) {
    const role =
      ((first.data as FileNodeData).role as ArchRole) ??
      analyzeFileSemantics((first.data as FileNodeData).path ?? "").role;
    if (role === "api") return "api-handler";
    if (role === "routing") return "nav-shell";
    if (role === "ui") return "card-grid";
  }

  return "card-grid";
}

export function buildElementBuildPrompt(ctx: ElementBuildPromptInput): string {
  const {
    repoName,
    repoUrl,
    mapMode,
    elementId,
    customElement,
    targetProject,
    targetStack,
    notes,
    nodes,
    edges,
    selectedNodeIds,
    sourceFiles,
  } = ctx;

  const label = getElementLabel(elementId, customElement);
  const fileNodes = getFileNodes(nodes);
  const selected = getSelectedFileNodes(nodes, selectedNodeIds);
  const primary = selected[0];
  const primaryData = primary?.data as FileNodeData | undefined;
  const primaryPath = primaryData?.path;
  const primaryName = primaryPath?.split("/").pop();

  const inspiration = inspirationLine(repoName, repoUrl);
  const refLine = primaryPath
    ? ` — inspired by \`${primaryPath}\`${primaryName ? ` (${primaryName})` : ""} in ${inspiration}`
    : ` — inspired by patterns in ${inspiration}`;

  const brief =
    elementId !== "custom"
      ? ELEMENT_BRIEFS[elementId]
      : ["Layout, states, tokens", "Props/API surface", "A11y and responsive behavior"];

  const relatedFiles =
    selected.length > 1
      ? selected.slice(1, 6).map((n) => `- \`${(n.data as FileNodeData).path}\``).join("\n")
      : "";

  const graphBlock = primary
    ? formatNeighbors(primary.id, fileNodes, edges)
    : "_Select a file on the map to anchor graph context._";

  const catalogHint = ELEMENT_CATALOG.find((e) => e.id === elementId)?.hint ?? "";

  return `Ask me how to build elements like: **${label}**${refLine}.

You are my implementation coach. Recreate this **UI or function-level piece** in my codebase using the repo as **design + structure inspiration** — not a blind fork.

${targetBlock({ targetProject, targetStack })}
**CodeMap:** ${mapMode} map · ${label}${catalogHint ? ` · _${catalogHint}_` : ""}
${notes ? `\n**Notes:** ${notes}\n` : ""}

---

## Reference (GitHub map)

${primaryPath ? `**Primary file:** \`${primaryPath}\`` : "**Primary file:** _(select on map)_"}
${primaryData?.summary ? `\n**What it does:** ${primaryData.summary}` : ""}
${primaryData?.purpose ? `\n**Role:** ${primaryData.purpose}` : ""}
${relatedFiles ? `\n**Also study:**\n${relatedFiles}` : ""}

### Connections

${graphBlock}

---

## Extract from inspiration

${brief.map((b) => `- ${b}`).join("\n")}

---

## Ask me step by step

1. Decompose the reference into regions, states, and data deps.
2. Propose component/API types for ${targetStack || "my stack"}.
3. List design tokens to define first.
4. Generate minimal implementation + loading/empty/error.
5. What **not** to port from ${repoName}.

---

## Acceptance criteria

- Recognizable as the same *kind* of element, adapted to my design system
- Accessible and responsive
- Testable default + one edge state

${formatSourceSnippet(sourceFiles)}
${attachSourceTip(!!sourceFiles?.length)}`;
}
