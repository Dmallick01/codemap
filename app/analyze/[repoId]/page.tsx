"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import FileNode from "@/components/nodes/FileNode";
import GroupNode from "@/components/nodes/GroupNode";
import NodeDetail from "@/components/nodes/NodeDetail";
import ExplorerToolbar from "@/components/ExplorerToolbar";
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

type GraphResponse = {
  repoName: string;
  repoUrl?: string | null;
  status: string;
  nodes: Node[];
  edges: Edge[];
  meta?: {
    fileCount: number;
    edgeCount: number;
    layout: string;
    mode?: string;
    overview?: RepoOverviewMeta | null;
  };
  error?: string;
};

function styleEdges(eds: Edge[], selectedId: string | null): Edge[] {
  return eds.map((e) => {
    const edgeType =
      (e.data as { edgeType?: string })?.edgeType ?? "imports";
    const base = edgeStyle(edgeType);
    const connected =
      selectedId &&
      (e.source === selectedId || e.target === selectedId);
    return {
      ...e,
      animated: !!connected,
      style: connected
        ? { stroke: base.stroke, strokeWidth: base.strokeWidth + 1 }
        : { stroke: base.stroke, strokeWidth: base.strokeWidth },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: connected ? base.stroke : `${base.stroke}99`,
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

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center text-white">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500/50 border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500">Mapping project architecture…</p>
      </div>
    </div>
  );
}

function CenteredMessage({
  title,
  subtitle,
  accent = "text-gray-400",
}: {
  title: string;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-white gap-3">
      <p className={`text-sm font-medium ${accent}`}>{title}</p>
      {subtitle && <p className="text-xs text-gray-600">{subtitle}</p>}
      <Link
        href="/"
        className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        ← Back to home
      </Link>
    </div>
  );
}

export default function AnalyzePage() {
  const params = useParams<{ repoId: string }>();
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [repoName, setRepoName] = useState("");
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [repoStatus, setRepoStatus] = useState("");
  const [fileCount, setFileCount] = useState(0);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [mapMode, setMapMode] = useState<string>("lite");
  const [overview, setOverview] = useState<RepoOverviewMeta | null>(null);

  const { selectedNode, setSelectedNode } = useGraphStore();

  const fileNodesOnly = useMemo(
    () => nodes.filter((n) => n.type === "fileNode"),
    [nodes],
  );

  const explorer = useGraphExplorer(
    params.repoId,
    fileNodesOnly,
    setSelectedNode,
  );

  const displayNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected:
          n.type === "fileNode" &&
          (explorer.currentNode?.id === n.id || selectedNode?.id === n.id),
      })),
    [nodes, explorer.currentNode?.id, selectedNode?.id],
  );

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

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/graph/${params.repoId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`);
        return r.json();
      })
      .then((data: GraphResponse) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        setRepoName(data.repoName || params.repoId);
        setRepoUrl(data.repoUrl ?? null);
        setRepoStatus(data.status || "");
        setFileCount(
          data.meta?.fileCount ??
            data.nodes.filter((n) => n.type === "fileNode").length,
        );
        setMapMode(data.meta?.mode ?? "lite");
        setOverview(data.meta?.overview ?? null);

        setNodes(data.nodes || []);
        setEdges(styleEdges(data.edges || [], null));
        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message || "Failed to load graph");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.repoId, setNodes, setEdges]);

  useEffect(() => {
    setEdges((eds) => styleEdges(eds, selectedNode?.id ?? null));
  }, [selectedNode, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type !== "fileNode") return;
      const idx = explorer.ordered.findIndex((n) => n.id === node.id);
      if (idx >= 0) explorer.focusAt(idx);
      else
        setSelectedNode({
          id: node.id,
          type: node.type ?? "fileNode",
          data: node.data as FileNodeData,
        });
    },
    [explorer, setSelectedNode],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  async function handleReanalyze() {
    if (!repoUrl || reanalyzing) return;
    setReanalyzing(true);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: repoUrl, mode: "lite" }),
      });
      const data = await res.json();
      if (res.ok && data.jobId) {
        router.push(`/processing/${data.jobId}`);
      }
    } catch {
      setReanalyzing(false);
    }
  }

  const groupCount = nodes.filter((n) => n.type === "groupNode").length;

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col bg-gray-950 text-white overflow-hidden">
      <header className="flex-none min-h-12 flex flex-wrap items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm z-20">
        <h1 className="text-xs font-semibold text-gray-300 truncate max-w-[36ch]">
          {loading ? "Loading…" : repoName}
        </h1>
        <div className="flex-1" />
        {!loading && !error && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-600">
            <span>
              <span className="text-gray-400 font-medium">{fileCount}</span>{" "}
              files
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
        )}
        {!loading && !error && repoUrl && (
          <button
            onClick={handleReanalyze}
            disabled={reanalyzing}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors disabled:opacity-50"
          >
            {reanalyzing ? "Re-analyzing…" : "Re-analyze"}
          </button>
        )}
      </header>

      {loading && <Spinner />}
      {!loading && error && (
        <CenteredMessage
          title={error}
          subtitle="Could not load graph data."
          accent="text-red-400"
        />
      )}
      {!loading && !error && fileCount === 0 && (
        <CenteredMessage
          title="No graph data yet"
          subtitle="Run ingest first, then open the architecture map."
          accent="text-yellow-400"
        />
      )}
      {!loading && !error && fileCount > 0 && (
        <div className="flex-1 flex flex-col relative" style={{ minHeight: 0 }}>
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
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
          <div className="absolute bottom-4 right-4 z-10 max-w-[260px]">
            <GraphLegend />
          </div>
          {selectedNode && <NodeDetail />}
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
          />
        </div>
      )}
    </div>
  );
}
