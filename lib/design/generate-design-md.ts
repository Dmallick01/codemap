import type { ExtractedTokens } from "@/lib/design/extract-tokens";

export type DesignMdMeta = {
  name: string;
  description?: string;
  repoUrl?: string | null;
};

export function generateDesignMd(
  tokens: ExtractedTokens,
  meta: DesignMdMeta,
): string {
  const primary =
    tokens.colors.accent ??
    tokens.colors["role.ui"] ??
    tokens.colors.primary ??
    Object.values(tokens.colors)[0] ??
    "#34d399";
  const bg =
    tokens.colors["bg.base"] ??
    tokens.colors.background ??
    "#050a08";
  const text =
    tokens.colors["text.primary"] ??
    tokens.colors.foreground ??
    "#e8f5ec";

  const colorYaml = Object.entries(tokens.colors)
    .slice(0, 24)
    .map(([k, v]) => `  ${k.replace(/\./g, "-")}: "${v}"`)
    .join("\n");

  const spacingYaml = Object.entries(tokens.spacing)
    .slice(0, 12)
    .map(([k, v]) => `  ${k}: ${v.includes("px") || v.includes("rem") ? `"${v}"` : v}`)
    .join("\n");

  return `---
version: alpha
name: ${meta.name}
description: ${meta.description ?? `Design system extracted from ${meta.name} via CodeMap UI Studio`}
colors:
  primary: "${primary}"
  background: "${bg}"
  foreground: "${text}"
${colorYaml ? colorYaml + "\n" : ""}${spacingYaml ? `spacing:\n${spacingYaml}\n` : ""}components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
  panel:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
---

## Design Philosophy

This DESIGN.md was **generated from repository style sources** (${tokens.sources.join(", ") || "map heuristics"}) by [CodeMap](${meta.repoUrl ?? "https://github.com/Dmallick01/codemap"}) UI Studio. Use it as the normative brand layer when rebuilding UI in a target app.

${meta.repoUrl ? `**Source repository:** ${meta.repoUrl}\n` : ""}

## Colors

- **primary** — main accent for CTAs, active nav, and focus rings.
- **background** — app shell and panel surfaces.
- **foreground** — default body text.

Map additional keys from extracted CSS/Tailwind variables above; prefer token references over hard-coded hex in new components.

## Typography

Use the stack implied by the source repo${Object.keys(tokens.fonts).length ? ` (${Object.keys(tokens.fonts).slice(0, 3).join(", ")})` : ""}. Prefer system UI fonts unless the target stack specifies otherwise.

## Spacing & layout

Follow an 4px/8px rhythm where possible. Spacing tokens from the source are listed in YAML front matter.

## Components

- **button-primary** — primary actions only; one per view max when possible.
- **panel** — cards, drawers, and map chrome.

## Accessibility

- Maintain **WCAG AA** contrast for \`button-primary\` and body text pairs.
- Run \`npx @google/design.md lint DESIGN.md\` before shipping.
- Respect \`prefers-reduced-motion\` for animations copied from the source UI.

## Anti-patterns

- Do not copy backend routes, secrets, or CI config into UI work.
- Do not invent colors outside the token block without documenting them here.
`;
}
