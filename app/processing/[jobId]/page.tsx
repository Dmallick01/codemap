"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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
    sourceType?: string;
  };
}

const DEEP_STEPS = ["fetching", "parsing", "analyzing", "building", "done"];
const LITE_STEPS = ["fetching", "mapping", "building", "done"];

const STEP_LABELS: Record<string, string> = {
  fetching: "GitHub API",
  mapping: "Map structure",
  parsing: "Parsing",
  analyzing: "Analyzing",
  building: "Build map",
  done: "Complete",
  error: "Error",
};

function getSteps(sourceType?: string) {
  return sourceType === "github-lite" ? LITE_STEPS : DEEP_STEPS;
}

function getStepIndex(step: string, sourceType?: string): number {
  const steps = [...getSteps(sourceType)];
  const idx = steps.indexOf(step);
  return idx === -1 ? -1 : idx;
}

function LoadingSkeleton() {
  const steps = LITE_STEPS;
  return (
    <div className="animate-pulse mt-8">
      <div className="h-7 w-48 processing-skeleton rounded mb-2" />
      <div className="h-4 w-32 processing-skeleton rounded mb-10 opacity-60" />
      <div className="flex items-center mb-10">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full processing-skeleton border-2" />
              <div className="mt-2 h-3 w-14 processing-skeleton rounded" />
            </div>
            {i < steps.length - 1 && <div className="flex-1 h-0.5 mx-2 mt-[-20px] processing-track" />}
          </div>
        ))}
      </div>
      <div className="processing-panel rounded-lg p-4 h-16" />
    </div>
  );
}

export default function ProcessingPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobData | null>(null);
  const [error, setError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    intervalRef.current = setInterval(fetchJob, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchJob]);

  // Clear interval when job reaches terminal state
  useEffect(() => {
    if (job?.step === "done" || job?.step === "error") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [job?.step]);

  const steps = job ? getSteps(job.repo.sourceType) : LITE_STEPS;
  const stepIndex = job ? getStepIndex(job.step, job.repo.sourceType) : -1;
  const isLite = job?.repo.sourceType === "github-lite";
  const isError = job?.step === "error";
  const isDone = job?.step === "done";
  const progressPct =
    job && job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0;

  return (
    <main
      className="blueprint-grid min-h-screen"
      style={{ color: "var(--text-primary)" }}
    >
      <div className="mx-auto max-w-2xl px-6 py-24">
        {error && !job && (
          <div className="mt-8 rounded-lg border border-red-800 bg-red-900/20 p-6 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Initial loading skeleton */}
        {!job && !error && <LoadingSkeleton />}

        {job && (
          <>
            <div className="mt-8 mb-10">
              <h1 className="text-2xl font-bold">{job.repo.name}</h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Job {job.jobId}
              </p>
            </div>

            {/* Step indicators — stack vertically on mobile */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center mb-10 gap-4 sm:gap-0">
              {steps.map((step, i) => {
                const isActive = stepIndex === i;
                const isComplete = stepIndex > i;
                const isFailed = isError && i === 0 && stepIndex === -1;

                return (
                  <div
                    key={step}
                    className="flex sm:flex-col items-center sm:flex-1 last:flex-none gap-3 sm:gap-0 w-full sm:w-auto"
                  >
                    <div className="flex sm:flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all flex-shrink-0 ${
                          isComplete
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : isActive && !isError
                              ? "border-[var(--accent)] bg-[var(--accent)] text-white animate-pulse"
                              : isFailed || (isError && isActive)
                                ? "bg-red-600 border-red-600 text-white"
                                : "processing-step-idle border-[var(--border-subtle)] detail-muted"
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
                        className={`sm:mt-2 ml-3 sm:ml-0 text-xs font-medium ${
                          isActive || isComplete ? "detail-primary" : "detail-muted"
                        }`}
                      >
                        {STEP_LABELS[step]}
                      </span>
                    </div>
                    {/* Connector — horizontal on sm+, hidden on mobile */}
                    {i < steps.length - 1 && (
                      <div
                        className={`hidden sm:block flex-1 h-0.5 mx-2 mt-[-20px] ${
                          isComplete ? "processing-track-fill" : "processing-track"
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
                <div className="flex justify-between text-xs detail-muted mb-1">
                  <span>
                    {job.progress} / {job.total}
                  </span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-2 rounded-full processing-track overflow-hidden">
                  <div
                    className="h-full rounded-full processing-track-fill transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Log */}
            <div className="processing-panel rounded-lg p-4 mb-8">
              <p className="text-sm font-mono detail-secondary">{job.log}</p>
            </div>

            {/* Done state */}
            {isDone && (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-600/20 mb-4">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: "var(--accent)" }}>
                  {isLite ? "Lite map ready" : "Analysis complete"}
                </h2>
                <p className="detail-secondary mb-4">
                  {isLite
                    ? "See what this repo is and how its folders connect."
                    : "Your code map is ready to explore."}
                </p>
                <ul className="text-left text-xs detail-muted mb-6 max-w-md mx-auto space-y-1 panel-blueprint p-4">
                  <li>
                    <strong className="detail-secondary">Prompts (G)</strong> — build UI elements, subsystems (agents/LLM), or explain this repo as a wiki
                  </li>
                  <li>
                    <strong className="detail-secondary">Architecture map</strong> — tour files, GitHub Lab (L), security brief
                  </li>
                  <li>
                    <strong className="detail-secondary">UI Studio</strong> — DESIGN.md export (E), UI prompts
                  </li>
                </ul>
                <div className="flex flex-wrap gap-3 justify-center">
                  <button
                    onClick={() => router.push(`/analyze/${job.repo.id}`)}
                    className="btn-blueprint-primary px-6 py-3"
                  >
                    View Code Map
                  </button>
                  <button
                    onClick={() => router.push(`/analyze/${job.repo.id}/ui`)}
                    className="btn-blueprint px-6 py-3"
                  >
                    Open UI Studio
                  </button>
                </div>
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
                <Link
                  href="/"
                  className="mt-4 inline-block btn-blueprint px-6 py-3 font-medium"
                >
                  Try Again
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
