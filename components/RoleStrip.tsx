import { ROLE_META, type ArchRole } from "@/lib/graph/semantic";

const LAYER_ORDER: ArchRole[] = [
  "entry",
  "routing",
  "ui",
  "api",
  "core",
  "tool",
  "data",
];

const ROLE_CSS: Record<ArchRole, string> = {
  entry: "var(--role-entry)",
  routing: "var(--role-routing)",
  ui: "var(--role-ui)",
  api: "var(--role-api)",
  core: "var(--role-core)",
  tool: "var(--role-tool)",
  data: "var(--role-data)",
  config: "var(--role-config)",
  test: "var(--role-test)",
};

export default function RoleStrip() {
  return (
    <div className="flex flex-wrap justify-center gap-1.5 max-w-xl mx-auto">
      {LAYER_ORDER.map((role) => {
        const m = ROLE_META[role];
        return (
          <div
            key={role}
            className="flex items-center gap-1.5 px-2 py-1 rounded border text-[10px]"
            style={{
              borderColor: `${ROLE_CSS[role]}44`,
              background: `${ROLE_CSS[role]}14`,
              color: ROLE_CSS[role],
            }}
            title={m.description}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: ROLE_CSS[role] }}
            />
            {m.label}
          </div>
        );
      })}
    </div>
  );
}
