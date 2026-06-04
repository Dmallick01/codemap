"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import Link from "next/link";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlowProvider,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import FileNode from "@/components/nodes/FileNode";
import UiDesignExportSheet from "@/components/UiDesignExportSheet";
import {
  buildUiStudioLayout,
  filterUiStudioFiles,
} from "@/lib/graph/ui-layout";
import { edgeStyle } from "@/lib/graph/semantic";
import type { FileNodeData } from "@/lib/store/graph";
import type { LayoutFileInput } from "@/lib/graph/layout";

const nodeTypes = { fileNode: FileNode };

function styleEdges(eds: Edge[], focusId: string | null): Edge[] {
  return eds.map((e) => {
    const edgeType = (e.data as { edgeType?: string })?.edgeType ?? "imports";
    const base = edgeStyle(edgeType);
    const connected =
      focusId && (e.source === focusId || e.target === focusId);
    return {
      ...e,
      animated: !!connected,
      style: {
        stroke: base.stroke,
        strokeWidth: connected ? base.strokeWidth + 1 : base.strokeWidth,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: base.stroke,
      },
    };
  });
}

type Props = {
  repoId: string;
  repoName: string;
  repoUrl: string | null;
  mapMode: string;
  rawNodes: Node[];
  rawEdges: Edge[];
};

function UiStudioInner({
  repoId,
  repoName,
  repoUrl,
  mapMode,
  rawNodes,
  rawEdges,
}: Props) {
  const { fitView } = useReactFlow();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  const layoutInputs: LayoutFileInput[] = useMemo(() => {
    return rawNodes
      .filter((n) => n.type === "fileNode")
      .map((n) => {
        const d = n.data as FileNodeData;
        return {
          id: n.id,
          path: d.path ?? n.id,
          language: d.language,
          summary: d.summary,
          role: d.role,
          roleLabel: d.roleLabel,
          purpose: d.purpose,
          frameworkLabel: d.frameworkLabel,
        };
      });
  }, [rawNodes]);

  const uiFiles = useMemo(
    () => filterUiStudioFiles(layoutInputs),
    [layoutInputs],
  );

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    const uiIds = new Set(uiFiles.map((f) => f.id));
    const filteredEdges = rawEdges.filter(
      (e) => uiIds.has(e.source) && uiIds.has(e.target),
    );
    return buildUiStudioLayout(uiFiles, filteredEdges);
  }, [uiFiles, rawEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(layoutEdges);

  useEffect(() => {
    setNodes(
      layoutNodes.map((n) => ({
        ...n,
        selected: selectedIds.includes(n.id),
        data: {
          ...n.data,
          bundleSelected: selectedIds.includes(n.id),
        },
      })),
    );
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, selectedIds, setNodes, setEdges]);

  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 80);
    return () => clearTimeout(t);
  }, [layoutNodes.length, fitView]);

  const styledEdges = useMemo(
    () => styleEdges(edges, focusId),
    [edges, focusId],
  );

  const highlightIds = useMemo(() => {
    if (!focusId) return null;
    const set = new Set<string>([focusId]);
    for (const e of edges) {
      if (e.source === focusId) set.add(e.target);
      if (e.target === focusId) set.add(e.source);
    }
    return set;
  }, [focusId, edges]);

  const displayNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        style: {
          ...n.style,
          opacity:
            highlightIds && !highlightIds.has(n.id) ? 0.3 : 1,
        },
      })),
    [nodes, highlightIds],
  );

  const onNodeClick = useCallback((ev: React.MouseEvent, node: Node) => {
    if (node.type !== "fileNode") return;
    setFocusId(node.id);
    if (ev.shiftKey) {
      setSelectedIds((prev) =>
        prev.includes(node.id)
          ? prev.filter((id) => id !== node.id)
          : [...prev, node.id],
      );
    } else {
      setSelectedIds([node.id]);
    }
  }, []);

  const exportInput = useMemo(
    () => ({
      repoName,
      repoUrl,
      mapMode,
      nodes: layoutNodes,
      edges: layoutEdges,
      selectedNodeIds: selectedIds,
    }),
    [repoName, repoUrl, mapMode, layoutNodes, layoutEdges, selectedIds],
  );

  if (!uiFiles.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
        <p className="text-sm">No UI files in this map.</p>
        <Link
          href={`/analyze/${repoId}`}
          className="mt-4 text-xs text-violet-400 hover:underline"
        >
          ← Architecture map
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 relative min-h-0">
        <ReactFlow
          nodes={displayNodes}
          edges={styledEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={() => {
            setFocusId(null);
            setSelectedIds([]);
          }}
          minZoom={0.1}
          maxZoom={1.8}
          nodesDraggable
          style={{ background: "#020617" }}
        >
          <Controls
            style={{
              background: "#0c1222",
              border: "1px solid #1e3a5f",
              borderRadius: 8,
            }}
          />
          <MiniMap
            nodeColor={() => "#38bdf8"}
            maskColor="rgba(2, 6, 23, 0.85)"
            style={{ background: "#0f172a", border: "1px solid #1e3a5f" }}
          />
          <Background variant={BackgroundVariant.Dots} gap={20} color="#1e3a5f" />
        </ReactFlow>

        <div className="absolute top-3 left-3 z-10 rounded-lg border border-sky-800/40 bg-gray-950/90 px-3 py-2 text-[10px] text-gray-400 max-w-[200px]">
          <p className="text-sky-400/90 font-semibold uppercase tracking-wider text-[9px] mb-1">
            UI Studio columns
          </p>
          <p>Entry → Layouts → Components → Hooks → Styles</p>
          <p className="mt-1 text-gray-500">Shift+click to multi-select for export</p>
        </div>
      </div>

      <div className="flex-none border-t border-sky-900/40 bg-gray-950 px-4 py-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-gray-500">
          {uiFiles.length} UI files · {layoutEdges.length} UI connections
        </span>
        {selectedIds.length > 0 && (
          <span className="text-[10px] text-sky-400">
            {selectedIds.length} selected
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white"
        >
          Copy UI design prompt
        </button>
      </div>

      <UiDesignExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        repoId={repoId}
        repoName={repoName}
        input={exportInput}
      />
    </>
  );
}

export default function UiStudioView(props: Props) {
  return (
    <ReactFlowProvider>
      <UiStudioInner {...props} />
    </ReactFlowProvider>
  );
}
