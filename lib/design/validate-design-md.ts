export type DesignMdLintResult = {
  ok: boolean;
  issues: string[];
  warnings: string[];
  metrics: { label: string; value: string }[];
};

function parseFrontmatter(content: string): {
  yaml: string | null;
  body: string;
} {
  const trimmed = content.trim();
  if (!trimmed.startsWith("---")) {
    return { yaml: null, body: trimmed };
  }
  const end = trimmed.indexOf("---", 3);
  if (end === -1) return { yaml: null, body: trimmed };
  return {
    yaml: trimmed.slice(3, end).trim(),
    body: trimmed.slice(end + 3).trim(),
  };
}

function parseHex(color: string): [number, number, number] | null {
  const c = color.trim().replace(/['"]/g, "");
  let hex = c;
  if (hex.startsWith("#")) hex = hex.slice(1);
  else return null;
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((x) => x + x)
      .join("");
  }
  if (hex.length !== 6) return null;
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const s = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
}

function contrastRatio(a: string, b: string): number | null {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return null;
  const la = luminance(ca);
  const lb = luminance(cb);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractQuotedColors(yaml: string): Record<string, string> {
  const colors: Record<string, string> = {};
  const section = yaml.match(/colors:\s*([\s\S]*?)(?:\n[a-z]|$)/i);
  const block = section?.[1] ?? yaml;
  const line = /^\s*([\w-]+):\s*["']?([^"'\n#]+|#[0-9a-fA-F]{3,8})["']?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = line.exec(block))) {
    if (m[2].startsWith("#")) colors[m[1]] = m[2];
  }
  return colors;
}

export function validateDesignMd(content: string): DesignMdLintResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const { yaml, body } = parseFrontmatter(content);

  if (!yaml) {
    issues.push("Missing YAML front matter (file must start with ---)");
  } else {
    if (!/^name:\s*.+/m.test(yaml)) {
      issues.push("Missing required token: name");
    }
    if (!/colors:/i.test(yaml)) {
      warnings.push("No colors: block — agents may guess palette");
    }
  }

  const requiredSections = ["Design Philosophy", "Colors", "Accessibility"];
  for (const sec of requiredSections) {
    if (!body.includes(`## ${sec}`)) {
      warnings.push(`Recommended section missing: ## ${sec}`);
    }
  }

  let contrastNote = "n/a";
  if (yaml) {
    const colors = extractQuotedColors(yaml);
    const bg = colors.background ?? colors.surface;
    const fg = colors.foreground ?? colors.primary;
    if (bg && fg) {
      const ratio = contrastRatio(bg, fg);
      if (ratio != null) {
        contrastNote = ratio.toFixed(2);
        if (ratio < 4.5) {
          issues.push(
            `WCAG AA: background/foreground contrast ${ratio.toFixed(2)} (need ≥ 4.5)`,
          );
        }
      }
    }
    const btnBg = colors.primary;
    if (btnBg && btnBg.startsWith("#")) {
      const ratio = contrastRatio(btnBg, "#ffffff");
      if (ratio != null && ratio < 4.5) {
        warnings.push(
          `WCAG AA: primary on white contrast ${ratio.toFixed(2)} (need ≥ 4.5 for small text)`,
        );
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    warnings,
    metrics: [
      { label: "Front matter", value: yaml ? "yes" : "no" },
      { label: "Body sections", value: String((body.match(/^## /gm) ?? []).length) },
      { label: "Contrast (bg/fg)", value: contrastNote },
      { label: "Issues", value: String(issues.length) },
    ],
  };
}
