"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
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
  status: string;
  nodes: Node[];
  edges: Edge[];
  error?: string;
};

function Spinner() {
  return (
    <div className="h-screen bg-gray-950 flex items-center justify-center text-white">
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
    <div className="h-screen bg-gray-950 flex flex-col items-center justify-center text-white gap-3">
      <p className={`text-sm font-medium ${accent}`}>{title}</p>
      {subtitle && <p className="text-xs text-gray-600">{subtitle}</p>}
      <Link
        href="/"
        className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        ← Back to CodeMap
      </Link>
    </div>
  );
}

export default function AnalyzePage() {
  const params = useParams<{ repoId: string }>();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [repoName, setRepoName] = useState("");
  const [repoStatus, setRepoStatus] = useState("");

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
        setRepoStatus(data.status || "");
        setNodes(data.nodes || []);
        setEdges(
          (data.edges || []).map((e) => ({
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

  if (loading) return <Spinner />;

  if (error) {
    return (
      <CenteredMessage
        title={error}
        subtitle="Could not load graph data."
        accent="text-red-400"
      />
    );
  }

  if (nodes.length === 0) {
    return (
      <CenteredMessage
        title="No graph data yet"
        subtitle={
          repoStatus !== "done"
            ? "The ingest pipeline is still running — check back shortly."
            : "This repo has no parsed nodes."
        }
        accent="text-yellow-400"
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* ── Header ── */}
      <header className="flex-none min-h-12 flex flex-wrap items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm z-20">
        <Link
          href="/"
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
        >
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          CodeMap
        </Link>

        <div className="h-3.5 w-px bg-gray-800" />

        {/* Repo name */}
        <h1 className="text-xs font-semibold text-gray-300 truncate max-w-[36ch]">
          {repoName}
        </h1>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Stats + status badge — wraps on small screens */}
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
      </header>

      {/* ── Graph canvas ── */}
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
    </div>
  );
}
