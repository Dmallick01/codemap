export type ExtractedTokens = {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  fonts: Record<string, string>;
  sources: string[];
};

const STYLE_PATH_RE =
  /(^|\/)(globals?\.css|global\.css|tailwind\.config\.(ts|js|mjs|cjs)|theme\.(ts|js)|variables\.css|tokens\.css)$/i;

export function isStyleSourcePath(path: string): boolean {
  return STYLE_PATH_RE.test(path) || path.includes("tailwind.config");
}

export function pickStylePaths(paths: string[]): string[] {
  const picked = paths.filter(isStyleSourcePath);
  const priority = [
    "app/globals.css",
    "src/app/globals.css",
    "styles/globals.css",
    "globals.css",
    "tailwind.config.ts",
    "tailwind.config.js",
  ];
  const ordered: string[] = [];
  for (const p of priority) {
    const hit = picked.find((x) => x === p || x.endsWith(`/${p}`));
    if (hit) ordered.push(hit);
  }
  for (const p of picked.sort()) {
    if (!ordered.includes(p)) ordered.push(p);
  }
  return ordered.slice(0, 8);
}

function parseCssVars(content: string, into: ExtractedTokens) {
  const re = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const name = m[1];
    const value = m[2].trim();
    if (/color|bg|accent|role|border|text/i.test(name) || /^#[0-9a-f]{3,8}$/i.test(value) || value.startsWith("rgb") || value.startsWith("oklch")) {
      into.colors[name.replace(/-/g, ".")] = value;
    } else if (/space|gap|radius|size/i.test(name)) {
      into.spacing[name] = value;
    } else if (/font/i.test(name)) {
      into.fonts[name] = value;
    }
  }
}

function parseTailwindColors(content: string, into: ExtractedTokens) {
  const block = content.match(/colors\s*:\s*\{([\s\S]*?)\n\s*\}/);
  if (!block) return;
  const inner = block[1];
  const entry = /['"]?([\w-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = entry.exec(inner))) {
    into.colors[`tailwind.${m[1]}`] = m[2];
  }
}

export function extractTokensFromSources(
  files: { path: string; content: string }[],
): ExtractedTokens {
  const result: ExtractedTokens = {
    colors: {},
    spacing: {},
    fonts: {},
    sources: files.map((f) => f.path),
  };

  for (const file of files) {
    if (!file.content?.trim()) continue;
    if (file.path.includes("tailwind.config")) {
      parseTailwindColors(file.content, result);
    }
    if (file.path.endsWith(".css")) {
      parseCssVars(file.content, result);
    }
  }

  return result;
}
