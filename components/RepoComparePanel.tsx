"use client";

import { useEffect, useState } from "react";
import RepoCompareColumn from "@/components/RepoCompareColumn";
import type { RepoStats } from "@/lib/repos/stats";
import type { ArchRole } from "@/lib/graph/semantic";
import { ROLE_META } from "@/lib/graph/semantic";

type CompareResponse = {
  left: RepoStats;
  right: RepoStats;
  diff: {
    onlyLeft: ArchRole[];
    onlyRight: ArchRole[];
    shared: ArchRole[];
    fileCountDelta: number;
    edgeCountDelta: number;
  };
};

type Props = {
  leftId: string;
  rightId: string;
};

export default function RepoComparePanel({ leftId, rightId }: Props) {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/repos/compare?left=${leftId}&right=${rightId}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Compare failed");
        setData(json);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [leftId, rightId]);

  if (loading) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">
        Comparing repositories…
      </p>
    );
  }

  if (error) {
    return <p className="text-sm text-red-400 py-4">{error}</p>;
  }

  if (!data) return null;

  const { left, right, diff } = data;
  const highlightLeft = new Set(diff.onlyLeft);
  const highlightRight = new Set(diff.onlyRight);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RepoCompareColumn stats={left} highlightRoles={highlightLeft} />
        <RepoCompareColumn stats={right} highlightRoles={highlightRight} />
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900/30 px-4 py-3 text-[11px] text-gray-400 space-y-2">
        <p className="font-medium text-gray-300">Comparison</p>
        <ul className="space-y-1">
          <li>
            File count:{" "}
            <span className="text-gray-200">
              {left.fileCount} vs {right.fileCount}
            </span>
            {diff.fileCountDelta !== 0 && (
              <span className="text-gray-500">
                {" "}
                ({diff.fileCountDelta > 0 ? "left" : "right"} has{" "}
                {Math.abs(diff.fileCountDelta)} more)
              </span>
            )}
          </li>
          <li>
            Connections: {left.edgeCount} vs {right.edgeCount}
          </li>
          {diff.onlyLeft.length > 0 && (
            <li>
              Layers only in <strong className="text-gray-300">{left.name}</strong>:{" "}
              {diff.onlyLeft.map((r) => ROLE_META[r].label).join(", ")}
            </li>
          )}
          {diff.onlyRight.length > 0 && (
            <li>
              Layers only in <strong className="text-gray-300">{right.name}</strong>:{" "}
              {diff.onlyRight.map((r) => ROLE_META[r].label).join(", ")}
            </li>
          )}
          {diff.shared.length > 0 && (
            <li>
              Shared layers:{" "}
              {diff.shared.map((r) => ROLE_META[r].label).join(", ")}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
