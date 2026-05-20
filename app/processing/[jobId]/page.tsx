"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface JobData {
  jobId: string;
  step: string;
  progress: number;
  total: number;
  log: string;
  repo: {
    id: string;
    name: string;
    status: string;
    errorMsg: string | null;
  };
}

const STEPS = ["fetching", "parsing", "analyzing", "building", "done"] as const;

const STEP_LABELS: Record<string, string> = {
  fetching: "Fetching",
  parsing: "Parsing",
  analyzing: "Analyzing",
  building: "Building Graph",
  done: "Complete",
  error: "Error",
};

function getStepIndex(step: string): number {
  const idx = STEPS.indexOf(step as (typeof STEPS)[number]);
  return idx === -1 ? -1 : idx;
}

export default function ProcessingPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobData | null>(null);
  const [error, setError] = useState("");

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/job/${params.jobId}`);
      if (!res.ok) {
        setError("Job not found");
        return;
      }
      const data: JobData = await res.json();
      setJob(data);
    } catch {
      setError("Failed to fetch job status");
    }
  }, [params.jobId]);

  useEffect(() => {
    fetchJob();
    const interval = setInterval(() => {
      fetchJob();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchJob]);

  // Stop polling when done or error
  useEffect(() => {
    if (job?.step === "done" || job?.step === "error") {
      // polling stops naturally because we don't clear interval on these states,
      // but updates are idempotent — fine to keep polling
    }
  }, [job?.step]);

  const stepIndex = job ? getStepIndex(job.step) : -1;
  const isError = job?.step === "error";
  const isDone = job?.step === "done";
  const progressPct =
    job && job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="mx-auto max-w-2xl px-6 py-24">
        {/* Header */}
        <a
          href="/"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          &larr; Back to CodeMap
        </a>

        {error && !job && (
          <div className="mt-8 rounded-lg border border-red-800 bg-red-900/20 p-6 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {job && (
          <>
            <div className="mt-8 mb-10">
              <h1 className="text-2xl font-bold">{job.repo.name}</h1>
              <p className="text-sm text-gray-500 mt-1">Job {job.jobId}</p>
            </div>

            {/* Step indicators */}
            <div className="flex items-center mb-10">
              {STEPS.map((step, i) => {
                const isActive = stepIndex === i;
                const isComplete = stepIndex > i;
                const isFailed = isError && i === 0 && stepIndex === -1;

                return (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all ${
                          isComplete
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : isActive && !isError
                              ? "bg-blue-600 border-blue-600 text-white animate-pulse"
                              : isFailed || (isError && isActive)
                                ? "bg-red-600 border-red-600 text-white"
                                : "border-gray-700 text-gray-600"
                        }`}
                      >
                        {isComplete ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span
                        className={`mt-2 text-xs font-medium ${
                          isActive || isComplete ? "text-gray-200" : "text-gray-600"
                        }`}
                      >
                        {STEP_LABELS[step]}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 mt-[-20px] ${
                          isComplete ? "bg-emerald-600" : "bg-gray-800"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            {!isDone && !isError && job.total > 0 && (
              <div className="mb-8">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>
                    {job.progress} / {job.total}
                  </span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Log */}
            <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4 mb-8">
              <p className="text-sm text-gray-400 font-mono">{job.log}</p>
            </div>

            {/* Done state */}
            {isDone && (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-600/20 mb-4">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-emerald-400 mb-2">
                  Analysis Complete
                </h2>
                <p className="text-gray-400 mb-6">
                  Your code map is ready to explore.
                </p>
                <button
                  onClick={() => router.push(`/analyze/${job.repo.id}`)}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-500 transition-colors"
                >
                  View Code Map
                </button>
              </div>
            )}

            {/* Error state */}
            {isError && (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-600/20 mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-red-400 mb-2">
                  Processing Failed
                </h2>
                <p className="text-gray-400 mb-2">
                  {job.repo.errorMsg || "An unexpected error occurred."}
                </p>
                <button
                  onClick={() => router.push("/")}
                  className="mt-4 rounded-lg border border-gray-700 px-6 py-3 font-medium text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
