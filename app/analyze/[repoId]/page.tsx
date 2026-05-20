"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dagre from "dagre";
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
import NodeDetail from "@/components/nodes/NodeDetail";
import { useGraphStore } from "@/lib/store/graph";
import type { FileNodeData } from "@/lib/store/graph";

const nodeTypes = {
  fileNode: FileNode,
};

const defaultEdgeOptions = {
  type: "smoothstep" as const,
  style: { stroke: "#374151", strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "#374151" },
};

type GraphResponse = {
  repoName: string;
  repoUrl?: string | null;
  status: string;
  nodes: Node[];
  edges: Edge[];
  error?: string;
};

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 220, height: 80 });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const nodeWithPos = g.node(node.id);
    if (!nodeWithPos) return node;
    const { x, y } = nodeWithPos;
    return { ...node, position: { x: x - 110, y: y - 40 } };
  });
}

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center text-white">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500/50 border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500">Loading graph…</p>
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
  const [reanalyzing, setReanalyzing] = useState(false);

  const { selectedNode, setSelectedNode } = useGraphStore();

  // Escape key closes NodeDetail
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedNode(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setSelectedNode]);

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

        const rawNodes = data.nodes || [];
        const rawEdges = data.edges || [];

        const laidOutNodes = applyDagreLayout(rawNodes, rawEdges);
        setNodes(laidOutNodes);
        setEdges(
          rawEdges.map((e) => ({
            ...e,
            style: { stroke: "#374151", strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#374151" },
          }))
        );
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

  // Highlight connected edges when a node is selected
  useEffect(() => {
    if (!selectedNode) {
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          animated: false,
          style: { stroke: "#374151", strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#374151" },
        }))
      );
      return;
    }
    setEdges((eds) =>
      eds.map((e) => {
        const connected =
          e.source === selectedNode.id || e.target === selectedNode.id;
        return {
          ...e,
          animated: connected,
          style: connected
            ? { stroke: "#6366f1", strokeWidth: 2 }
            : { stroke: "#1f2937", strokeWidth: 1 },
          markerEnd: connected
            ? { type: MarkerType.ArrowClosed, color: "#6366f1" }
            : { type: MarkerType.ArrowClosed, color: "#1f2937" },
        };
      })
    );
  }, [selectedNode, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode({
        id: node.id,
        type: node.type ?? "fileNode",
        data: node.data as FileNodeData,
      });
    },
    [setSelectedNode]
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
        body: JSON.stringify({ url: repoUrl }),
      });
      const data = await res.json();
      if (res.ok && data.jobId) {
        router.push(`/processing/${data.jobId}`);
      }
    } catch {
      setReanalyzing(false);
    }
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* ── Header ── */}
      <header className="flex-none min-h-12 flex flex-wrap items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm z-20">
        {/* Repo name */}
        <h1 className="text-xs font-semibold text-gray-300 truncate max-w-[36ch]">
          {loading ? "Loading…" : repoName}
        </h1>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Stats + status badge */}
        {!loading && !error && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-600">
            <span>
              <span className="text-gray-400 font-medium">{nodes.length}</span>{" "}
              nodes
            </span>
            <span>
              <span className="text-gray-400 font-medium">{edges.length}</span>{" "}
              edges
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

        {/* Re-analyze button */}
        {!loading && !error && repoUrl && (
          <button
            onClick={handleReanalyze}
            disabled={reanalyzing}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reanalyzing ? (
              <>
                <svg
                  className="animate-spin w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Re-analyzing…
              </>
            ) : (
              <>
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Re-analyze
              </>
            )}
          </button>
        )}
      </header>

      {/* ── Body ── */}
      {loading && <Spinner />}

      {!loading && error && (
        <CenteredMessage
          title={error}
          subtitle="Could not load graph data."
          accent="text-red-400"
        />
      )}

      {!loading && !error && nodes.length === 0 && (
        <CenteredMessage
          title="No graph data yet"
          subtitle={
            repoStatus !== "done"
              ? "The ingest pipeline is still running — check back shortly."
              : "This repo has no parsed nodes."
          }
          accent="text-yellow-400"
        />
      )}

      {!loading && !error && nodes.length > 0 && (
        <div className="flex-1 relative" style={{ minHeight: 0 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={4}
            style={{ background: "#030712" }}
            proOptions={{ hideAttribution: false }}
          >
            <Controls
              style={{
                background: "#111827",
                border: "1px solid #1f2937",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            />
            <MiniMap
              nodeColor="#1f2937"
              maskColor="rgba(3, 7, 18, 0.75)"
              style={{
                background: "#0f172a",
                border: "1px solid #1f2937",
                borderRadius: "8px",
              }}
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#1f2937"
            />
          </ReactFlow>

          {/* Detail sidebar */}
          {selectedNode && <NodeDetail />}
        </div>
      )}
    </div>
  );
}
