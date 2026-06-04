"use client";

import type { FileNodeData } from "@/lib/store/graph";
import type { NodeNeighbors } from "@/lib/explorer/tour-order";
import { ROLE_META, type ArchRole } from "@/lib/graph/semantic";

type Props = {
  index: number;
  total: number;
  viewedCount: number;
  data: FileNodeData | null;
  neighbors: NodeNeighbors;
  onJumpTo: (nodeId: string) => void;
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
              className="text-left w-full text-[10px] font-mono text-blue-400/90 hover:text-blue-300 truncate"
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
  neighbors,
  onJumpTo,
}: Props) {
  if (!data?.path) return null;

  const role = (data.role as ArchRole) ?? "core";
  const meta = ROLE_META[role] ?? ROLE_META.core;
  const pct = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;
  const viewedPct = total > 0 ? Math.round((viewedCount / total) * 100) : 0;
  const fname = data.path.split("/").pop() ?? data.path;

  return (
    <div className="flex-none border-t border-gray-800 bg-gray-950 z-30">
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
          {viewedCount} of {total} explored ({viewedPct}%) · auto-saves like HF
          Viewer
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-[200px] lg:min-w-[280px]">
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
          {!neighbors.outgoing.length && !neighbors.incoming.length && (
            <p className="text-[10px] text-gray-600 col-span-2 italic">
              No graph edges yet — structural links appear after ingest. The map
              still shows where this file sits in the project layers.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
