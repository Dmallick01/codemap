"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { FileNodeData } from "@/lib/store/graph";

const LANG_STYLES: Record<string, { badge: string; accent: string }> = {
  typescript: {
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    accent: "border-l-blue-500",
  },
  tsx: {
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    accent: "border-l-blue-500",
  },
  javascript: {
    badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    accent: "border-l-yellow-500",
  },
  jsx: {
    badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    accent: "border-l-yellow-500",
  },
  python: {
    badge: "bg-green-500/20 text-green-300 border-green-500/40",
    accent: "border-l-green-500",
  },
  go: {
    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    accent: "border-l-cyan-500",
  },
  rust: {
    badge: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    accent: "border-l-orange-500",
  },
  java: {
    badge: "bg-red-500/20 text-red-300 border-red-500/40",
    accent: "border-l-red-500",
  },
  css: {
    badge: "bg-pink-500/20 text-pink-300 border-pink-500/40",
    accent: "border-l-pink-500",
  },
  html: {
    badge: "bg-orange-400/20 text-orange-300 border-orange-400/40",
    accent: "border-l-orange-400",
  },
};

const DEFAULT_STYLE = {
  badge: "bg-gray-500/20 text-gray-400 border-gray-500/40",
  accent: "border-l-gray-600",
};

function getLangStyle(language: string | undefined) {
  if (!language) return DEFAULT_STYLE;
  return LANG_STYLES[language.toLowerCase()] ?? DEFAULT_STYLE;
}

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
    css: "CSS",
    html: "HTML",
  };
  return map[language.toLowerCase()] ?? language.slice(0, 3).toUpperCase();
}

interface FileNodeProps {
  data: FileNodeData;
  selected?: boolean;
}

export default memo(function FileNode({ data, selected }: FileNodeProps) {
  const style = getLangStyle(data.language);
  const fname = getFilename(data.path);
  const extLabel = getExtLabel(data.language);
  const moduleCount = data.modules?.length ?? 0;
  const funcCount =
    data.modules?.reduce((s, m) => s + m.functions.length, 0) ?? 0;

  return (
    <div
      className={[
        "relative rounded-lg border border-gray-700/80 border-l-[3px] bg-gray-900/95",
        "px-3 py-2.5 shadow-lg min-w-[160px] max-w-[220px]",
        "transition-all duration-100 cursor-pointer",
        style.accent,
        selected
          ? "ring-2 ring-white/25 border-gray-500 shadow-2xl"
          : "hover:border-gray-600 hover:shadow-xl",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-gray-600 !border-gray-500"
      />

      {/* Header row: ext badge + filename */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border flex-shrink-0 leading-none ${style.badge}`}
        >
          {extLabel}
        </span>
        <span
          className="text-[11px] font-medium text-gray-100 truncate leading-tight"
          title={data.path}
        >
          {fname}
        </span>
      </div>

      {/* Summary snippet */}
      {data.summary && (
        <p className="text-[9px] leading-snug text-gray-400 line-clamp-2 mb-1.5">
          {data.summary}
        </p>
      )}

      {/* Stats row */}
      {(moduleCount > 0 || funcCount > 0) && (
        <div className="flex items-center gap-2">
          {moduleCount > 0 && (
            <span className="text-[9px] text-gray-600">
              {moduleCount} {moduleCount === 1 ? "mod" : "mods"}
            </span>
          )}
          {funcCount > 0 && (
            <span className="text-[9px] text-gray-600">
              {funcCount} {funcCount === 1 ? "fn" : "fns"}
            </span>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-gray-600 !border-gray-500"
      />
    </div>
  );
});
