"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildSnapshotFromGraph,
  downloadCodemapFile,
} from "@/lib/export/map-file";
import type { Node, Edge } from "@xyflow/react";
import type { CodemapSnapshotMeta } from "@/lib/graph/snapshot";

type ExportProps = {
  variant: "export";
  repoId: string;
  repoName: string;
  repoUrl: string | null;
  sourceType: string;
  nodes: Node[];
  edges: Edge[];
  meta: CodemapSnapshotMeta;
};

type ImportProps = {
  variant: "import";
};

type Props = ExportProps | ImportProps;

export default function MapImportExport(props: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleImport(file: File) {
    setBusy(true);
    setError("");
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json.snapshot ? json : { snapshot: json }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      router.push(`/analyze/${data.repoId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setBusy(false);
    }
  }

  function handleExport() {
    if (props.variant !== "export") return;
    const snapshot = buildSnapshotFromGraph({
      name: props.repoName,
      url: props.repoUrl,
      sourceType: props.sourceType,
      nodes: props.nodes,
      edges: props.edges,
      meta: props.meta,
    });
    downloadCodemapFile(snapshot);
  }

  if (props.variant === "import") {
    return (
      <div>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="text-xs px-3 py-2 rounded-lg border border-gray-600 text-gray-300 hover:border-gray-400 disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import map"}
        </button>
        {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={handleExport}
        className="text-[11px] px-2.5 py-1.5 rounded border border-gray-600 text-gray-400 hover:text-gray-200 disabled:opacity-50"
        title="Download .codemap.json from current view"
      >
        Export map
      </button>
      {error && (
        <span className="text-[10px] text-red-400 max-w-[12rem] truncate">
          {error}
        </span>
      )}
    </div>
  );
}
