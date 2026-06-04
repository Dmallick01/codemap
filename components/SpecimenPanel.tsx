"use client";

import type { FileNodeData } from "@/lib/store/graph";
import type { NodeNeighbors } from "@/lib/explorer/tour-order";
import { ROLE_META, type ArchRole } from "@/lib/graph/semantic";

type Props = {
  index: number;
  total: number;
  viewedCount: number;
  data: FileNodeData | null;
  nodeId: string | null;
  neighbors: NodeNeighbors;
  onJumpTo: (nodeId: string) => void;
  onExportPrompt: () => void;
  bundleCount: number;
  inBundle: boolean;
  onToggleBundle: () => void;
  atBundleCap: boolean;
};

function LinkList({
  title,
  items,
  onJumpTo,
}: {
  title: string;
  items: NodeNeighbors["outgoing"];
  onJumpTo: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-gray-600 mb-1">
        {title}
      </p>
      <ul className="space-y-1">
        {items.slice(0, 5).map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onJumpTo(item.id)}
              className="text-left w-full text-[10px] font-mono truncate"
              style={{ color: "var(--accent)" }}
              title={item.path}
            >
              {item.path.split("/").pop()}
              {item.roleLabel && (
                <span className="text-gray-600 ml-1">· {item.roleLabel}</span>
              )}
            </button>
            {item.edgeLabel && (
              <span className="text-[9px] text-gray-600 block">
                {item.edgeLabel}
              </span>
            )}
          </li>
        ))}
        {items.length > 5 && (
          <li className="text-[9px] text-gray-600">+{items.length - 5} more</li>
        )}
      </ul>
    </div>
  );
}

export default function SpecimenPanel({
  index,
  total,
  viewedCount,
  data,
  nodeId,
  neighbors,
  onJumpTo,
  onExportPrompt,
  bundleCount,
  inBundle,
  onToggleBundle,
  atBundleCap,
}: Props) {
  if (!data?.path) return null;

  const role = (data.role as ArchRole) ?? "core";
  const meta = ROLE_META[role] ?? ROLE_META.core;
  const pct = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;
  const viewedPct = total > 0 ? Math.round((viewedCount / total) * 100) : 0;
  const fname = data.path.split("/").pop() ?? data.path;

  return (
    <div
      className="flex-none border-t z-30"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--bg-glass)",
      }}
    >
      <div className="px-4 pt-3 pb-2 border-b border-gray-800/80">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[9px] uppercase tracking-widest text-violet-400/90 font-semibold">
            Repo tour · like HF Viewer
          </p>
          <span className="text-[10px] text-gray-500 font-mono">
            specimen {index + 1} / {total}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
          <div
            className="h-full bg-violet-500/80 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
          <p className="text-[9px] text-gray-600 mt-1">
          {viewedCount} of {total} explored ({viewedPct}%) · selective export like
          gitingest
        </p>
      </div>

      <div className="px-4 py-3 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className="text-[9px] font-bold uppercase px-2 py-0.5 rounded"
              style={{
                color: meta.color,
                background: meta.bg,
                border: `1px solid ${meta.border}`,
              }}
            >
              {data.roleLabel ?? meta.label}
            </span>
            {data.frameworkLabel && (
              <span className="text-[9px] text-gray-500">
                {data.frameworkLabel}
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-gray-100 truncate">
            {fname}
          </h3>
          <p className="text-[10px] font-mono text-gray-500 truncate mt-0.5">
            {data.path}
          </p>
          <p className="text-sm text-gray-300 leading-relaxed mt-2 line-clamp-3">
            {data.summary ?? data.purpose ?? "Key file in this repository."}
          </p>
          {data.groupLabel && (
            <p className="text-[10px] text-gray-600 mt-1">
              Folder group: {data.groupLabel}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 min-w-[200px] lg:min-w-[280px]">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!nodeId || (!inBundle && atBundleCap)}
              onClick={onToggleBundle}
              className={`flex-1 text-xs font-medium px-2 py-2 rounded-lg border transition-colors disabled:opacity-40 ${
                inBundle
                  ? "border-violet-400 bg-violet-500/20 text-violet-200"
                  : "border-gray-700 text-gray-400 hover:border-violet-500/50"
              }`}
            >
              {inBundle ? "In bundle ✓" : "Add to bundle"}
            </button>
            <button
              type="button"
              disabled={!nodeId}
              onClick={onExportPrompt}
              className="flex-1 text-xs font-medium px-2 py-2 rounded-lg border border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition-colors disabled:opacity-40"
            >
              {bundleCount > 0 ? `Export (${bundleCount})` : "Export prompt"}
            </button>
          </div>
          <p className="text-[9px] text-gray-600">
            Shift+click nodes to multi-select · selective gitingest, not whole repo
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LinkList
              title="Connects to →"
              items={neighbors.outgoing}
              onJumpTo={onJumpTo}
            />
            <LinkList
              title="← Used by"
              items={neighbors.incoming}
              onJumpTo={onJumpTo}
            />
          </div>
          {!neighbors.outgoing.length && !neighbors.incoming.length && (
            <p className="text-[10px] text-gray-600 italic">
              No graph edges yet — structural links appear after ingest. The map
              still shows where this file sits in the project layers.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
