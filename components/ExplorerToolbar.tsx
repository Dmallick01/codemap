"use client";

type Props = {
  index: number;
  total: number;
  viewedCount: number;
  currentPath: string;
  onPrev: () => void;
  onNext: () => void;
  onRandom: () => void;
  showHelp: boolean;
  onToggleHelp: () => void;
  bundleCount?: number;
  onExportBundle?: () => void;
};

export default function ExplorerToolbar({
  index,
  total,
  viewedCount,
  currentPath,
  onPrev,
  onNext,
  onRandom,
  showHelp,
  onToggleHelp,
  bundleCount = 0,
  onExportBundle,
}: Props) {
  if (total === 0) return null;

  return (
    <div className="flex-none z-30">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={index <= 0}
          className="btn-blueprint disabled:opacity-40"
          title="Previous (P)"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={index >= total - 1}
          className="btn-blueprint disabled:opacity-40"
          title="Next (N)"
        >
          Next →
        </button>
        <button type="button" onClick={onRandom} className="btn-blueprint" title="Random (R)">
          Random
        </button>

        <span className="text-[11px] font-medium ml-1" style={{ color: "var(--role-routing)" }}>
          Tour
        </span>
        <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
          {index + 1} / {total}
        </span>
        <span className="text-[11px]" style={{ color: "var(--role-api)" }}>
          {viewedCount} viewed
        </span>
        <span
          className="text-[11px] truncate max-w-[min(40ch,50vw)] font-mono"
          style={{ color: "var(--text-secondary)" }}
          title={currentPath}
        >
          {currentPath}
        </span>

        {bundleCount > 0 && onExportBundle && (
          <button type="button" onClick={onExportBundle} className="btn-blueprint">
            Export {bundleCount} →
          </button>
        )}

        <div className="flex-1" />

        <button type="button" onClick={onToggleHelp} className="btn-blueprint">
          {showHelp ? "Hide shortcuts" : "? Shortcuts"}
        </button>
      </div>

      {showHelp && (
        <div
          className="pt-2 mt-2 text-[10px] grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 border-t"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
        >
          <span>
            <kbd style={{ color: "var(--text-primary)" }}>N</kbd> /{" "}
            <kbd style={{ color: "var(--text-primary)" }}>→</kbd> Next file
          </span>
          <span>
            <kbd style={{ color: "var(--text-primary)" }}>P</kbd> /{" "}
            <kbd style={{ color: "var(--text-primary)" }}>←</kbd> Previous
          </span>
          <span>
            <kbd style={{ color: "var(--text-primary)" }}>R</kbd> Random file
          </span>
          <span>
            <kbd style={{ color: "var(--text-primary)" }}>?</kbd> /{" "}
            <kbd style={{ color: "var(--text-primary)" }}>H</kbd> Toggle panels
          </span>
          <span>
            <kbd style={{ color: "var(--text-primary)" }}>Shift</kbd>+click bundle
          </span>
          <span className="col-span-2 sm:col-span-4">
            Tour one anchor at a time; build selective export prompts for your project.
          </span>
        </div>
      )}
    </div>
  );
}
