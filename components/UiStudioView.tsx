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
import SecurityExportSheet from "@/components/SecurityExportSheet";
import PromptBuilderPanel from "@/components/PromptBuilderPanel";
import GitHubLabDrawer from "@/components/github-lab/GitHubLabDrawer";
import MapCapabilitiesBanner from "@/components/MapCapabilitiesBanner";
import {
  buildUiStudioLayout,
  filterUiStudioFiles,
  type UiLayoutInput,
} from "@/lib/graph/ui-layout";
import type { ArchRole } from "@/lib/graph/semantic";
import { useCodemapColorMode } from "@/hooks/useCodemapColorMode";
import { useMapSpacing } from "@/hooks/useMapSpacing";
import MapSpacingControls from "@/components/MapSpacingControls";
import { edgeStyle, edgeLabelPresentation } from "@/lib/graph/semantic";
import type { FileNodeData } from "@/lib/store/graph";
const nodeTypes = { fileNode: FileNode };

function styleEdges(eds: Edge[], focusId: string | null): Edge[] {
  return eds.map((e) => {
    const edgeType = (e.data as { edgeType?: string })?.edgeType ?? "imports";
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
  const colorMode = useCodemapColorMode();
  const { scale: spacingScale, setScale: setSpacingScale, reset: resetSpacing, resolved: spacingResolved } =
    useMapSpacing();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [chromeOpen, setChromeOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);

  const focusPromptInput = useCallback(() => {
    setPromptExpanded(true);
    requestAnimationFrame(() => {
      const el = document.getElementById("prompt-ask");
      if (el instanceof HTMLInputElement) el.focus();
    });
  }, []);

  const layoutInputs: UiLayoutInput[] = useMemo(() => {
    return rawNodes
      .filter((n) => n.type === "fileNode")
      .map((n) => {
        const d = n.data as FileNodeData;
        return {
          id: n.id,
          path: d.path ?? n.id,
          language: d.language,
          summary: d.summary,
          role: d.role as ArchRole | undefined,
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
    return buildUiStudioLayout(uiFiles, filteredEdges, spacingScale);
  }, [uiFiles, rawEdges, spacingScale.row, spacingScale.group, spacingScale.column]);

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

  useEffect(() => {
    if (!layoutNodes.length) return;
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 120);
    return () => clearTimeout(t);
  }, [spacingResolved.roleColGap, spacingResolved.tileRowGap, layoutNodes.length, fitView]);

  const styledEdges = useMemo(
    () => styleEdges(edges, focusId),
    [edges, focusId],
  );

  const displayNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        style: {
          ...n.style,
          opacity: 1,
        },
      })),
    [nodes],
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

  const securityInput = useMemo(
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "?" || e.key === "h" || e.key === "H") {
        setChromeOpen((v) => !v);
      }
      if (e.key === "l" || e.key === "L") setLabOpen((v) => !v);
      if (e.key === "e" || e.key === "E") setExportOpen(true);
      if (e.key === "g" || e.key === "G") focusPromptInput();
      if (e.key === "s" || e.key === "S") setSecurityOpen(true);
      if (e.key === "Escape") {
        setChromeOpen(false);
        setLabOpen(false);
        setExportOpen(false);
        setSecurityOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusPromptInput]);

  if (!uiFiles.length) {
    return (
      <div
        className="map-canvas-bg flex flex-col items-center justify-center p-8"
        style={{ height: "calc(100vh - var(--header-h))", color: "var(--text-muted)" }}
      >
        <p className="text-sm">No UI files in this map.</p>
        <Link href={`/analyze/${repoId}`} className="btn-blueprint mt-4">
          ← Architecture map
        </Link>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: "calc(100vh - var(--header-h))" }}
    >
      <ReactFlow
        nodes={displayNodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        colorMode={colorMode}
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
        className="map-canvas-bg"
        proOptions={{ hideAttribution: true }}
      >
        {!chromeOpen && <Controls position="bottom-left" />}
        <div className="absolute z-20 left-3 bottom-14 pointer-events-none">
          <MapSpacingControls
            scale={spacingScale}
            onChange={setSpacingScale}
            onReset={resetSpacing}
          />
        </div>
        <MiniMap
          position="bottom-right"
          nodeColor={() => "var(--role-ui)"}
          maskColor="var(--minimap-mask)"
          style={{
            marginBottom: (chromeOpen ? 72 : 0) + (promptExpanded ? 240 : 56) + 12,
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

      <MapCapabilitiesBanner repoUrl={repoUrl} className="absolute top-3 left-3 z-20 max-w-[260px]" />

      <div
        className={`absolute z-20 panel-blueprint px-3 py-2 max-w-[240px] pointer-events-auto ${repoUrl ? "top-14 left-3" : "top-28 left-3"}`}
      >
        <p className="panel-label mb-1">UI Studio</p>
        <p className="text-readable-secondary text-[13px]">
          Entry → Layouts → Components → Hooks → Styles
        </p>
        <p className="mt-1 text-readable-muted font-mono text-[12px]">
          {uiFiles.length} files · G ask · E export · S security · L lab
        </p>
      </div>

      <div className="absolute top-3 right-3 z-20 pointer-events-auto flex flex-wrap gap-2 justify-end max-w-[min(100%,420px)]">
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
          onClick={() => setExportOpen(true)}
          className="btn-blueprint"
          title="Export UI prompt & DESIGN.md (E)"
        >
          Export UI
        </button>
        <button
          type="button"
          onClick={() => setSecurityOpen(true)}
          className="btn-blueprint"
          title="Security brief (S)"
        >
          Security
        </button>
        {repoUrl && (
          <button type="button" onClick={() => setLabOpen(true)} className="btn-blueprint" title="GitHub Lab (L)">
            ⌬ Lab
          </button>
        )}
        <button
          type="button"
          onClick={() => setChromeOpen((v) => !v)}
          className={`btn-blueprint ${chromeOpen ? "nav-tab-active" : ""}`}
        >
          {chromeOpen ? "Hide panels" : "? Panels"}
        </button>
      </div>

      <GitHubLabDrawer
        open={labOpen}
        onClose={() => setLabOpen(false)}
        repoId={repoId}
        repoUrl={repoUrl}
        repoName={repoName}
        selectedPath={
          selectedIds[0]
            ? (layoutNodes.find((n) => n.id === selectedIds[0])?.data as { path?: string })
                ?.path ?? null
            : null
        }
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
        repoId={repoId}
        repoName={repoName}
        repoUrl={repoUrl}
        input={exportInput}
        expanded={promptExpanded}
        onToggleExpanded={() => setPromptExpanded((v) => !v)}
        currentFilePath={
          selectedIds[0]
            ? (layoutNodes.find((n) => n.id === selectedIds[0])?.data as { path?: string })
                ?.path ?? null
            : null
        }
        dockOffsetPx={chromeOpen ? 48 : 0}
      />

      {chromeOpen && (
        <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-wrap items-center gap-2 px-4 py-2 border-t panel-dock">
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {uiFiles.length} UI files · {layoutEdges.length} connections
          </span>
          {selectedIds.length > 0 && (
            <span className="text-[10px]" style={{ color: "var(--accent)" }}>
              {selectedIds.length} selected
            </span>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="btn-blueprint-primary"
          >
            Export UI & DESIGN.md
          </button>
        </div>
      )}

      <UiDesignExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        repoId={repoId}
        repoName={repoName}
        repoUrl={repoUrl}
        input={exportInput}
      />
    </div>
  );
}

export default function UiStudioView(props: Props) {
  return (
    <ReactFlowProvider>
      <UiStudioInner {...props} />
    </ReactFlowProvider>
  );
}
