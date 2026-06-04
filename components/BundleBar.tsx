"use client";

import type { BundleAnchor } from "@/lib/export/bundle";

type Props = {
  anchors: BundleAnchor[];
  max: number;
  atCap: boolean;
  onClear: () => void;
  onRemove: (nodeId: string) => void;
  onExport: () => void;
  onFocus: (nodeId: string) => void;
};

export default function BundleBar({
  anchors,
  max,
  atCap,
  onClear,
  onRemove,
  onExport,
  onFocus,
}: Props) {
  if (anchors.length === 0) return null;

  return (
    <div
      className="flex-none z-30 border-t px-3 py-2"
      style={{
        borderColor: "var(--role-routing)",
        background: "rgba(167, 139, 250, 0.08)",
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--role-routing)" }}
        >
          Export bundle · {anchors.length}/{max}
        </span>
        {atCap && (
          <span className="text-[9px]" style={{ color: "var(--role-core)" }}>
            Max anchors
          </span>
        )}
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {anchors.map((a) => (
            <span
              key={a.nodeId}
              className="inline-flex items-center gap-1 text-[10px] font-mono rounded px-2 py-0.5 max-w-[14rem] border"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-elevated)",
              }}
            >
              <button
                type="button"
                onClick={() => onFocus(a.nodeId)}
                className="truncate hover:underline"
                style={{ color: "var(--text-primary)" }}
                title={a.path}
              >
                {a.path.split("/").pop()}
              </button>
              <button
                type="button"
                onClick={() => onRemove(a.nodeId)}
                className="shrink-0"
                style={{ color: "var(--text-muted)" }}
                aria-label="Remove from bundle"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <button type="button" onClick={onExport} className="btn-blueprint-primary">
          Export bundle prompt
        </button>
        <button type="button" onClick={onClear} className="btn-blueprint">
          Clear
        </button>
      </div>
    </div>
  );
}
