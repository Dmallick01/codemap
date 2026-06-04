import type { ArchRole } from "@/lib/graph/semantic";

export type CapabilityTemplate = {
  title: string;
  acceptanceCriteria: string[];
  portingNotes: string[];
};

const TEMPLATES: Record<ArchRole, CapabilityTemplate> = {
  entry: {
    title: "Application entry / landing",
    acceptanceCriteria: [
      "User can reach the main entry route or shell without errors",
      "Bootstrap logic (providers, theme, analytics hooks) matches target stack",
      "Environment variables documented for local run",
    ],
    portingNotes: [
      "Map framework-specific entry (e.g. `app/page.tsx`, `main.ts`) to your router",
      "Do not copy global CSS/assets unless required for the feature",
    ],
  },
  routing: {
    title: "Routing & navigation shell",
    acceptanceCriteria: [
      "Routes or segments exist with equivalent URL behavior",
      "Layouts / middleware hooks applied where the source uses them",
      "404 and loading states considered",
    ],
    portingNotes: [
      "Translate file-based routes to your router conventions",
      "Keep auth guards in middleware/layout, not scattered in pages",
    ],
  },
  ui: {
    title: "UI component / view",
    acceptanceCriteria: [
      "Component renders with equivalent props and states",
      "Accessible labels and keyboard focus order preserved",
      "Styling adapted to target design system (not copied verbatim)",
    ],
    portingNotes: [
      "Split presentation from data-fetching if the source mixes them",
      "Replace source UI library primitives with target equivalents",
    ],
  },
  api: {
    title: "API / server handler",
    acceptanceCriteria: [
      "HTTP method, path, and request/response shape documented",
      "Auth, validation, and error responses implemented",
      "Rate limits / CORS / webhooks configured for target deployment",
    ],
    portingNotes: [
      "Map handler framework (Route Handlers, Express, FastAPI) explicitly",
      "Extract business logic to a service module testable without HTTP",
    ],
  },
  core: {
    title: "Core business logic / service",
    acceptanceCriteria: [
      "Public functions or class API documented",
      "Edge cases and errors handled consistently",
      "Unit tests cover main branches",
    ],
    portingNotes: [
      "Prefer interfaces for external deps (DB, queues, third-party APIs)",
      "Avoid importing UI or HTTP layers into core modules",
    ],
  },
  tool: {
    title: "Pipeline / automation / ingest",
    acceptanceCriteria: [
      "Job steps, retries, and failure modes documented",
      "Progress reporting or logging hooks for operators",
      "Idempotent re-runs where the source expects them",
    ],
    portingNotes: [
      "Run heavy work in background workers in production",
      "Cap concurrency and payload size like the source",
    ],
  },
  data: {
    title: "Data model / persistence",
    acceptanceCriteria: [
      "Schema or models created in target ORM",
      "Migrations / seed strategy documented",
      "Queries used by the capability identified",
    ],
    portingNotes: [
      "Do not copy vendor-specific SQL unless targeting same DB",
      "Map relations and indexes; simplify if target app is smaller",
    ],
  },
  config: {
    title: "Configuration & tooling",
    acceptanceCriteria: [
      "Only env vars and build settings required by the capability listed",
      "CI/build steps run in target repo",
    ],
    portingNotes: [
      "Often skip copying whole config files — extract required keys only",
    ],
  },
  test: {
    title: "Tests & fixtures",
    acceptanceCriteria: [
      "Critical paths have equivalent tests in target test runner",
      "Fixtures or mocks for external services included",
    ],
    portingNotes: [
      "Port behavior assertions, not file paths or snapshot noise",
    ],
  },
};

export function getCapabilityTemplate(role: ArchRole | string | undefined): CapabilityTemplate {
  const key = (role as ArchRole) in TEMPLATES ? (role as ArchRole) : "core";
  return TEMPLATES[key] ?? TEMPLATES.core;
}

export function formatTemplateBlock(role: ArchRole | string | undefined): string {
  const t = getCapabilityTemplate(role);
  const criteria = t.acceptanceCriteria.map((c) => `- [ ] ${c}`).join("\n");
  const notes = t.portingNotes.map((n) => `- ${n}`).join("\n");
  return `### ${t.title}

**Acceptance criteria**
${criteria}

**Porting notes**
${notes}`;
}
