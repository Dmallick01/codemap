"use client";

import { memo } from "react";
import type { GroupNodeData } from "@/lib/graph/layout";

interface GroupNodeProps {
  data: GroupNodeData;
}

export default memo(function GroupNode({ data }: GroupNodeProps) {
  return (
    <div
      className="relative rounded-xl border-2 border-dashed h-full w-full pointer-events-none"
      style={{
        background: data.bg,
        borderColor: data.border,
      }}
    >
      <div
        className="map-group-label absolute -top-3 left-3 px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide flex items-center gap-1.5"
        style={{
          border: `1px solid ${data.border}`,
          color: data.color,
        }}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: data.color }}
        />
        <span>{data.roleLabel}</span>
        <span className="map-group-label-sub font-normal">·</span>
        <span className="map-group-label-title font-normal truncate max-w-[180px]">
          {data.label}
        </span>
        <span className="map-group-label-sub font-mono text-[10px]">
          {data.fileCount} files
        </span>
      </div>
    </div>
  );
});
