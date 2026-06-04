import { buildUiDesignPrompt, type UiDesignExportInput } from "@/lib/export/ui-design-prompt";

export function buildCombinedUiExport(ctx: UiDesignExportInput): string {
  const ui = buildUiDesignPrompt(ctx);
  if (!ctx.designMd?.trim()) return ui;
  return `${ui}

---

# DESIGN.md (standalone — Google Labs format)

Save as \`DESIGN.md\` at the project root for agent reference:

\`\`\`markdown
${ctx.designMd.trim()}
\`\`\`
`;
}
