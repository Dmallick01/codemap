"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { FileNodeData } from "@/lib/store/graph";
import { ROLE_META, type ArchRole } from "@/lib/graph/semantic";

const LANG_STYLES: Record<string, { badge: string }> = {
  typescript: { badge: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  tsx: { badge: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  javascript: { badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },
  jsx: { badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },
  python: { badge: "bg-green-500/20 text-green-300 border-green-500/40" },
  go: { badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" },
  rust: { badge: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  java: { badge: "bg-red-500/20 text-red-300 border-red-500/40" },
};

const DEFAULT_LANG = {
  badge: "bg-gray-500/20 text-gray-400 border-gray-500/40",
};

function getFilename(path: string | undefined): string {
  if (!path) return "unknown";
  return path.split("/").pop() ?? path;
}

function getExtLabel(language: string | undefined): string {
  if (!language) return "?";
  const map: Record<string, string> = {
    typescript: "TS",
    tsx: "TSX",
    javascript: "JS",
    jsx: "JSX",
    python: "PY",
    go: "GO",
    rust: "RS",
    java: "JV",
  };
  return map[language.toLowerCase()] ?? language.slice(0, 3).toUpperCase();
}

interface FileNodeProps {
  data: FileNodeData & { bundleSelected?: boolean };
  selected?: boolean;
}

export default memo(function FileNode({ data, selected }: FileNodeProps) {
  const inBundle = !!data.bundleSelected;
  const langStyle = LANG_STYLES[data.language?.toLowerCase() ?? ""] ?? DEFAULT_LANG;
  const role = (data.role as ArchRole) ?? "core";
  const roleMeta = ROLE_META[role] ?? ROLE_META.core;
  const fname = getFilename(data.path);
  const extLabel = getExtLabel(data.language);

  return (
    <div
      className={[
        "map-file-node relative rounded-lg border overflow-visible",
        "px-3 py-2.5 min-w-[200px] max-w-[240px]",
        "transition-all duration-150 cursor-pointer",
        selected
          ? "map-file-node-selected ring-2 shadow-2xl"
          : inBundle
            ? "ring-1 ring-violet-400/70"
            : "hover:shadow-xl",
      ].join(" ")}
      style={{
        borderColor: selected
          ? roleMeta.color
          : inBundle
            ? "rgba(167,139,250,0.6)"
            : roleMeta.border,
        boxShadow: selected
          ? `0 0 0 1px ${roleMeta.color}50, var(--map-node-shadow)`
          : inBundle
            ? "0 0 14px rgba(139,92,246,0.2), var(--map-node-shadow)"
            : "var(--map-node-shadow)",
        ...(selected ? { ["--tw-ring-color" as string]: roleMeta.color } : {}),
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !border-2"
        style={{ background: roleMeta.color, borderColor: "var(--canvas-bg)" }}
      />

      {inBundle && (
        <span
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white border"
          style={{
            background: "rgba(139, 92, 246, 0.85)",
            borderColor: "var(--canvas-bg)",
          }}
        >
          ✓
        </span>
      )}

      <div className="flex items-center gap-1 mb-1">
        <span
          className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{
            color: roleMeta.color,
            background: roleMeta.bg,
            border: `1px solid ${roleMeta.border}`,
          }}
        >
          {data.roleLabel ?? roleMeta.label}
        </span>
        <span
          className={`text-[8px] font-mono px-1 py-0.5 rounded border ${langStyle.badge}`}
        >
          {extLabel}
        </span>
      </div>

      <p className="map-file-node-title font-semibold truncate leading-tight" title={data.path}>
        {fname}
      </p>

      <p className="map-file-node-path text-[10px] truncate mt-0.5 font-mono" title={data.path}>
        {data.path}
      </p>

      {data.summary && (
        <p className="map-file-node-summary text-[10px] leading-snug line-clamp-2 mt-1.5">
          {data.summary}
        </p>
      )}

      {data.frameworkLabel && (
        <p className="map-file-node-framework text-[9px] mt-1 truncate opacity-80">
          {data.frameworkLabel}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !border-2"
        style={{ background: roleMeta.color, borderColor: "var(--canvas-bg)" }}
      />
    </div>
  );
});
