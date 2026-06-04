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
  error?: string;
};

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center text-white min-h-[50vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500/50 border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500">Loading repo tour…</p>
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
    <div className="flex-1 flex flex-col items-center justify-center text-white gap-3 min-h-[50vh]">
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

  if (loading) {
    return (
      <div className="h-[calc(100vh-3rem)] flex flex-col bg-gray-950">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-3rem)] flex flex-col bg-gray-950">
        <CenteredMessage
          title={error}
          subtitle="Could not load graph data."
          accent="text-red-400"
        />
      </div>
    );
  }

  if (fileCount === 0) {
    return (
      <div className="h-[calc(100vh-3rem)] flex flex-col bg-gray-950">
        <CenteredMessage
          title="No graph data yet"
          subtitle="Run Map repo first, then open the tour."
          accent="text-yellow-400"
        />
      </div>
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
      fileCount={fileCount}
      onReanalyze={handleReanalyze}
      reanalyzing={reanalyzing}
    />
  );
}
