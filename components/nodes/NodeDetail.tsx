"use client";

import { useEffect, useState } from "react";
import { useGraphStore } from "@/lib/store/graph";
import type { FileNodeData, ModuleData, FunctionNodeData, SelectedNode } from "@/lib/store/graph";

function getFilename(path: string | undefined): string {
  if (!path) return "—";
  return path.split("/").pop() ?? path;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="panel-label mb-1">{children}</p>;
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
        className={`text-xs detail-secondary break-all leading-relaxed ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function FunctionEntry({ fn }: { fn: FunctionNodeData }) {
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="px-2 py-1.5 rounded glass-chip">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-mono detail-secondary truncate">{fn.name}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {fn.startLine != null && (
            <span className="text-[9px] detail-muted font-mono">
              L{fn.startLine}–{fn.endLine ?? fn.startLine}
            </span>
          )}
          {fn.code && (
            <button
              onClick={() => setShowCode((v) => !v)}
              className="text-[9px] px-1.5 py-0.5 rounded border btn-blueprint"
            >
              {showCode ? "Hide" : "Show code"}
            </button>
          )}
        </div>
      </div>
      {fn.summary && (
        <p className="text-[9px] detail-muted leading-snug mt-1">{fn.summary}</p>
      )}
      {showCode && fn.code && (
        <pre className="mt-2 text-[9px] leading-relaxed detail-secondary font-mono glass-code-block rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
          <code>{fn.code}</code>
        </pre>
      )}
    </div>
  );
}

function FunctionList({ functions }: { functions: FunctionNodeData[] }) {
  if (!functions.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {functions.map((fn) => (
        <FunctionEntry key={fn.id} fn={fn} />
      ))}
    </div>
  );
}

function ModuleList({ modules }: { modules: ModuleData[] }) {
  return (
    <div className="space-y-3">
      {modules.map((m) => (
        <div key={m.id} className="rounded-lg glass-chip p-2.5">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-semibold detail-primary truncate">{m.name}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full glass-chip detail-muted uppercase font-mono flex-shrink-0">
              {m.type}
            </span>
          </div>
          {m.summary && <p className="text-[9px] detail-muted leading-snug mt-1">{m.summary}</p>}
          {m.functions.length > 0 && <FunctionList functions={m.functions} />}
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
        <p className="text-sm font-semibold detail-primary truncate">{getFilename(data.path)}</p>
      </div>

      <DetailRow label="Path" value={data.path} mono />
      <DetailRow label="Role in project" value={data.roleLabel} />
      <DetailRow label="Folder group" value={data.groupLabel} />
      <DetailRow label="Framework" value={data.frameworkLabel} />
      <DetailRow label="How it fits" value={data.purpose} />
      <DetailRow label="Language" value={data.language} />
      <DetailRow label="Summary" value={data.summary} />

      {data.modules && data.modules.length > 0 && (
        <div>
          <SectionLabel>Modules &amp; Classes ({data.modules.length})</SectionLabel>
          <ModuleList modules={data.modules} />
        </div>
      )}

      {data.modules?.length === 0 && (
        <p className="text-[10px] detail-muted italic">No modules detected.</p>
      )}
    </div>
  );
}

export default function NodeDetail() {
  const { selectedNode, setSelectedNode } = useGraphStore();

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
      <div className="sm:hidden absolute bottom-0 left-0 right-0 max-h-[60vh] flex flex-col panel-dock z-10 shadow-2xl rounded-t-xl border-t">
        <div className="flex-none flex justify-center pt-2 pb-1">
          <div className="w-8 h-1 rounded-full" style={{ background: "var(--glass-border)" }} />
        </div>
        <PanelContent selectedNode={selectedNode} setSelectedNode={setSelectedNode} />
      </div>

      <div className="hidden sm:flex absolute right-0 top-0 h-full w-72 max-w-[calc(100vw-2rem)] flex-col panel-dock border-l z-10 shadow-2xl">
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
      <div
        className="flex-none flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div>
          <p className="panel-label">{selectedNode.type === "fileNode" ? "File" : selectedNode.type}</p>
          <p className="text-xs font-medium detail-secondary truncate max-w-[200px]">
            {getFilename((selectedNode.data as FileNodeData).path)}
          </p>
        </div>
        <button
          onClick={() => setSelectedNode(null)}
          className="btn-blueprint w-6 h-6 flex items-center justify-center text-base leading-none"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {selectedNode.type === "fileNode" && <FileDetail data={selectedNode.data as FileNodeData} />}
      </div>
    </>
  );
}
