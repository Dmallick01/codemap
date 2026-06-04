"use client";

import { useEffect, useMemo, useCallback, useState } from "react";
import MapImportExport from "@/components/MapImportExport";
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
import FocusMapHUD from "@/components/FocusMapHUD";
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
        : { stroke: base.stroke, strokeWidth: base.strokeWidth * 0.55 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: connected ? base.stroke : `${base.stroke}55`,
      },
    };
  });
}

function minimapColor(node: Node): string {
  if (node.type === "groupNode") return "var(--bg-elevated)";
  const role = (node.data as FileNodeData)?.role as ArchRole | undefined;
  if (role && ROLE_META[role]) return ROLE_META[role].color;
  return "var(--text-muted)";
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
  sourceType: string;
  fileCount: number;
  edgeCount: number;
  onReanalyze: () => void;
  reanalyzing: boolean;
};

function AnalyzeGraphInner({
  repoId,
  repoName,
  repoUrl,
  initialNodes,
  initialEdges,
  overview,
  mapMode,
  sourceType,
  fileCount,
  edgeCount,
  onReanalyze,
  reanalyzing,
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const { fitView } = useReactFlow();
  const { selectedNode, setSelectedNode } = useGraphStore();
  const [exportOpen, setExportOpen] = useState(false);
  const [chromeOpen, setChromeOpen] = useState(false);

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

  const bundleExport: Omit<
    BundleExportContext,
    "bundlePaths" | "includeNeighbors"
  > | null = useMemo(() => {
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
            opacity: dimmed ? 0.18 : 1,
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
        padding: 0.5,
        duration: 280,
        maxZoom: 1.2,
      });
    }, 50);
    return () => clearTimeout(t);
  }, [explorer.currentNode?.id, fitView]);

  const toggleChrome = useCallback(() => {
    setChromeOpen((v) => !v);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case "Escape":
          setSelectedNode(null);
          setChromeOpen(false);
          break;
        case "?":
        case "h":
        case "H":
          toggleChrome();
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
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [explorer, setSelectedNode, toggleChrome]);

  const openExport = useCallback(() => setExportOpen(true), []);

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

  const onPaneClick = useCallback(() => setSelectedNode(null), [setSelectedNode]);

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: "calc(100vh - var(--header-h))" }}
    >
      <ReactFlow
        nodes={displayNodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        minZoom={0.04}
        maxZoom={2}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        className="map-canvas-bg"
        proOptions={{ hideAttribution: true }}
      >
        {!chromeOpen && <Controls position="bottom-left" />}
        <MiniMap
          position="bottom-right"
          nodeColor={minimapColor}
          maskColor="rgba(4, 8, 16, 0.85)"
          style={{
            marginBottom: chromeOpen ? 220 : 12,
            marginRight: 12,
          }}
        />
        <Background
          variant={BackgroundVariant.Lines}
          gap={24}
          size={1}
          color="var(--grid-line)"
        />
      </ReactFlow>

      <FocusMapHUD
        repoName={repoName}
        fileCount={fileCount}
        edgeCount={edgeCount}
        tourIndex={explorer.index}
        tourTotal={explorer.total}
        currentPath={explorer.currentPath}
        chromeOpen={chromeOpen}
        onToggleChrome={toggleChrome}
        onPrev={explorer.goPrev}
        onNext={explorer.goNext}
        onExport={bundle.count > 0 ? openExport : undefined}
        bundleCount={bundle.count}
      />

      {!chromeOpen && (
        <div className="absolute bottom-3 right-3 z-20 pointer-events-auto">
          <GraphLegend />
        </div>
      )}

      {chromeOpen && (
        <>
          <div className="absolute top-24 left-3 z-10 max-w-sm">
            <RepoOverviewPanel
              repoName={repoName}
              overview={overview}
              mode={mapMode}
            />
          </div>

          {chromeOpen && selectedNode && <NodeDetail />}

          <div
            className="absolute bottom-0 left-0 right-0 z-20 flex flex-col border-t"
            style={{
              borderColor: "var(--border-subtle)",
              background: "var(--bg-glass)",
              backdropFilter: "blur(12px)",
            }}
          >
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
            <div className="flex items-center gap-2 px-3 py-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
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
              <div className="flex-1" />
              <MapImportExport
                variant="export"
                repoId={repoId}
                repoName={repoName}
                repoUrl={repoUrl}
                sourceType={sourceType}
                nodes={nodes}
                edges={edges}
                meta={{
                  fileCount,
                  edgeCount,
                  layout: "semantic-2d",
                  mode: mapMode === "deep" ? "deep" : "lite",
                  overview: overview as Record<string, unknown> | null,
                }}
              />
              {repoUrl && (
                <button
                  type="button"
                  onClick={onReanalyze}
                  disabled={reanalyzing}
                  className="btn-blueprint"
                >
                  {reanalyzing ? "…" : "Re-map"}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <ExportPromptSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        repoId={repoId}
        single={bundle.count === 0 ? singleExport : null}
        bundle={bundle.count > 0 ? bundleExport : null}
      />
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
