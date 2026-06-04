"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Node, Edge } from "@xyflow/react";
import UiStudioView from "@/components/UiStudioView";

type GraphResponse = {
  repoName: string;
  repoUrl?: string | null;
  nodes: Node[];
  edges: Edge[];
  meta?: { mode?: string; fileCount?: number; edgeCount?: number };
  error?: string;
};

export default function UiStudioPage() {
  const params = useParams<{ repoId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [repoName, setRepoName] = useState("");
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState("lite");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/graph/${params.repoId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed: ${r.status}`);
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
        setMapMode(data.meta?.mode ?? "lite");
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.repoId]);

  if (loading) {
    return (
      <div
        className="map-canvas-bg flex items-center justify-center"
        style={{ height: "calc(100vh - var(--header-h))", color: "var(--text-muted)" }}
      >
        <p className="text-sm">Loading UI layer…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="map-canvas-bg flex flex-col items-center justify-center gap-3"
        style={{ height: "calc(100vh - var(--header-h))" }}
      >
        <p className="text-sm" style={{ color: "#f87171" }}>
          {error}
        </p>
        <Link href={`/analyze/${params.repoId}`} className="btn-blueprint">
          ← Architecture
        </Link>
      </div>
    );
  }

  return (
    <UiStudioView
      repoId={params.repoId}
      repoName={repoName}
      repoUrl={repoUrl}
      mapMode={mapMode}
      rawNodes={nodes}
      rawEdges={edges}
    />
  );
}
