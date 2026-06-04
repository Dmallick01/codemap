import type { Node, Edge } from "@xyflow/react";
import type { FileNodeData } from "@/lib/store/graph";
import { analyzeFileSemantics, type ArchRole } from "@/lib/graph/semantic";

export type SecurityFinding = {
  category: string;
  severity: "high" | "medium" | "low" | "info";
  detail: string;
};

export type SecurityExportInput = {
  repoName: string;
  repoUrl: string | null;
  mapMode: string;
  nodes: Node[];
  edges: Edge[];
  selectedNodeIds: string[];
  targetProject?: string;
  targetStack?: string;
  securityNotes?: string;
  labFindings?: SecurityFinding[];
};

const AUTH_PATH_RE =
  /(middleware|auth|login|sign-?in|sign-?up|session|oauth|passport|clerk|next-auth|protected|guard)/i;

const SECRET_PATH_RE =
  /(\.env|secret|credential|private[_-]?key|\.pem|id_rsa|token\.json)/i;

const CONFIG_SECURITY_RE =
  /(next\.config|vercel\.json|nginx|docker-compose|csp|helmet|cors|security)/i;

function roleOf(path: string): ArchRole {
  return analyzeFileSemantics(path).role;
}

export function buildSecurityPrompt(ctx: SecurityExportInput): string {
  const {
    repoName,
    repoUrl,
    mapMode,
    nodes,
    selectedNodeIds,
    targetProject,
    targetStack,
    securityNotes,
    labFindings = [],
  } = ctx;

  const fileNodes = nodes.filter((n) => n.type === "fileNode");
  const paths = fileNodes.map((n) => (n.data as FileNodeData).path ?? n.id);
  const selected =
    selectedNodeIds.length > 0
      ? fileNodes.filter((n) => selectedNodeIds.includes(n.id))
      : fileNodes;

  const authPaths = paths.filter((p) => AUTH_PATH_RE.test(p)).slice(0, 20);
  const secretPaths = paths.filter((p) => SECRET_PATH_RE.test(p)).slice(0, 15);
  const configPaths = paths.filter((p) => CONFIG_SECURITY_RE.test(p)).slice(0, 15);
  const apiPaths = paths.filter((p) => roleOf(p) === "api").slice(0, 15);
  const entryPaths = paths.filter((p) => roleOf(p) === "entry").slice(0, 10);

  const focusBlock =
    selected.length > 0
      ? `**Scope:** ${selected.length} selected anchor(s) from the map.\n`
      : `**Scope:** Full repository map (${fileNodes.length} anchors).\n`;

  const findingsBlock =
    labFindings.length > 0
      ? labFindings
          .map(
            (f) =>
              `- [${f.severity.toUpperCase()}] **${f.category}:** ${f.detail}`,
          )
          .join("\n")
      : "_Run GitHub Lab → Security instruments for live advisories._";

  return `# Security implementation brief — ${repoName}

You are hardening or **re-implementing security-sensitive parts** of an analyzed repository into a new codebase. This is not a penetration test report—it is an **actionable build spec** for engineers and coding agents.

${repoUrl ? `**Source:** [${repoName}](${repoUrl})\n` : `**Source:** ${repoName}\n`}
**Map mode:** ${mapMode}
${targetProject ? `**Target app:** ${targetProject}${targetStack ? ` · ${targetStack}` : ""}\n` : ""}
${focusBlock}
${securityNotes ? `**Operator notes:** ${securityNotes}\n` : ""}

---

## Threat model (baseline)

| Surface | In this map |
|--------|-------------|
| Public entry | ${entryPaths.length} entry anchor(s) |
| API / server | ${apiPaths.length} API anchor(s) |
| Auth/session | ${authPaths.length} auth-related path(s) |
| Secrets risk | ${secretPaths.length} sensitive path(s) in tree |
| Platform config | ${configPaths.length} config/deploy path(s) |

Assume: hostile input on all public routes, leaked env vars, and dependency supply-chain risk.

---

## Auth & session surface

${authPaths.length ? authPaths.map((p) => `- \`${p}\``).join("\n") : "_No explicit auth paths detected—verify manually._"}

**Implement:** fail-closed middleware, secure session cookies (HttpOnly, Secure, SameSite), CSRF on state-changing routes, OAuth state/nonce validation.

---

## API & data boundaries

${apiPaths.length ? apiPaths.map((p) => `- \`${p}\``).join("\n") : "_No dedicated API anchors—check server actions._"}

**Implement:** input validation at boundary, least-privilege DB credentials, no secrets in client bundles.

---

## Secrets & configuration

${secretPaths.length ? secretPaths.map((p) => `- \`${p}\` _(verify not committed)_`).join("\n") : "_No obvious secret paths in map._"}

${configPaths.length ? "\n**Config files to review:**\n" + configPaths.map((p) => `- \`${p}\``).join("\n") : ""}

**Implement:** secrets only via env/secret manager; rotate keys; never log tokens; scan CI for plaintext secrets.

---

## Live findings (GitHub Lab / Security)

${findingsBlock}

---

## OWASP-aligned checklist (apply to target app)

1. **Access control** — default deny; authorize every API route and server action.
2. **Cryptography** — TLS everywhere; modern password hashing if storing passwords.
3. **Injection** — parameterized queries; sanitize HTML; validate JSON bodies.
4. **Design** — no security by obscurity; rate-limit auth endpoints.
5. **Configuration** — disable debug in prod; secure headers (CSP, HSTS, X-Frame-Options).
6. **Dependencies** — pin versions; monitor advisories; automated Dependabot/Renovate.
7. **Auth** — MFA option for admin; secure password reset flows.
8. **Logging** — audit auth failures; never log secrets.
9. **CI/CD** — least-privilege GITHUB_TOKEN; OIDC to cloud; no write-all on PR workflows.

---

## Deliverables for the implementing agent

1. Short **security architecture** diagram (text) for target app.
2. List of **files/modules** to create or port from selected anchors.
3. **Test plan:** authz tests, secret scanning, dependency audit command.
4. Explicit **non-goals** (what not to copy from source).

## Anti-patterns

- Copying \`.env\` or API keys from the source repo
- Disabling CSRF/CORS "to make it work"
- Trusting client-side role checks without server verification
`;
}
