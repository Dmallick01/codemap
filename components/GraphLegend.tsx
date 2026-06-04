"use client";

import { ROLE_META, type ArchRole } from "@/lib/graph/semantic";
import { edgeStyle } from "@/lib/graph/semantic";

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

const EDGE_TYPES = [
  "flows",
  "imports",
  "renders",
  "powers",
  "defines",
  "contains",
] as const;

export default function GraphLegend() {
  return (
    <div className="panel-blueprint p-3 text-[13px] pointer-events-auto max-w-[280px]">
      <p className="panel-label mb-2">Blueprint legend</p>
      <p className="leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
        <span style={{ color: "var(--text-primary)" }}>X</span> = role layer ·{" "}
        <span style={{ color: "var(--text-primary)" }}>Y</span> = folder group
      </p>
      <div className="space-y-1.5 mb-3">
        {(Object.keys(ROLE_META) as ArchRole[])
          .filter((r) => r !== "test")
          .map((role) => {
            const m = ROLE_META[role];
            return (
              <div key={role} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: ROLE_CSS[role] }}
                />
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {m.label}
                </span>
                <span className="truncate" style={{ color: "var(--text-muted)" }}>
                  {m.description}
                </span>
              </div>
            );
          })}
      </div>
      <p className="panel-label mb-1.5">Connections</p>
      <div className="space-y-1">
        {EDGE_TYPES.map((type) => {
          const s = edgeStyle(type);
          return (
            <div key={type} className="flex items-center gap-2">
              <span
                className="w-6 h-0.5 shrink-0 rounded"
                style={{ background: s.stroke }}
              />
              <span style={{ color: "var(--text-secondary)" }}>
                {s.label ?? type}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
