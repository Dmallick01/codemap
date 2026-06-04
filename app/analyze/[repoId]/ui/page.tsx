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
  meta?: { mode?: string };
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

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col bg-gray-950 text-white overflow-hidden">
      <header className="flex-none flex items-center gap-3 px-4 py-2 border-b border-sky-900/40 bg-gray-950/95 z-20">
        <Link
          href={`/analyze/${params.repoId}`}
          className="text-[11px] text-gray-500 hover:text-gray-300"
        >
          ← Architecture
        </Link>
        <h1 className="text-xs font-semibold text-sky-200 truncate">
          UI Studio · {repoName}
        </h1>
        <div className="flex-1" />
        <span className="text-[9px] uppercase px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 font-bold">
          Frontend visualizer
        </span>
      </header>

      {loading && (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Loading UI layer…
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <UiStudioView
          repoId={params.repoId}
          repoName={repoName}
          repoUrl={repoUrl}
          mapMode={mapMode}
          rawNodes={nodes}
          rawEdges={edges}
        />
      )}
    </div>
  );
}
