"use client";

import { useEffect, useMemo, useCallback, useState } from "react";
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
import GroupNode from "@/components/nodes/GroupNode";
import NodeDetail from "@/components/nodes/NodeDetail";
import ExplorerToolbar from "@/components/ExplorerToolbar";
import SpecimenPanel from "@/components/SpecimenPanel";
import ExportPromptSheet from "@/components/ExportPromptSheet";
import BundleBar from "@/components/BundleBar";
import type {
  RepurposeExportContext,
  BundleExportContext,
} from "@/lib/export/repurpose-prompt";
import { useBundleSelection } from "@/hooks/useBundleSelection";
import GraphLegend from "@/components/GraphLegend";
import RepoOverviewPanel, {
  type RepoOverviewMeta,
} from "@/components/RepoOverviewPanel";
import { useGraphExplorer } from "@/hooks/useGraphExplorer";
import { useGraphStore } from "@/lib/store/graph";
import type { FileNodeData } from "@/lib/store/graph";
import { ROLE_META, type ArchRole, edgeStyle } from "@/lib/graph/semantic";

const nodeTypes = {
  fileNode: FileNode,
  groupNode: GroupNode,
};

function styleEdges(eds: Edge[], focusId: string | null): Edge[] {
  return eds.map((e) => {
    const edgeType =
      (e.data as { edgeType?: string })?.edgeType ?? "imports";
    const base = edgeStyle(edgeType);
    const connected =
      focusId && (e.source === focusId || e.target === focusId);
    return {
      ...e,
      animated: !!connected,
      style: connected
        ? { stroke: base.stroke, strokeWidth: base.strokeWidth + 1 }
        : { stroke: base.stroke, strokeWidth: base.strokeWidth * 0.6 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: connected ? base.stroke : `${base.stroke}55`,
      },
    };
  });
}

function minimapColor(node: Node): string {
  if (node.type === "groupNode") return "#1e293b";
  const role = (node.data as FileNodeData)?.role as ArchRole | undefined;
  if (role && ROLE_META[role]) return ROLE_META[role].color;
  return "#475569";
}

type Props = {
  repoId: string;
  repoName: string;
  repoUrl: string | null;
  repoStatus: string;
  initialNodes: Node[];
  initialEdges: Edge[];
  overview: RepoOverviewMeta | null;
  mapMode: string;
  fileCount: number;
  onReanalyze: () => void;
  reanalyzing: boolean;
};

function AnalyzeGraphInner({
  repoId,
  repoName,
  repoUrl,
  repoStatus,
  initialNodes,
  initialEdges,
  overview,
  mapMode,
  fileCount,
  onReanalyze,
  reanalyzing,
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const { fitView } = useReactFlow();
  const { selectedNode, setSelectedNode } = useGraphStore();
  const [exportOpen, setExportOpen] = useState(false);

  const fileNodesOnly = useMemo(
    () => nodes.filter((n) => n.type === "fileNode"),
    [nodes],
  );

  const explorer = useGraphExplorer(
    repoId,
    fileNodesOnly,
    edges,
    setSelectedNode,
  );

  const bundle = useBundleSelection(repoId, fileNodesOnly);

  const focusId =
    explorer.currentNode?.id ?? selectedNode?.id ?? null;

  const singleExport: RepurposeExportContext | null = useMemo(() => {
    if (!explorer.currentNode || !explorer.currentData) return null;
    return {
      repoName,
      repoUrl,
      mapMode,
      nodeId: explorer.currentNode.id,
      data: explorer.currentData,
      neighbors: explorer.neighbors,
    };
  }, [
    explorer.currentNode,
    explorer.currentData,
    explorer.neighbors,
    repoName,
    repoUrl,
    mapMode,
  ]);

  const bundleExport: Omit<BundleExportContext, "bundlePaths" | "includeNeighbors"> | null =
    useMemo(() => {
      if (bundle.anchors.length === 0) return null;
      return {
        repoName,
        repoUrl,
        mapMode,
        anchors: bundle.anchors,
        fileNodes: fileNodesOnly,
        edges,
      };
    }, [bundle.anchors, fileNodesOnly, edges, repoName, repoUrl, mapMode]);

  const highlightIds = useMemo(() => {
    const set = new Set<string>();
    if (focusId) set.add(focusId);
    for (const id of bundle.selectedIds) set.add(id);
    const anchor = focusId ?? bundle.selectedIds[0];
    if (anchor) {
      for (const e of edges) {
        if (e.source === anchor) set.add(e.target);
        if (e.target === anchor) set.add(e.source);
      }
    }
    if (set.size === 0) return null;
    return set;
  }, [focusId, bundle.selectedIds, edges]);

  const displayNodes = useMemo(
    () =>
      nodes.map((n) => {
        const isFocus =
          n.type === "fileNode" &&
          (n.id === explorer.currentNode?.id || n.id === selectedNode?.id);
        const dimmed =
          highlightIds &&
          n.type === "fileNode" &&
          !highlightIds.has(n.id);
        const bundleSelected =
          n.type === "fileNode" && bundle.isSelected(n.id);
        return {
          ...n,
          selected: isFocus,
          data:
            n.type === "fileNode"
              ? { ...n.data, bundleSelected }
              : n.data,
          style: {
            ...n.style,
            opacity: dimmed ? 0.22 : 1,
            transition: "opacity 0.2s ease",
          },
        };
      }),
    [
      nodes,
      explorer.currentNode?.id,
      selectedNode?.id,
      highlightIds,
      bundle,
    ],
  );

  const styledEdges = useMemo(
    () => styleEdges(edges, focusId),
    [edges, focusId],
  );

  useEffect(() => {
    if (!explorer.currentNode) return;
    const t = setTimeout(() => {
      fitView({
        nodes: [{ id: explorer.currentNode!.id }],
        padding: 0.55,
        duration: 280,
        maxZoom: 1.15,
      });
    }, 50);
    return () => clearTimeout(t);
  }, [explorer.currentNode?.id, fitView]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case "Escape":
          setSelectedNode(null);
          break;
        case "n":
        case "N":
        case "ArrowRight":
          e.preventDefault();
          explorer.goNext();
          break;
        case "p":
        case "P":
        case "ArrowLeft":
          e.preventDefault();
          explorer.goPrev();
          break;
        case "r":
        case "R":
          explorer.goRandom();
          break;
        case "?":
          explorer.setShowHelp((v) => !v);
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [explorer, setSelectedNode]);

  const openExport = useCallback(() => {
    setExportOpen(true);
  }, []);

  const onNodeClick = useCallback(
    (ev: React.MouseEvent, node: Node) => {
      if (node.type !== "fileNode") return;
      if (ev.shiftKey) {
        bundle.toggle(node.id);
        return;
      }
      const idx = explorer.ordered.findIndex((n) => n.id === node.id);
      if (idx >= 0) explorer.focusAt(idx);
    },
    [explorer, bundle],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const groupCount = nodes.filter((n) => n.type === "groupNode").length;

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col bg-gray-950 text-white overflow-hidden">
      <header className="flex-none min-h-12 flex flex-wrap items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm z-20">
        <h1 className="text-xs font-semibold text-gray-300 truncate max-w-[36ch]">
          {repoName}
        </h1>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-600">
          <span>
            <span className="text-gray-400 font-medium">{fileCount}</span> tour
            stops
          </span>
          <span>
            <span className="text-gray-400 font-medium">{groupCount}</span>{" "}
            groups
          </span>
          <span>
            <span className="text-gray-400 font-medium">{edges.length}</span>{" "}
            connections
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wide ${
              repoStatus === "done"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-yellow-500/15 text-yellow-400"
            }`}
          >
            {repoStatus || "unknown"}
          </span>
        </div>
        {repoUrl && (
          <button
            onClick={onReanalyze}
            disabled={reanalyzing}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors disabled:opacity-50"
          >
            {reanalyzing ? "Re-analyzing…" : "Re-analyze"}
          </button>
        )}
      </header>

      <div className="flex-1 flex flex-col relative min-h-0">
        <div className="flex-1 relative min-h-0">
          <ReactFlow
            nodes={displayNodes}
            edges={styledEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            minZoom={0.05}
            maxZoom={2}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            style={{ background: "#030712" }}
          >
            <Controls
              style={{
                background: "#111827",
                border: "1px solid #1f2937",
                borderRadius: "8px",
              }}
            />
            <MiniMap
              nodeColor={minimapColor}
              maskColor="rgba(3, 7, 18, 0.8)"
              style={{
                background: "#0f172a",
                border: "1px solid #1f2937",
                borderRadius: "8px",
              }}
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="#1e293b"
            />
          </ReactFlow>

          <RepoOverviewPanel
            repoName={repoName}
            overview={overview}
            mode={mapMode}
          />
          <div className="absolute bottom-4 right-4 z-10 max-w-[240px] pointer-events-none opacity-90">
            <GraphLegend />
          </div>
          {selectedNode && <NodeDetail />}
        </div>

        <BundleBar
          anchors={bundle.anchors}
          max={bundle.max}
          atCap={bundle.atCap}
          onClear={bundle.clear}
          onRemove={bundle.remove}
          onExport={openExport}
          onFocus={explorer.focusIdByNodeId}
        />
        <SpecimenPanel
          index={explorer.index}
          total={explorer.total}
          viewedCount={explorer.viewedCount}
          data={explorer.currentData}
          nodeId={explorer.currentNode?.id ?? null}
          neighbors={explorer.neighbors}
          onJumpTo={explorer.focusIdByNodeId}
          onExportPrompt={openExport}
          bundleCount={bundle.count}
          inBundle={
            explorer.currentNode
              ? bundle.isSelected(explorer.currentNode.id)
              : false
          }
          onToggleBundle={() => {
            if (explorer.currentNode) bundle.toggle(explorer.currentNode.id);
          }}
          atBundleCap={bundle.atCap}
        />
        <ExportPromptSheet
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          repoId={repoId}
          single={bundle.count === 0 ? singleExport : null}
          bundle={bundle.count > 0 ? bundleExport : null}
        />
        <ExplorerToolbar
          index={explorer.index}
          total={explorer.total}
          viewedCount={explorer.viewedCount}
          currentPath={explorer.currentPath}
          onPrev={explorer.goPrev}
          onNext={explorer.goNext}
          onRandom={explorer.goRandom}
          showHelp={explorer.showHelp}
          onToggleHelp={() => explorer.setShowHelp((v) => !v)}
          bundleCount={bundle.count}
          onExportBundle={bundle.count > 0 ? openExport : undefined}
        />
      </div>
    </div>
  );
}

export default function AnalyzeGraphView(props: Props) {
  return (
    <ReactFlowProvider>
      <AnalyzeGraphInner {...props} />
    </ReactFlowProvider>
  );
}
