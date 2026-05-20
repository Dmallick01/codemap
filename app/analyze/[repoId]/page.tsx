"use client";

import { useParams } from "next/navigation";

export default function AnalyzePage() {
  const params = useParams<{ repoId: string }>();

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <a
          href="/"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          &larr; Back to CodeMap
        </a>
        <div className="mt-12">
          <h1 className="text-3xl font-bold mb-4">Code Map Viewer</h1>
          <p className="text-gray-400 mb-2">
            Interactive DAG visualization coming in Phase 3.
          </p>
          <p className="text-sm text-gray-600">Repo ID: {params.repoId}</p>
        </div>
      </div>
    </main>
  );
}
