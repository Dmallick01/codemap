"use client";

type Props = {
  repoName: string;
  fileCount: number;
  edgeCount: number;
  tourIndex: number;
  tourTotal: number;
  currentPath: string;
  chromeOpen: boolean;
  onToggleChrome: () => void;
  onPrev: () => void;
  onNext: () => void;
  onExport?: () => void;
  onOpenLab?: () => void;
  onSecurity?: () => void;
  onBuildElement?: () => void;
  bundleCount?: number;
};

export default function FocusMapHUD({
  repoName,
  fileCount,
  edgeCount,
  tourIndex,
  tourTotal,
  currentPath,
  chromeOpen,
  onToggleChrome,
  onPrev,
  onNext,
  onExport,
  onOpenLab,
  onSecurity,
  onBuildElement,
  bundleCount = 0,
}: Props) {
  return (
    <>
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 max-w-[min(320px,50vw)] pointer-events-none">
        <div className="panel-blueprint px-3 py-2 pointer-events-auto">
          <p className="panel-label mb-0.5">Active map</p>
          <p className="text-[14px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {repoName}
          </p>
          <p className="text-[13px] font-mono mt-1" style={{ color: "var(--text-muted)" }}>
            {fileCount} nodes · {edgeCount} edges
          </p>
        </div>
      </div>

      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 pointer-events-auto">
        <button type="button" onClick={onPrev} className="btn-blueprint" title="Previous (P)">
          ←
        </button>
        <div className="panel-blueprint px-3 py-1.5 text-center min-w-[120px]">
          <p className="text-[13px] font-mono font-semibold" style={{ color: "var(--accent)" }}>
            {tourIndex + 1} / {tourTotal}
          </p>
          <p
            className="text-[12px] truncate max-w-[200px] font-mono"
            style={{ color: "var(--text-muted)" }}
            title={currentPath}
          >
            {currentPath.split("/").pop() ?? currentPath}
          </p>
        </div>
        <button type="button" onClick={onNext} className="btn-blueprint" title="Next (N)">
          →
        </button>
      </div>

      <div className="absolute top-3 right-3 z-20 flex items-center gap-2 pointer-events-auto">
        {onOpenLab && (
          <button
            type="button"
            onClick={onOpenLab}
            className="btn-blueprint lab-open-btn"
            title="GitHub Lab (25 instruments)"
          >
            ⌬ Lab
          </button>
        )}
        {onBuildElement && (
          <button
            type="button"
            onClick={onBuildElement}
            className="btn-blueprint-primary"
            title="Focus prompt bar (G)"
          >
            Ask repo
          </button>
        )}
        {onSecurity && (
          <button
            type="button"
            onClick={onSecurity}
            className="btn-blueprint"
            title="Security implementation brief"
          >
            Security
          </button>
        )}
        {onExport && (
          <button type="button" onClick={onExport} className="btn-blueprint" title="Export capability prompt">
            {bundleCount > 0 ? `Export ${bundleCount}` : "Export"}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleChrome}
          className={`btn-blueprint ${chromeOpen ? "nav-tab-active" : ""}`}
          title="Toggle panels (?)"
        >
          {chromeOpen ? "Hide panels" : "? Panels"}
        </button>
      </div>
    </>
  );
}
