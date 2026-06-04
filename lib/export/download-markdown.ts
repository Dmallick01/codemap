/** Trigger a browser download of markdown text. */
export function downloadMarkdown(filename: string, content: string): void {
  const safe = filename.replace(/[^\w.-]+/g, "_").slice(0, 80) || "codemap-export";
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safe.endsWith(".md") ? safe : `${safe}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportFilename(
  repoName: string,
  anchorCount: number,
): string {
  const slug = repoName.replace(/[^\w.-]+/g, "-").slice(0, 40);
  const date = new Date().toISOString().slice(0, 10);
  const kind = anchorCount > 1 ? `bundle-${anchorCount}` : "capability";
  return `codemap-${slug}-${kind}-${date}.md`;
}
