"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Node, Edge } from "@xyflow/react";

import AnalyzeGraphView from "@/components/AnalyzeGraphView";
import type { RepoOverviewMeta } from "@/components/RepoOverviewPanel";

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
  storageMode?: string;
  sourceType?: string;
  error?: string;
};

function Spinner() {
  return (
    <div
      className="map-canvas-bg flex items-center justify-center"
      style={{ height: "calc(100vh - var(--header-h))" }}
    >
      <div className="text-center">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-4"
          style={{
            borderColor: "var(--accent-dim)",
            borderTopColor: "var(--accent)",
          }}
        />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Loading architecture map…
        </p>
      </div>
    </div>
  );
}

function CenteredMessage({
  title,
  subtitle,
  accent,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <div
      className="map-canvas-bg flex flex-col items-center justify-center gap-3"
      style={{ height: "calc(100vh - var(--header-h))" }}
    >
      <p className="text-sm font-medium" style={{ color: accent ?? "var(--text-secondary)" }}>
        {title}
      </p>
      {subtitle && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      )}
      <Link href="/" className="btn-blueprint mt-2">
        ← Map a repo
      </Link>
    </div>
  );
}

export default function AnalyzePage() {
  const params = useParams<{ repoId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [repoName, setRepoName] = useState("");
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [repoStatus, setRepoStatus] = useState("");
  const [fileCount, setFileCount] = useState(0);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [mapMode, setMapMode] = useState<string>("lite");
  const [overview, setOverview] = useState<RepoOverviewMeta | null>(null);
  const [sourceType, setSourceType] = useState("github-lite");
  const [edgeCount, setEdgeCount] = useState(0);

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
        setSourceType(data.sourceType ?? "github-lite");
        setEdgeCount(data.meta?.edgeCount ?? data.edges?.length ?? 0);
        setOverview(data.meta?.overview ?? null);
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
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
  }, [params.repoId]);

  const handleReanalyze = useCallback(async () => {
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
  }, [repoUrl, reanalyzing, router]);

  if (loading) return <Spinner />;

  if (error) {
    return (
      <CenteredMessage
        title={error}
        subtitle="Could not load graph data."
        accent="#f87171"
      />
    );
  }

  if (fileCount === 0) {
    return (
      <CenteredMessage
        title="No graph data yet"
        subtitle="Run Map repo first, then open the tour."
        accent="var(--role-core)"
      />
    );
  }

  return (
    <AnalyzeGraphView
      repoId={params.repoId}
      repoName={repoName}
      repoUrl={repoUrl}
      repoStatus={repoStatus}
      initialNodes={nodes}
      initialEdges={edges}
      overview={overview}
      mapMode={mapMode}
      sourceType={sourceType}
      fileCount={fileCount}
      edgeCount={edgeCount}
      onReanalyze={handleReanalyze}
      reanalyzing={reanalyzing}
    />
  );
}
