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
        className="absolute -top-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide flex items-center gap-1.5 shadow-md"
        style={{
          background: "#0f172a",
          border: `1px solid ${data.border}`,
          color: data.color,
        }}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: data.color }}
        />
        <span>{data.roleLabel}</span>
        <span className="text-gray-500 font-normal">·</span>
        <span className="text-gray-300 font-normal truncate max-w-[180px]">
          {data.label}
        </span>
        <span className="text-gray-600 font-mono text-[9px]">
          {data.fileCount} files
        </span>
      </div>
    </div>
  );
});
