"use client";

import { useEffect, useMemo, useCallback, useState, useRef } from "react";
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
import MapCapabilitiesBanner from "@/components/MapCapabilitiesBanner";
import GitHubLabDrawer from "@/components/github-lab/GitHubLabDrawer";
import SecurityExportSheet from "@/components/SecurityExportSheet";
import PromptBuilderPanel from "@/components/PromptBuilderPanel";
import type {
  RepurposeExportContext,
  BundleExportContext,
} from "@/lib/export/repurpose-prompt";
import { useBundleSelection } from "@/hooks/useBundleSelection";
import { useCodemapColorMode } from "@/hooks/useCodemapColorMode";
import { useMapSpacing } from "@/hooks/useMapSpacing";
import {
  useMeasuredMapDock,
  CHROME_DOCK_FALLBACK_PX,
} from "@/hooks/useMeasuredMapDock";
import MapSpacingControls from "@/components/MapSpacingControls";
import GraphLegend from "@/components/GraphLegend";
import RepoOverviewPanel, {
  type RepoOverviewMeta,
} from "@/components/RepoOverviewPanel";
import { useGraphExplorer } from "@/hooks/useGraphExplorer";
import { useGraphStore } from "@/lib/store/graph";
import type { FileNodeData } from "@/lib/store/graph";
import { ROLE_META, type ArchRole, edgeStyle, edgeLabelPresentation } from "@/lib/graph/semantic";
import { relayoutArchitectureNodes } from "@/lib/graph/relayout-graph";

const nodeTypes = {
  fileNode: FileNode,
  groupNode: GroupNode,
};

function styleEdges(eds: Edge[], focusId: string | null): Edge[] {
  return eds.map((e) => {
    const edgeType =
      (e.data as { edgeType?: string })?.edgeType ?? "imports";
    const base = edgeStyle(edgeType);
    const labels = edgeLabelPresentation(edgeType);
    const connected =
      focusId && (e.source === focusId || e.target === focusId);
    return {
      ...e,
      label: e.label ?? labels.label,
      labelStyle: labels.labelStyle,
      labelBgStyle: labels.labelBgStyle,
      labelBgPadding: labels.labelBgPadding,
      labelBgBorderRadius: labels.labelBgBorderRadius,
      animated: !!connected,
      style: {
        stroke: base.stroke,
        strokeWidth: connected ? base.strokeWidth + 0.5 : base.strokeWidth,
        opacity: 1,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: base.stroke,
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
  const { scale: spacingScale, setScale: setSpacingScale, reset: resetSpacing, resolved: spacingResolved } =
    useMapSpacing();

  const laidOutNodes = useMemo(
    () => relayoutArchitectureNodes(initialNodes, initialEdges, spacingScale),
    [initialNodes, initialEdges, spacingScale.row, spacingScale.group, spacingScale.column],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(laidOutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  useEffect(() => {
    setNodes(laidOutNodes);
    setEdges(initialEdges);
    didInitialFit.current = false;
  }, [laidOutNodes, initialEdges, setNodes, setEdges]);
  const { fitView } = useReactFlow();
  const colorMode = useCodemapColorMode();
  const { selectedNode, setSelectedNode } = useGraphStore();
  const [exportOpen, setExportOpen] = useState(false);
  const [chromeOpen, setChromeOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const didInitialFit = useRef(false);
  const promptDockRef = useRef<HTMLDivElement>(null);
  const chromeDockRef = useRef<HTMLDivElement>(null);

  const focusPromptInput = useCallback(() => {
    setPromptExpanded(true);
    requestAnimationFrame(() => {
      const el = document.getElementById("prompt-ask");
      if (el instanceof HTMLInputElement) el.focus();
    });
  }, []);

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

  const displayNodes = useMemo(
    () =>
      nodes.map((n) => {
        const isFocus =
          n.type === "fileNode" &&
          (n.id === explorer.currentNode?.id || n.id === selectedNode?.id);
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
            opacity: 1,
          },
        };
      }),
    [
      nodes,
      explorer.currentNode?.id,
      selectedNode?.id,
      bundle,
    ],
  );

  const styledEdges = useMemo(
    () => styleEdges(edges, focusId),
    [edges, focusId],
  );

  useEffect(() => {
    didInitialFit.current = false;
  }, [repoId]);

  useEffect(() => {
    if (!fileNodesOnly.length || didInitialFit.current) return;
    didInitialFit.current = true;
    const t = setTimeout(
      () => fitView({ padding: 0.14, duration: 450, maxZoom: 1.05 }),
      200,
    );
    return () => clearTimeout(t);
  }, [fileNodesOnly.length, fitView, repoId]);

  useEffect(() => {
    if (!fileNodesOnly.length) return;
    const t = setTimeout(
      () => fitView({ padding: 0.14, duration: 300, maxZoom: 1.05 }),
      120,
    );
    return () => clearTimeout(t);
  }, [spacingResolved.tileRowGap, spacingResolved.groupGapY, spacingResolved.roleColGap, fileNodesOnly.length, fitView]);

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
        case "l":
        case "L":
          setLabOpen((v) => !v);
          break;
        case "g":
        case "G":
          focusPromptInput();
          break;
        case "s":
        case "S":
          setSecurityOpen(true);
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [explorer, setSelectedNode, toggleChrome, focusPromptInput]);

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

  const selectedFilePath =
    explorer.currentData?.path ??
    (selectedNode?.data as FileNodeData | undefined)?.path ??
    null;

  const elementPromptNodeIds = useMemo(
    () =>
      bundle.selectedIds.length > 0
        ? [...bundle.selectedIds]
        : explorer.currentNode
          ? [explorer.currentNode.id]
          : [],
    [bundle.selectedIds, explorer.currentNode?.id],
  );

  const securityInput = useMemo(
    () => ({
      repoName,
      repoUrl,
      mapMode,
      nodes,
      edges,
      selectedNodeIds: elementPromptNodeIds,
    }),
    [repoName, repoUrl, mapMode, nodes, edges, elementPromptNodeIds],
  );

  const dock = useMeasuredMapDock(promptDockRef, chromeDockRef, {
    chromeOpen,
    promptExpanded,
    chromeFallbackPx: CHROME_DOCK_FALLBACK_PX,
  });

  return (
    <div
      className="map-view-root relative overflow-hidden"
      style={{ height: "calc(100vh - var(--header-h))" }}
    >
      <div className="map-flow-host" style={{ bottom: dock.reservePx }}>
        <ReactFlow
          nodes={displayNodes}
          edges={styledEdges}
          nodeTypes={nodeTypes}
          colorMode={colorMode}
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
          {!chromeOpen && (
            <Controls position="bottom-left" style={{ marginBottom: 8 }} />
          )}
          <MiniMap
            position="bottom-right"
            nodeColor={minimapColor}
            maskColor="var(--minimap-mask)"
            style={{
              marginBottom: 8,
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
      </div>

      <div
        className="absolute z-20 pointer-events-none"
        style={{ left: 12, bottom: dock.reservePx + 12 }}
      >
        <MapSpacingControls
          scale={spacingScale}
          onChange={setSpacingScale}
          onReset={resetSpacing}
        />
      </div>

      <MapCapabilitiesBanner repoUrl={repoUrl} className="absolute top-28 left-3 z-20 max-w-sm" />

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
        onExport={openExport}
        onOpenLab={repoUrl ? () => setLabOpen(true) : undefined}
        onSecurity={() => setSecurityOpen(true)}
        onBuildElement={focusPromptInput}
        bundleCount={bundle.count}
      />

      {!chromeOpen && (
        <div
          className="absolute right-3 z-20 pointer-events-auto"
          style={{ bottom: dock.reservePx + 12 }}
        >
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
            ref={chromeDockRef}
            className="absolute bottom-0 left-0 right-0 z-20 flex flex-col border-t panel-dock"
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
              onBuildElement={focusPromptInput}
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
              <button
                type="button"
                onClick={focusPromptInput}
                className="btn-blueprint-primary"
                title="Focus prompt bar (G)"
              >
                Ask repo
              </button>
              <button
                type="button"
                onClick={() => setSecurityOpen(true)}
                className="btn-blueprint"
                title="Security implementation brief"
              >
                Security brief
              </button>
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

      <GitHubLabDrawer
        open={labOpen}
        onClose={() => setLabOpen(false)}
        repoId={repoId}
        repoUrl={repoUrl}
        repoName={repoName}
        selectedPath={selectedFilePath}
        onOpenSecurityBrief={() => {
          setLabOpen(false);
          setSecurityOpen(true);
        }}
      />

      <SecurityExportSheet
        open={securityOpen}
        onClose={() => setSecurityOpen(false)}
        repoId={repoId}
        repoName={repoName}
        input={securityInput}
      />

      <PromptBuilderPanel
        ref={promptDockRef}
        repoId={repoId}
        repoName={repoName}
        repoUrl={repoUrl}
        input={securityInput}
        expanded={promptExpanded}
        onToggleExpanded={() => setPromptExpanded((v) => !v)}
        currentFilePath={selectedFilePath}
        overview={overview}
        dockOffsetPx={dock.promptBottomPx}
      />

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
