"use client";

import { useEffect } from "react";
import { useGraphStore } from "@/lib/store/graph";
import type { FileNodeData, ModuleData, FunctionNodeData, SelectedNode } from "@/lib/store/graph";

function getFilename(path: string | undefined): string {
  if (!path) return "—";
  return path.split("/").pop() ?? path;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] uppercase tracking-widest text-gray-600 font-semibold mb-1">
      {children}
    </p>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | undefined | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <p
        className={`text-xs text-gray-300 break-all leading-relaxed ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function FunctionList({ functions }: { functions: FunctionNodeData[] }) {
  if (!functions.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {functions.map((fn) => (
        <div
          key={fn.id}
          className="px-2 py-1.5 rounded bg-gray-800/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-gray-300 truncate">
              {fn.name}
            </span>
            {fn.startLine != null && (
              <span className="text-[9px] text-gray-600 ml-2 flex-shrink-0 font-mono">
                L{fn.startLine}–{fn.endLine ?? fn.startLine}
              </span>
            )}
          </div>
          {fn.summary && (
            <p className="text-[9px] text-gray-500 leading-snug mt-1">
              {fn.summary}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function ModuleList({ modules }: { modules: ModuleData[] }) {
  return (
    <div className="space-y-3">
      {modules.map((m) => (
        <div key={m.id} className="rounded-lg bg-gray-800/40 p-2.5 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-semibold text-gray-200 truncate">
              {m.name}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400 uppercase font-mono flex-shrink-0">
              {m.type}
            </span>
          </div>
          {m.summary && (
            <p className="text-[9px] text-gray-500 leading-snug mt-1">{m.summary}</p>
          )}
          {m.functions.length > 0 && (
            <FunctionList functions={m.functions} />
          )}
        </div>
      ))}
    </div>
  );
}

function FileDetail({ data }: { data: FileNodeData }) {
  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Filename</SectionLabel>
        <p className="text-sm font-semibold text-white truncate">
          {getFilename(data.path)}
        </p>
      </div>

      <DetailRow label="Path" value={data.path} mono />
      <DetailRow label="Language" value={data.language} />
      <DetailRow label="Summary" value={data.summary} />

      {data.modules && data.modules.length > 0 && (
        <div>
          <SectionLabel>
            Modules &amp; Classes ({data.modules.length})
          </SectionLabel>
          <ModuleList modules={data.modules} />
        </div>
      )}

      {data.modules?.length === 0 && (
        <p className="text-[10px] text-gray-600 italic">No modules detected.</p>
      )}
    </div>
  );
}

export default function NodeDetail() {
  const { selectedNode, setSelectedNode } = useGraphStore();

  // Escape key to dismiss
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedNode(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setSelectedNode]);

  if (!selectedNode) return null;

  return (
    <>
      {/* Mobile: bottom sheet overlay */}
      <div className="sm:hidden absolute bottom-0 left-0 right-0 max-h-[60vh] flex flex-col bg-gray-950/95 backdrop-blur-md border-t border-gray-800 z-10 shadow-2xl rounded-t-xl">
        {/* Drag handle */}
        <div className="flex-none flex justify-center pt-2 pb-1">
          <div className="w-8 h-1 rounded-full bg-gray-700" />
        </div>
        <PanelContent selectedNode={selectedNode} setSelectedNode={setSelectedNode} />
      </div>

      {/* Desktop: right-side panel */}
      <div className="hidden sm:flex absolute right-0 top-0 h-full w-72 max-w-[calc(100vw-2rem)] flex-col bg-gray-950/95 backdrop-blur-md border-l border-gray-800 z-10 shadow-2xl">
        <PanelContent selectedNode={selectedNode} setSelectedNode={setSelectedNode} />
      </div>
    </>
  );
}

function PanelContent({
  selectedNode,
  setSelectedNode,
}: {
  selectedNode: SelectedNode;
  setSelectedNode: (n: null) => void;
}) {
  return (
    <>
      {/* Panel header */}
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-gray-600 font-semibold">
            {selectedNode.type === "fileNode" ? "File" : selectedNode.type}
          </p>
          <p className="text-xs font-medium text-gray-300 truncate max-w-[200px]">
            {getFilename((selectedNode.data as FileNodeData).path)}
          </p>
        </div>
        <button
          onClick={() => setSelectedNode(null)}
          className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors text-base leading-none"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {selectedNode.type === "fileNode" && (
          <FileDetail data={selectedNode.data as FileNodeData} />
        )}
      </div>
    </>
  );
}
