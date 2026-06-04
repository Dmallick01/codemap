export type LabToolCategory =
  | "telemetry"
  | "topology"
  | "forensics"
  | "signals"
  | "security";

export type LabToolId =
  | "repo-pulse"
  | "commit-radar"
  | "contributor-spectrum"
  | "branch-map"
  | "tag-catalog"
  | "issue-telemetry"
  | "pr-flow"
  | "language-mix"
  | "code-search"
  | "tree-density"
  | "readme-lab"
  | "license-scan"
  | "actions-pulse"
  | "ref-compare"
  | "file-chronicle"
  | "rate-limit"
  | "manifest-radar"
  | "topic-cluster"
  | "clone-matrix"
  | "traffic-stats"
  | "dependency-advisories"
  | "secret-surface"
  | "auth-surface-map"
  | "actions-security"
  | "code-scanning";

export type LabToolDef = {
  id: LabToolId;
  name: string;
  short: string;
  category: LabToolCategory;
  description: string;
  icon: string;
  needsPath?: boolean;
  needsQuery?: boolean;
};

export const LAB_TOOL_REGISTRY: LabToolDef[] = [
  {
    id: "repo-pulse",
    name: "Repo Pulse",
    short: "Pulse",
    category: "telemetry",
    description: "Full repository vitals: stars, forks, size, license, visibility.",
    icon: "◉",
  },
  {
    id: "commit-radar",
    name: "Commit Radar",
    short: "Commits",
    category: "telemetry",
    description: "Recent commit stream with SHAs, authors, and timestamps.",
    icon: "◎",
  },
  {
    id: "contributor-spectrum",
    name: "Contributor Spectrum",
    short: "Authors",
    category: "telemetry",
    description: "Top contributors ranked by commit participation.",
    icon: "◈",
  },
  {
    id: "branch-map",
    name: "Branch Map",
    short: "Branches",
    category: "topology",
    description: "Branch inventory with default branch and protection hints.",
    icon: "⎇",
  },
  {
    id: "tag-catalog",
    name: "Tag Catalog",
    short: "Tags",
    category: "topology",
    description: "Recent tags and release markers on the default timeline.",
    icon: "⌖",
  },
  {
    id: "issue-telemetry",
    name: "Issue Telemetry",
    short: "Issues",
    category: "telemetry",
    description: "Open/closed issue counts and label distribution.",
    icon: "△",
  },
  {
    id: "pr-flow",
    name: "PR Flow",
    short: "PRs",
    category: "telemetry",
    description: "Pull request velocity and recent merge activity.",
    icon: "⇄",
  },
  {
    id: "language-mix",
    name: "Language Mix",
    short: "Lang",
    category: "signals",
    description: "Byte-weighted language spectrogram from GitHub linguistics.",
    icon: "◐",
  },
  {
    id: "code-search",
    name: "Code Search",
    short: "Search",
    category: "forensics",
    description: "Search code inside this repository (requires query).",
    icon: "⌕",
    needsQuery: true,
  },
  {
    id: "tree-density",
    name: "Tree Density",
    short: "Tree",
    category: "topology",
    description: "Extension histogram and folder depth from the file tree.",
    icon: "▦",
  },
  {
    id: "readme-lab",
    name: "README Lab",
    short: "README",
    category: "forensics",
    description: "README extraction with line stats and heading structure.",
    icon: "¶",
  },
  {
    id: "license-scan",
    name: "License Scan",
    short: "License",
    category: "forensics",
    description: "Detect LICENSE files and SPDX identifiers.",
    icon: "§",
  },
  {
    id: "actions-pulse",
    name: "Actions Pulse",
    short: "CI",
    category: "signals",
    description: "Recent GitHub Actions workflow run outcomes.",
    icon: "⚡",
  },
  {
    id: "ref-compare",
    name: "Ref Compare",
    short: "Diff",
    category: "topology",
    description: "Ahead/behind delta between default branch and latest tag.",
    icon: "↔",
  },
  {
    id: "file-chronicle",
    name: "File Chronicle",
    short: "Blame",
    category: "forensics",
    description: "Last commit touching the selected map file path.",
    icon: "⏱",
    needsPath: true,
  },
  {
    id: "rate-limit",
    name: "Rate Limit",
    short: "Quota",
    category: "signals",
    description: "GitHub API rate limit budget for this session token.",
    icon: "◌",
  },
  {
    id: "manifest-radar",
    name: "Manifest Radar",
    short: "Deps",
    category: "forensics",
    description: "Package manifests detected in tree (npm, pip, cargo, go).",
    icon: "⊞",
  },
  {
    id: "topic-cluster",
    name: "Topic Cluster",
    short: "Topics",
    category: "signals",
    description: "GitHub topics, description tokens, and discovery metadata.",
    icon: "◆",
  },
  {
    id: "clone-matrix",
    name: "Clone Matrix",
    short: "Clone",
    category: "topology",
    description: "HTTPS, SSH, and archive URLs for reproducible checkout.",
    icon: "⎘",
  },
  {
    id: "traffic-stats",
    name: "Traffic Stats",
    short: "Views",
    category: "telemetry",
    description: "Clone and view traffic (requires push access or public metrics).",
    icon: "↗",
  },
  {
    id: "dependency-advisories",
    name: "Dependency Advisories",
    short: "Deps",
    category: "security",
    description: "Open Dependabot security advisories for this repository.",
    icon: "⚠",
  },
  {
    id: "secret-surface",
    name: "Secret Surface",
    short: "Secrets",
    category: "security",
    description: "Paths that may contain secrets (.env, keys, tokens) from the map tree.",
    icon: "🔐",
  },
  {
    id: "auth-surface-map",
    name: "Auth Surface",
    short: "Auth",
    category: "security",
    description: "Auth, session, and middleware paths detected in the map.",
    icon: "🛡",
  },
  {
    id: "actions-security",
    name: "Actions Security",
    short: "CI",
    category: "security",
    description: "GitHub Actions workflows and hardening reminders.",
    icon: "⚙",
  },
  {
    id: "code-scanning",
    name: "Code Scanning",
    short: "SAST",
    category: "security",
    description: "Open CodeQL / code scanning alerts when available.",
    icon: "⌁",
  },
];

export const LAB_CATEGORY_LABELS: Record<LabToolCategory, string> = {
  telemetry: "Telemetry",
  topology: "Topology",
  forensics: "Forensics",
  signals: "Signals",
  security: "Security",
};

export function getLabTool(id: string): LabToolDef | undefined {
  return LAB_TOOL_REGISTRY.find((t) => t.id === id);
}
