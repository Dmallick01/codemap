"use client";

import { ROLE_META, type ArchRole } from "@/lib/graph/semantic";
import { edgeStyle } from "@/lib/graph/semantic";

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
    <div className="rounded-lg border border-gray-800 bg-gray-950/95 backdrop-blur-sm p-3 shadow-xl text-[10px]">
      <p className="text-[9px] uppercase tracking-widest text-gray-500 font-semibold mb-2">
        How to read this map
      </p>
      <p className="text-gray-400 leading-relaxed mb-3">
        <span className="text-gray-300">X-axis</span> = architectural role
        (entry → API → core).{" "}
        <span className="text-gray-300">Y-axis</span> = folder groups spread
        down the page.
      </p>
      <div className="space-y-1.5 mb-3">
        {(Object.keys(ROLE_META) as ArchRole[])
          .filter((r) => r !== "test")
          .map((role) => {
            const m = ROLE_META[role];
            return (
              <div key={role} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: m.color }}
                />
                <span className="text-gray-300 font-medium">{m.label}</span>
                <span className="text-gray-600 truncate">{m.description}</span>
              </div>
            );
          })}
      </div>
      <p className="text-[9px] uppercase tracking-widest text-gray-500 font-semibold mb-1.5">
        Connections
      </p>
      <div className="space-y-1">
        {EDGE_TYPES.map((type) => {
          const s = edgeStyle(type);
          return (
            <div key={type} className="flex items-center gap-2">
              <span
                className="w-6 h-0.5 flex-shrink-0 rounded"
                style={{ background: s.stroke }}
              />
              <span className="text-gray-400">{s.label ?? type}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
