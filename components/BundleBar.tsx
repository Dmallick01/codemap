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
    <div className="flex-none border-t border-violet-500/30 bg-violet-950/40 z-30">
      <div className="px-4 py-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">
          Export bundle · {anchors.length}/{max}
        </span>
        {atCap && (
          <span className="text-[9px] text-amber-400/90">Max anchors</span>
        )}
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {anchors.map((a) => (
            <span
              key={a.nodeId}
              className="inline-flex items-center gap-1 text-[10px] font-mono bg-gray-900/80 border border-violet-500/30 rounded px-2 py-0.5 max-w-[14rem]"
            >
              <button
                type="button"
                onClick={() => onFocus(a.nodeId)}
                className="truncate text-violet-200 hover:text-white"
                title={a.path}
              >
                {a.path.split("/").pop()}
              </button>
              <button
                type="button"
                onClick={() => onRemove(a.nodeId)}
                className="text-gray-500 hover:text-red-400 shrink-0"
                aria-label="Remove from bundle"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onExport}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white"
        >
          Export bundle prompt
        </button>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] px-2 py-1 rounded border border-gray-700 text-gray-500 hover:text-gray-300"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
